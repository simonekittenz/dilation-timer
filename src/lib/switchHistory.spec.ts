import { describe, expect, it } from 'vitest';
import { confirmSwitch, estimatedFinish, finish, startSession, tick } from './session';
import {
	MAX_SAMPLE_MS,
	MAX_RISE_MS,
	MIN_SAMPLES,
	describeSwitch,
	isFirstTime,
	learnSwitches,
	switchWindowFor,
	usualSwitchMs
} from './switchHistory';
import type { LogEntry, SessionStep } from './types';

const MIN = 60_000;
const WINDOW = 90_000;
const steps: SessionStep[] = [
	{ label: 'A', minutes: 10, color: '#111' },
	{ label: 'B', minutes: 20, color: '#222' },
	{ label: 'C', minutes: 30, color: '#333' }
];

interface Swap {
	seconds: number;
	nudged?: boolean;
	askedMore?: boolean;
}

const entry = (swaps: Record<string, number | Swap>, skipped = false): LogEntry => ({
	id: Math.random().toString(),
	date: '2026-01-01',
	slot: 'morning',
	startedAt: 0,
	finishedAt: 1,
	skipped,
	steps: Object.entries(swaps).map(([label, swap]) => {
		const s = typeof swap === 'number' ? { seconds: swap } : swap;
		return {
			label,
			plannedMinutes: 10,
			actualSeconds: 600,
			switchSeconds: s.seconds,
			...(s.nudged ? { switchNudged: true } : {}),
			...(s.askedMore ? { switchAskedMore: true } : {})
		};
	})
});

// the oldest session in the log: every dilator has been done once, so later swaps are not "first times"
const before = (...labels: string[]): LogEntry =>
	entry(Object.fromEntries(labels.map((l) => [l, 0])));

/** A log (newest first) where dilator B was swapped to in turn, taking these many seconds each. */
const swapsTo = (label: string, seconds: (number | Swap)[]): LogEntry[] => [
	...seconds.map((s) => entry({ [label]: s })).reverse(),
	before(label)
];

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

	it('notes nothing extra for a swap done inside the window without asking for time', () => {
		let s = startSession(steps, 'morning', '2026-01-01', 0);
		s = tick(s, 10 * MIN);
		s = confirmSwitch(s, 10 * MIN + WINDOW - 1, WINDOW);
		expect(s.records[1].switchedAfterMs).toBe(WINDOW - 1);
		expect(s.records[1].switchNudged).toBeUndefined();
		expect(s.records[1].switchAskedMore).toBeUndefined();
	});

	it('notes that a swap only happened after the nudge, and still records how long it took', () => {
		let s = startSession(steps, 'morning', '2026-01-01', 0);
		s = tick(s, 10 * MIN);
		s = confirmSwitch(s, 10 * MIN + WINDOW, WINDOW);
		expect(s.records[1].switchedAfterMs).toBe(WINDOW);
		expect(s.records[1].switchNudged).toBe(true);
		expect(s.records[1].switchAskedMore).toBeUndefined();
		const step = finish(s, 40 * MIN).steps[1];
		expect(step).toMatchObject({ switchSeconds: 90, switchNudged: true });
	});

	it('notes "+1 min": more time inside the window is not a nudged swap', () => {
		let s = startSession(steps, 'morning', '2026-01-01', 0);
		s = tick(s, 10 * MIN);
		s = { ...s, windowExtraMs: 60_000 };
		s = confirmSwitch(s, 10 * MIN + WINDOW + 30_000, WINDOW);
		expect(s.records[1].switchNudged).toBeUndefined();
		expect(s.records[1].switchAskedMore).toBe(true);
		expect(finish(s, 40 * MIN).steps[1].switchAskedMore).toBe(true);
	});

	it('notes "Chill out" as both nudged and asking for time', () => {
		let s = startSession(steps, 'morning', '2026-01-01', 0);
		s = tick(s, 10 * MIN);
		s = { ...s, quietUntil: 10 * MIN + 5 * MIN };
		s = confirmSwitch(s, 10 * MIN + 3 * MIN, WINDOW);
		expect(s.records[1]).toMatchObject({ switchNudged: true, switchAskedMore: true });
	});
});

