import { describe, expect, it } from 'vitest';
import { defaultSettings } from './defaults';
import { confirmSwitch, finish, getReady, ready, startSession, tick } from './session';
import {
	consistency,
	dayCells,
	dayFill,
	dayLabel,
	describeSeconds,
	holdSeconds,
	holdStats,
	praise,
	readyStats,
	seriesOf,
	summarizeSession,
	swapStats,
	totals,
	weekdayIndex
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

describe('day by day', () => {
	// 2026-01-15 onwards is week 2: a morning and an evening session every day; Day 1 is 2026-01-01
	const settings = defaultSettings(new Date(2026, 0, 1));
	const session = (
		date: string,
		slot: 'morning' | 'evening',
		held = 600,
		skipped = false
	): LogEntry => ({
		id: `${date}-${slot}`,
		date,
		slot,
		startedAt: 0,
		finishedAt: 1,
		skipped,
		steps: [{ label: 'A', plannedMinutes: 10, actualSeconds: held }]
	});
	const both = (date: string) => [session(date, 'morning'), session(date, 'evening')];

	it('classifies each day, oldest first, ending today', () => {
		const log = [
			session('2026-01-19', 'morning'), // today: one of two
			...both('2026-01-18'),
			session('2026-01-17', 'morning', 600, true), // skipped
			session('2026-01-16', 'evening') // only one of two
			// the 15th: nothing
		];
		const cells = dayCells(settings, log, '2026-01-19', 5);
		expect(cells.map((c) => c.date)).toEqual([
			'2026-01-15',
			'2026-01-16',
			'2026-01-17',
			'2026-01-18',
			'2026-01-19'
		]);
		expect(cells.map((c) => c.kind)).toEqual(['missed', 'partial', 'skipped', 'done', 'partial']);
		expect(cells[3]).toMatchObject({ sessions: 2, planned: 2, seconds: 1200 });
		expect(cells[4].isToday).toBe(true);
	});

	it('knows about days before Day 1, rest days, and a today with nothing done yet', () => {
		const cells = dayCells(settings, [], '2026-01-16', 20);
		expect(cells[0].kind).toBe('before'); // 28 Dec
		expect(cells.find((c) => c.date === '2026-01-03')!.kind).toBe('rest'); // week 0 is rest
		expect(cells.at(-1)!.kind).toBe('pending');
		expect(cells.at(-2)!.kind).toBe('missed');
	});

	it('counts an extra session on a day without a plan as a good day', () => {
		const cells = dayCells(settings, [session('2026-01-03', 'morning')], '2026-01-04', 2);
		expect(cells[0]).toMatchObject({ kind: 'done', sessions: 1, planned: 0 });
	});

	it('finds the weekday, Monday first', () => {
		expect(weekdayIndex('2026-01-19')).toBe(0); // a Monday
		expect(weekdayIndex('2026-01-25')).toBe(6); // a Sunday
	});

	it('sums up how steady you were, without holding today against you', () => {
		const log = [
			session('2026-01-19', 'morning'),
			...both('2026-01-18'),
			session('2026-01-17', 'morning')
		];
		const c = consistency(dayCells(settings, log, '2026-01-19', 5));
		// 15th missed, 16th missed, 17th half, 18th all, 19th (today) one so far
		expect(c).toEqual({
			activeDays: 3,
			days: 5,
			doneSessions: 4,
			plannedSessions: 9, // 2+2+2+2 of the past days, and the 1 done today
			perfectDays: 1,
			plannedDays: 4 // the four days that are over; today counts once it is all done
		});
	});

	it('fills a day by how much of what was planned got done, not by minutes', () => {
		const days = (n: number) => session(`2026-01-${10 + n}`, 'morning');
		// one session planned (the first, "daily" week), done: a full square, however short
		const week1 = defaultSettings(new Date(2026, 0, 1));
		const full = dayCells(week1, [days(0)], '2026-01-11', 2).find((c) => c.date === '2026-01-10')!;
		expect(full.planned).toBe(1);
		expect(dayFill(full)).toBe(100);
		// two planned, one done: half
		const half = dayCells(settings, [session('2026-01-19', 'morning', 60)], '2026-01-20', 2)[0];
		expect(half.planned).toBe(2);
		expect(dayFill(half)).toBe(50);
		// none done: empty; more than planned: still just full
		expect(dayFill(dayCells(settings, [], '2026-01-20', 2)[0])).toBe(0);
		const extra = dayCells(
			settings,
			[...both('2026-01-19'), session('2026-01-19', 'morning')],
			'2026-01-20',
			2
		)[0];
		expect(dayFill(extra)).toBe(100);
	});

	it('does not count rest days as missed, nor before the schedule started', () => {
		const cells = dayCells(settings, [], '2026-01-10', 12); // week 0 is rest (days 1-7): 2026-01-01..07
		const rest = cells.find((c) => c.date === '2026-01-05')!;
		expect(rest.kind).toBe('rest');
		expect(rest.planned).toBe(0);
		expect(dayFill(rest)).toBe(0);
		const c = consistency(cells);
		expect(c.plannedDays).toBeLessThan(c.days); // rest days are not asked for
		expect(c.perfectDays).toBe(0);
	});

	it('says in words what the schedule asked and what you did', () => {
		const label = (log: LogEntry[], date: string, today = '2026-01-20') =>
			dayLabel(dayCells(settings, log, today, 5).find((c) => c.date === date)!);
		expect(label(both('2026-01-18'), '2026-01-18')).toMatch(/^2 of 2 sessions planned, /);
		expect(label([session('2026-01-18', 'morning')], '2026-01-18')).toMatch(
			/^1 of 2 sessions planned/
		);
		expect(label([], '2026-01-18')).toBe('none of 2 sessions planned');
		expect(label([], '2026-01-20')).toBe('2 sessions planned, not done yet');
		expect(label([session('2026-01-03', 'morning')], '2026-01-03', '2026-01-04')).toMatch(
			/^1 session \(nothing was planned\)/
		);
		expect(label([...both('2026-01-18'), session('2026-01-18', 'morning')], '2026-01-18')).toMatch(
			/^3 sessions, 2 planned/
		);
	});

	it('adds up the total time with each dilator', () => {
		const a = holdStats([
			session('2026-01-15', 'morning', 600),
			session('2026-01-16', 'morning', 300)
		]);
		expect(a[0]).toMatchObject({ label: 'A', sessions: 2, totalSeconds: 900, averageSeconds: 450 });
	});
});
