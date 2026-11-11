import { describe, expect, it } from 'vitest';
import { confirmSwitch, finish, getReady, ready, startSession, tick } from './session';
import {
	describeSeconds,
	holdSeconds,
	holdStats,
	praise,
	readyStats,
	seriesOf,
	summarizeSession,
	swapStats,
	totals
} from './stats';
import type { LogEntry, SessionStep } from './types';

const MIN = 60_000;
const DAY = 86_400_000;

interface Swap {
	seconds: number;
	nudged?: boolean;
	askedMore?: boolean;
}

/** A finished session in the log. `swaps` is the swap before each dilator after the first. */
function entry(opts: {
	ready?: number;
	swaps?: Record<string, number | Swap>;
	finishedAt?: number;
	skipped?: boolean;
	held?: number;
}): LogEntry {
	const held = opts.held ?? 600;
	const swaps = Object.entries(opts.swaps ?? {}).map(([label, v]) => ({
		label,
		swap: typeof v === 'number' ? { seconds: v } : v
	}));
	return {
		id: Math.random().toString(),
		date: '2026-01-01',
		slot: 'morning',
		startedAt: 0,
		finishedAt: opts.finishedAt ?? 1,
		skipped: opts.skipped,
		steps: [
			{
				label: 'A',
				plannedMinutes: 10,
				// the recorded length of a dilator includes the swap to the next one
				actualSeconds: held + (swaps[0]?.swap.seconds ?? 0),
				...(opts.ready !== undefined ? { readySeconds: opts.ready } : {})
			},
			...swaps.map(({ label, swap }, i) => ({
				label,
				plannedMinutes: 10,
				actualSeconds: held + (swaps[i + 1]?.swap.seconds ?? 0),
				switchSeconds: swap.seconds,
				...(swap.nudged ? { switchNudged: true } : {}),
				...(swap.askedMore ? { switchAskedMore: true } : {})
			}))
		]
	};
}

describe('seriesOf', () => {
	it('gives the typical, average, shortest, longest and latest', () => {
		const s = seriesOf([60, 120, 30, 600, 90])!;
		expect(s).toMatchObject({ typical: 90, average: 180, shortest: 30, longest: 600, latest: 90 });
	});

	it('is null without measurements', () => {
		expect(seriesOf([])).toBeNull();
	});

	it('takes the middle of two for an even number', () => {
		expect(seriesOf([10, 20])!.typical).toBe(15);
	});
});

describe('describeSeconds', () => {
	it('reads naturally, from seconds to hours', () => {
		expect(describeSeconds(45)).toBe('45 s');
		expect(describeSeconds(120)).toBe('2 min');
		expect(describeSeconds(80)).toBe('1 min 20 s');
		expect(describeSeconds(3600)).toBe('1 h');
		expect(describeSeconds(3900)).toBe('1 h 5 min');
	});
});

describe('swap statistics', () => {
	it('finds the shortest and longest swap, overall and per dilator', () => {
		const log = [
			entry({ swaps: { B: 100, C: 300 } }),
			entry({ swaps: { B: 40, C: 500 } }),
			entry({ swaps: { B: 160, C: 200 } })
		];
		const { all, byLabel } = swapStats(log);
		expect(all).toMatchObject({ shortest: 40, longest: 500 });
		expect(all!.values).toHaveLength(6);
		const b = byLabel.find((x) => x.label === 'B')!.series;
		const c = byLabel.find((x) => x.label === 'C')!.series;
		expect(b).toMatchObject({ shortest: 40, longest: 160, typical: 100 });
		expect(c).toMatchObject({ shortest: 200, longest: 500, typical: 300 });
	});

	it('lists the swaps oldest first (the log is newest first)', () => {
		const log = [
			entry({ swaps: { B: 300 } }),
			entry({ swaps: { B: 200 } }),
			entry({ swaps: { B: 100 } })
		];
		expect(swapStats(log).all!.values).toEqual([100, 200, 300]);
		expect(swapStats(log).all!.latest).toBe(300);
	});

	it('leaves out forgotten swaps and skipped sessions, but keeps ones where you asked for time', () => {
		const log = [
			entry({ swaps: { B: { seconds: 1800, nudged: true } } }), // forgot
			entry({ swaps: { B: { seconds: 400, nudged: true, askedMore: true } } }),
			entry({ swaps: { B: 100 }, skipped: true }),
			entry({ swaps: { B: 90 } })
		];
		expect(swapStats(log).all!.values).toEqual([90, 400]);
	});

	it('is empty when nothing has been timed', () => {
		expect(swapStats([entry({})])).toEqual({ all: null, byLabel: [] });
	});
});