describe('learning your usual swap time', () => {
	it('takes the swap that three out of four were quicker than, so the nudge is not early', () => {
		const h = learnSwitches(swapsTo('B', [120, 180, 240, 300]));
		// 120, 180, 240, 300 s: three quarters of the way up is 255 s
		expect(usualSwitchMs(h, 'B')).toBe(255_000);
	});

	it('needs a few swaps before it says anything, then falls back to all dilators together', () => {
		const few = swapsTo('B', [120, 180]);
		expect(MIN_SAMPLES).toBe(3);
		expect(usualSwitchMs(learnSwitches(few), 'B')).toBe(0);
		const log = [...swapsTo('B', [120, 180, 240]), ...swapsTo('C', [60])];
		const h = learnSwitches(log);
		expect(usualSwitchMs(h, 'C')).toBe(h.typicalAll); // C has one swap: it uses all of them
		expect(usualSwitchMs(h, 'C')).toBeGreaterThan(0);
	});

	it('is nothing without history, so only the Settings window applies', () => {
		expect(usualSwitchMs(learnSwitches([]), 'B')).toBe(0);
		expect(
			usualSwitchMs(learnSwitches([entry({}), { ...entry({ B: 5 }), skipped: true }]), 'B')
		).toBe(0);
	});

	it('follows the latest swaps', () => {
		const old = Array.from({ length: 20 }, () => 400);
		const recent = Array.from({ length: 10 }, () => 100);
		// oldest first here; 20 slow swaps and then 10 quick ones
		const h = learnSwitches(swapsTo('B', [...old, ...recent]));
		expect(usualSwitchMs(h, 'B')).toBe(100_000);
	});

	it('does not let a few flyers move it', () => {
		const normal = [200, 210, 190, 205, 195, 200, 215, 185];
		const flyers = [200, 210, 190, 3000, 195, 200, 2500, 185]; // two forgotten swaps
		expect(usualSwitchMs(learnSwitches(swapsTo('B', flyers)), 'B')).toBeLessThan(
			usualSwitchMs(learnSwitches(swapsTo('B', normal)), 'B') + 15_000
		);
	});

	it('skips damaged numbers', () => {
		const bad = entry({ B: -5 });
		bad.steps.push({ label: 'B', plannedMinutes: 1, actualSeconds: 1, switchSeconds: NaN });
		expect(usualSwitchMs(learnSwitches([bad]), 'B')).toBe(0);
	});
});

describe('swaps that went past the nudge', () => {
	it('are not learned from when you did not ask for time: that is most likely forgetting', () => {
		const log = swapsTo('B', [100, 100, 100, { seconds: 900, nudged: true }]);
		expect(usualSwitchMs(learnSwitches(log), 'B')).toBe(100_000);
	});

	it('are learned from when you pressed "+1 min" or "Chill out": you were busy swapping', () => {
		const slow = { seconds: 360, nudged: true, askedMore: true };
		const log = swapsTo('B', [slow, slow, slow, slow]);
		expect(usualSwitchMs(learnSwitches(log), 'B')).toBe(360_000);
	});

	it('count when you asked for time and were still inside the window', () => {
		const log = swapsTo('B', [{ seconds: 150, askedMore: true }, 150, 150]);
		expect(usualSwitchMs(learnSwitches(log), 'B')).toBe(150_000);
	});

	it('count when they come from before these were noted', () => {
		expect(usualSwitchMs(learnSwitches(swapsTo('B', [100, 100, 100])), 'B')).toBe(100_000);
	});
});

