import { describe, expect, it } from 'vitest';
import { confirmSwitch, estimatedFinish, finish, startSession, tick } from './session';
import {
	MAX_LEARNED_MS,
	MAX_SAMPLES,
	MAX_SAMPLE_MS,
	describeSwitch,
	isFirstTime,
	learnSwitches,
	switchWindowFor,
	usualSwitchMs
} from './switchHistory';
import type { LogEntry, SessionStep } from './types';

const MIN = 60_000;
const steps: SessionStep[] = [
	{ label: 'A', minutes: 10, color: '#111' },
	{ label: 'B', minutes: 20, color: '#222' },
	{ label: 'C', minutes: 30, color: '#333' }
];

const entry = (swaps: Record<string, number>, skipped = false): LogEntry => ({
	id: Math.random().toString(),
	date: '2026-01-01',
	slot: 'morning',
	startedAt: 0,
	finishedAt: 1,
	skipped,
	steps: Object.entries(swaps).map(([label, seconds]) => ({
		label,
		plannedMinutes: 10,
		actualSeconds: 600,
		switchSeconds: seconds
	}))
});

// the oldest session in the log: every dilator has been done once, so later swaps are not "first times"
const before = (...labels: string[]): LogEntry =>
	entry(Object.fromEntries(labels.map((l) => [l, 0])));
const WINDOW = 90_000;

describe('recording how long a swap took', () => {
	it('notes the time between the timer ending and "I switched" on the next dilator', () => {
		let s = startSession(steps, 'morning', '2026-01-01', 0);
		s = tick(s, 10 * MIN);
		s = confirmSwitch(s, 10 * MIN + 95_000);
		expect(s.records[1].switchedAfterMs).toBe(95_000);
		expect(s.records[0].switchedAfterMs).toBeUndefined(); // the first dilator had no swap before it
		const log = finish(s, 40 * MIN);
		expect(log.steps.map((x) => x.switchSeconds)).toEqual([undefined, 95]);
	});

	it('counts a swap that was done before the timer ran out as no waiting at all', () => {
		let s = startSession(steps, 'morning', '2026-01-01', 0);
		s = { ...s, phase: 'switch', alertSince: 10 * MIN }; // skipped ahead
		s = confirmSwitch(s, 10 * MIN - 5_000);
		expect(s.records[1].switchedAfterMs).toBe(0);
	});

	it('keeps a swap that was done inside the window, including after "+1 min"', () => {
		let s = startSession(steps, 'morning', '2026-01-01', 0);
		s = tick(s, 10 * MIN);
		expect(confirmSwitch(s, 10 * MIN + WINDOW - 1, WINDOW).records[1].switchedAfterMs).toBe(
			WINDOW - 1
		);
		const more = { ...s, windowExtraMs: 60_000 };
		expect(confirmSwitch(more, 10 * MIN + WINDOW + 30_000, WINDOW).records[1].switchedAfterMs).toBe(
			WINDOW + 30_000
		);
	});

	it('does not record a swap that only happened after the nudge', () => {
		let s = startSession(steps, 'morning', '2026-01-01', 0);
		s = tick(s, 10 * MIN);
		s = confirmSwitch(s, 10 * MIN + WINDOW, WINDOW);
		expect(s.records[1].switchedAfterMs).toBeUndefined();
		expect(finish(s, 40 * MIN).steps[1].switchSeconds).toBeUndefined();
	});

	it('does not record a swap after "Chill out" either', () => {
		let s = startSession(steps, 'morning', '2026-01-01', 0);
		s = tick(s, 10 * MIN);
		s = { ...s, quietUntil: 10 * MIN + 5 * MIN };
		s = confirmSwitch(s, 10 * MIN + 3 * MIN, WINDOW);
		expect(s.records[1].switchedAfterMs).toBeUndefined();
	});
});

describe('learning your usual swap time', () => {
	it('averages the swaps to each dilator', () => {
		const h = learnSwitches([
			entry({ B: 60, C: 120 }),
			entry({ B: 120, C: 120 }),
			before('B', 'C')
		]);
		expect(usualSwitchMs(h, 'B')).toBe(90_000);
		expect(usualSwitchMs(h, 'C')).toBe(120_000);
	});

	it('uses the average of all your swaps for a dilator it has not seen', () => {
		const h = learnSwitches([entry({ B: 60, C: 180 }), before('B', 'C')]);
		expect(usualSwitchMs(h, 'D')).toBe(120_000);
	});

	it('is nothing without history, so only the Settings window applies', () => {
		expect(usualSwitchMs(learnSwitches([]), 'B')).toBe(0);
		expect(
			usualSwitchMs(learnSwitches([entry({}), { ...entry({ B: 5 }), skipped: true }]), 'B')
		).toBe(0);
	});

	it('follows the latest swaps and ignores a swap that went on for ages', () => {
		const recent = Array.from({ length: MAX_SAMPLES }, () => entry({ B: 60 }));
		const old = Array.from({ length: 20 }, () => entry({ B: 600 }));
		expect(usualSwitchMs(learnSwitches([...recent, ...old, before('B')]), 'B')).toBe(60_000);
		const long = learnSwitches([entry({ B: 3 * 3600 }), before('B')]);
		expect(long.byLabel.get('B')).toEqual([MAX_SAMPLE_MS]);
	});

	it('skips damaged numbers', () => {
		const bad = entry({ B: -5 });
		bad.steps.push({ label: 'B', plannedMinutes: 1, actualSeconds: 1, switchSeconds: NaN });
		expect(usualSwitchMs(learnSwitches([bad]), 'B')).toBe(0);
	});
});