describe('time to Ready', () => {
	it('collects the first dilator of each session', () => {
		const log = [entry({ ready: 90 }), entry({}), entry({ ready: 200 })];
		expect(readyStats(log)!.values).toEqual([200, 90]);
		expect(readyStats(log)).toMatchObject({ shortest: 90, longest: 200 });
		expect(readyStats([entry({})])).toBeNull();
	});
});

describe('time with the dilators', () => {
	it('takes the swap off the recorded length of a dilator', () => {
		const e = entry({ swaps: { B: 100, C: 50 }, held: 600 });
		expect(e.steps.map((_, i) => holdSeconds(e.steps, i))).toEqual([600, 600, 600]);
	});

	it('adds it all up and counts the week', () => {
		const now = 10 * DAY;
		const log = [
			entry({ finishedAt: now - DAY, held: 600 }),
			entry({ finishedAt: now - 8 * DAY, held: 300 }),
			entry({ finishedAt: now - DAY, held: 999, skipped: true })
		];
		expect(totals(log, now)).toEqual({ sessions: 2, seconds: 900, thisWeek: 1 });
	});

	it('averages per dilator', () => {
		const log = [entry({ swaps: { B: 60 }, held: 600 }), entry({ swaps: { B: 60 }, held: 300 })];
		const a = holdStats(log).find((x) => x.label === 'A')!;
		expect(a).toMatchObject({ sessions: 2, averageSeconds: 450, plannedMinutes: 10 });
	});
});

describe('the end screen summary', () => {
	const steps: SessionStep[] = [
		{ label: 'A', minutes: 10, color: '#111' },
		{ label: 'B', minutes: 20, color: '#222' }
	];

	function played() {
		let s = ready(getReady(startSession(steps, 'morning', '2026-01-01', 0)), 90_000);
		s = tick(s, 90_000 + 10 * MIN);
		s = confirmSwitch(s, 90_000 + 10 * MIN + 150_000);
		return tick(s, 90_000 + 10 * MIN + 150_000 + 20 * MIN);
	}

	it('is nothing while the session is going', () => {
		const s = ready(getReady(startSession(steps, 'morning', '2026-01-01', 0)), 1000);
		expect(summarizeSession(s)).toBeNull();
	});

	it('reports the time with each dilator, the wait before Ready and each swap', () => {
		const sum = summarizeSession(played())!;
		expect(sum.readySeconds).toBe(90);
		expect(sum.swaps).toEqual([{ label: 'B', nickname: undefined, seconds: 150 }]);
		expect(sum.averageSwapSeconds).toBe(150);
		expect(sum.steps.map((x) => x.heldSeconds)).toEqual([600, 1200]);
		expect(sum.heldSeconds).toBe(1800);
		expect(sum.plannedMinutes).toBe(30);
		expect(sum.totalSeconds).toBe(90 + 600 + 150 + 1200);
	});

	it('agrees with what is saved in the history', () => {
		const s = played();
		const sum = summarizeSession(s)!;
		const saved = finish(s, 90_000 + 10 * MIN + 150_000 + 20 * MIN);
		expect(saved.steps.map((_, i) => holdSeconds(saved.steps, i))).toEqual(
			sum.steps.map((x) => x.heldSeconds)
		);
	});

	it('only ever praises: a line when you were quicker than usual, nothing otherwise', () => {
		const sum = summarizeSession(played())!; // swap 150 s, ready 90 s
		const slow = Array.from({ length: 4 }, () => entry({ ready: 240, swaps: { B: 300 } }));
		expect(praise(sum, slow)).toEqual([
			'Your swaps were quicker than usual ♡',
			'Quicker to Ready than usual ♡'
		]);
		const quick = Array.from({ length: 4 }, () => entry({ ready: 60, swaps: { B: 100 } }));
		expect(praise(sum, quick)).toEqual([]);
		expect(praise(sum, slow.slice(0, 2))).toEqual([]); // too little history to compare with
	});
});