describe('the learned time cannot run away', () => {
	it('has no ceiling: someone who really takes 15 minutes gets nudged at 15 minutes', () => {
		const slow = { seconds: 15 * 60, nudged: true, askedMore: true };
		const h = learnSwitches(swapsTo('B', [slow, slow, slow, slow]));
		expect(usualSwitchMs(h, 'B')).toBe(15 * MIN);
	});

	it('counts one swap that went on for hours as no more than an hour', () => {
		const asleep = { seconds: 3 * 3600, nudged: true, askedMore: true };
		const h = learnSwitches(swapsTo('B', Array(30).fill(asleep)));
		expect(usualSwitchMs(h, 'B')).toBe(MAX_SAMPLE_MS);
	});

	it('only creeps up a few minutes with every swap, however much slower the latest ones are', () => {
		const steady = Array(7).fill(600); // 10 minutes
		const typical = (slower: number) =>
			usualSwitchMs(learnSwitches(swapsTo('B', [...steady, ...Array(slower).fill(1200)])), 'B');
		let last = typical(0);
		for (let n = 1; n <= 10; n++) {
			const now = typical(n);
			expect(now - last).toBeLessThanOrEqual(MAX_RISE_MS);
			last = now;
		}
		// three 20-minute swaps would pull a plain 75th percentile up by 7.5 minutes at once: held to 5
		expect(typical(3)).toBe(10 * MIN + MAX_RISE_MS);
		expect(last).toBe(20 * MIN); // it does follow you when you really are slower
	});

	it('ignores a sudden flyer instead of creeping towards it', () => {
		const quick = Array(5).fill(60);
		expect(usualSwitchMs(learnSwitches(swapsTo('B', [...quick, 500])), 'B')).toBe(60_000);
	});

	it('comes down again straight away when swaps get quicker', () => {
		const slow = Array(10).fill(480);
		const quick = Array(10).fill(60);
		expect(usualSwitchMs(learnSwitches(swapsTo('B', [...slow, ...quick])), 'B')).toBe(60_000);
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

describe('when to nudge', () => {
	const done = (labels: string[], skipped = false): LogEntry => ({
		id: labels.join(),
		date: '2026-01-01',
		slot: 'morning',
		startedAt: 0,
		finishedAt: 1,
		skipped,
		steps: labels.map((label) => ({ label, plannedMinutes: 10, actualSeconds: 600 }))
	});

	it('is the Settings window when there is nothing learned', () => {
		expect(switchWindowFor(learnSwitches([done(['A', 'B'])]), 'B', MIN, 2 * MIN)).toBe(MIN);
	});

	it('is your usual time when that is longer than the window: the window is not added on top', () => {
		const h = learnSwitches(swapsTo('B', [300, 300, 300]));
		expect(switchWindowFor(h, 'B', MIN, 2 * MIN)).toBe(5 * MIN);
	});

	it('is never less than the window, however quick you are', () => {
		const h = learnSwitches(swapsTo('B', [20, 20, 20]));
		expect(switchWindowFor(h, 'B', MIN, 2 * MIN)).toBe(MIN);
	});

	it('is the window alone with no next dilator, or with the extra turned off', () => {
		const h = learnSwitches([]);
		expect(switchWindowFor(h, undefined, MIN, 2 * MIN)).toBe(MIN);
		expect(switchWindowFor(h, 'D', MIN, 0)).toBe(MIN);
	});
});

describe('the first time with a dilator', () => {
	const done = (labels: string[], skipped = false): LogEntry => ({
		id: labels.join(),
		date: '2026-01-01',
		slot: 'morning',
		startedAt: 0,
		finishedAt: 1,
		skipped,
		steps: labels.map((label) => ({ label, plannedMinutes: 10, actualSeconds: 600 }))
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

	it('does not learn from the swap to a dilator the first time you used it', () => {
		const h = learnSwitches([
			entry({ B: 100 }),
			entry({ B: 100 }),
			entry({ B: 100 }),
			entry({ B: 900 })
		]);
		expect(usualSwitchMs(h, 'B')).toBe(100_000); // the oldest one was B's first time
		expect(usualSwitchMs(h, 'D')).toBe(100_000); // and it does not drag up a new dilator either
	});

	it('only leaves out the first time, not a dilator used twice in one session', () => {
		const twice = (second: number) => {
			const e = entry({ B: 900 });
			e.steps.push({ label: 'B', plannedMinutes: 10, actualSeconds: 600, switchSeconds: second });
			return e;
		};
		const h = learnSwitches([twice(60), twice(60), twice(60)]);
		expect(usualSwitchMs(h, 'B')).toBe(60_000);
	});

	it('adds the extra time on top of the window or your usual time, not instead of it', () => {
		const h = learnSwitches(swapsTo('B', [300, 300, 300]));
		// B was done before: only the usual time; D is new: the usual swap of all dilators and 2 more minutes
		expect(switchWindowFor(h, 'B', MIN, 2 * MIN)).toBe(5 * MIN);
		expect(switchWindowFor(h, 'D', MIN, 2 * MIN)).toBe(7 * MIN);
		expect(switchWindowFor(learnSwitches([]), 'D', MIN, 2 * MIN)).toBe(3 * MIN);
	});
});