describe('the learned time can never run away', () => {
	it('adds at most the cap, however long your swaps are', () => {
		const h = learnSwitches([entry({ B: 540 }), entry({ B: 480 }), before('B')]);
		expect(usualSwitchMs(h, 'B')).toBe(MAX_LEARNED_MS);
		expect(usualSwitchMs(h, 'D')).toBe(MAX_LEARNED_MS); // the same cap for the all-swaps average
		expect(switchWindowFor(h, 'B', MIN, 0)).toBe(MIN + MAX_LEARNED_MS);
	});

	it('leaves averages below the cap alone', () => {
		const h = learnSwitches([entry({ B: 100 }), before('B')]);
		expect(usualSwitchMs(h, 'B')).toBe(100_000);
	});
});

describe("the finish time follows each dilator's own window", () => {
	it('adds the window in front of each dilator still to come', () => {
		const s = startSession(steps, 'morning', '2026-01-01', 0);
		const windows = (step: number) => (step === 1 ? 2 * MIN : 5 * MIN); // B takes a bit, C takes longer
		expect(estimatedFinish(s, 0, windows)).toBe(60 * MIN + 2 * MIN + 5 * MIN);
	});

	it('while waiting to switch, counts the rest of this swap and the windows after it', () => {
		let s = startSession(steps, 'morning', '2026-01-01', 0);
		s = tick(s, 10 * MIN);
		const windows = (step: number) => (step === 1 ? 2 * MIN : 5 * MIN);
		// 30 s into the 2 minute window for B: 90 s left, then B, then the 5 minute window for C, then C
		expect(estimatedFinish(s, 10 * MIN + 30_000, windows)).toBe(
			10 * MIN + 30_000 + 90_000 + 20 * MIN + 5 * MIN + 30 * MIN
		);
	});
});

describe('describeSwitch', () => {
	it('reads naturally', () => {
		expect(describeSwitch(45_000)).toBe('45 s');
		expect(describeSwitch(120_000)).toBe('2 min');
		expect(describeSwitch(80_000)).toBe('1 min 20 s');
	});
});

describe('the first time with a dilator', () => {
	const MINUTE = 60_000;
	const done = (labels: string[], skipped = false): LogEntry => ({
		id: labels.join(),
		date: '2026-01-01',
		slot: 'morning',
		startedAt: 0,
		finishedAt: 1,
		skipped,
		steps: labels.map((label) => ({ label, plannedMinutes: 10, actualSeconds: 600 }))
	});

	it('does not learn from the swap to a dilator the first time you used it', () => {
		const h = learnSwitches([entry({ B: 60 }), entry({ B: 400 })]); // the older one was B's first time
		expect(h.byLabel.get('B')).toEqual([60_000]);
		expect(h.all).toEqual([60_000]);
		expect(usualSwitchMs(h, 'D')).toBe(60_000); // a new dilator is not dragged up by it
	});

	it('only leaves out the first time, not a dilator used twice in one session', () => {
		const twice = entry({ B: 400 });
		twice.steps.push({ label: 'B', plannedMinutes: 10, actualSeconds: 600, switchSeconds: 50 });
		expect(learnSwitches([twice]).byLabel.get('B')).toEqual([50_000]);
	});

	it('is a dilator that no finished session has had yet', () => {
		const h = learnSwitches([done(['A', 'B']), done(['C'], true)]);
		expect(isFirstTime(h, 'B')).toBe(false);
		expect(isFirstTime(h, 'C')).toBe(true); // that session was skipped
		expect(isFirstTime(h, 'D')).toBe(true);
	});

	it('does not need recorded swap times: history from before they were kept counts too', () => {
		expect(isFirstTime(learnSwitches([done(['A', 'B'])]), 'B')).toBe(false);
	});

	it('adds the extra time on top of the window, not instead of it', () => {
		const h = learnSwitches([done(['A', 'B'])]);
		// B was done before: only the window; D is new: the window and 2 more minutes
		expect(switchWindowFor(h, 'B', MINUTE, 2 * MINUTE)).toBe(MINUTE);
		expect(switchWindowFor(h, 'D', MINUTE, 2 * MINUTE)).toBe(3 * MINUTE);
	});

	it('also adds your usual swap time when there is one for other dilators', () => {
		const h = learnSwitches([entry({ B: 60, C: 120 }), before('B', 'C')]);
		// a new dilator uses the average of your swaps (90 s) + window + the first-time extra
		expect(switchWindowFor(h, 'D', MINUTE, 2 * MINUTE)).toBe(90_000 + 3 * MINUTE);
	});

	it('is the window alone with no next dilator, or with the extra turned off', () => {
		const h = learnSwitches([]);
		expect(switchWindowFor(h, undefined, MINUTE, 2 * MINUTE)).toBe(MINUTE);
		expect(switchWindowFor(h, 'D', MINUTE, 0)).toBe(MINUTE);
	});
});
