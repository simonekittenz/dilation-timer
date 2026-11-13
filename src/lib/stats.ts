import { addDays, dayNumber } from './dates';
import { isRestPhase, phaseForDate } from './schedule';
import { alertStart } from './session';
import type { ActiveSession, LogEntry, Settings } from './types';

type Step = LogEntry['steps'][number];

/** A run of measurements (seconds), oldest first, with the numbers worth showing. */
export interface Series {
	values: number[];
	/** The middle one, so a single odd day does not swing it. */
	typical: number;
	average: number;
	shortest: number;
	longest: number;
	latest: number;
}

/** How many of the latest measurements a chart shows. */
export const RECENT = 12;

function middle(xs: number[]): number {
	const sorted = [...xs].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function seriesOf(values: number[]): Series | null {
	if (!values.length) return null;
	return {
		values,
		typical: Math.round(middle(values)),
		average: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
		shortest: Math.min(...values),
		longest: Math.max(...values),
		latest: values[values.length - 1]
	};
}

/** "45 s", "2 min", "1 min 20 s", "1 h 5 min". */
export function describeSeconds(seconds: number): string {
	const total = Math.round(seconds);
	if (total < 60) return `${total} s`;
	const minutes = Math.floor(total / 60);
	const rest = total % 60;
	if (minutes >= 60) {
		const m = minutes % 60;
		return m === 0 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ${m} min`;
	}
	return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;

/** A swap where the nudge had started and you did not ask for time is most likely a forgotten one. */
const realSwap = (st: Step) =>
	isNumber(st.switchSeconds) && !(st.switchNudged && !st.switchAskedMore);

/** Done sessions, oldest first (the log itself is newest first). */
const doneSessions = (log: LogEntry[]) => log.filter((e) => !e.skipped).reverse();

/** The time with this dilator itself: the swap time at its end is part of its recorded length, so it comes off. */
export function holdSeconds(steps: Step[], i: number): number {
	const swapAfter = steps[i + 1]?.switchSeconds;
	const swap = isNumber(swapAfter) ? swapAfter : 0;
	return Math.max(0, steps[i].actualSeconds - swap);
}

export interface Totals {
	sessions: number;
	/** Time with the dilators, in seconds. */
	seconds: number;
	/** Sessions done in the last 7 days. */
	thisWeek: number;
}

export function totals(log: LogEntry[], now: number): Totals {
	const done = doneSessions(log);
	const weekAgo = now - 7 * 86_400_000;
	return {
		sessions: done.length,
		seconds: done.reduce(
			(sum, e) => sum + e.steps.reduce((s, _, i) => s + holdSeconds(e.steps, i), 0),
			0
		),
		thisWeek: done.filter((e) => e.finishedAt >= weekAgo).length
	};
}

/** How long it took from starting a session to pressing Ready, session after session. */
export function readyStats(log: LogEntry[]): Series | null {
	const values = doneSessions(log)
		.map((e) => e.steps[0]?.readySeconds)
		.filter(isNumber);
	return seriesOf(values);
}

export interface SwapStats {
	/** Every swap together. */
	all: Series | null;
	/** Per dilator: how long it took to get to it. */
	byLabel: { label: string; series: Series }[];
}

export function swapStats(log: LogEntry[]): SwapStats {
	const perLabel = new Map<string, number[]>();
	const all: number[] = [];
	for (const entry of doneSessions(log)) {
		for (const st of entry.steps) {
			if (!realSwap(st)) continue;
			all.push(st.switchSeconds!);
			perLabel.set(st.label, [...(perLabel.get(st.label) ?? []), st.switchSeconds!]);
		}
	}
	return {
		all: seriesOf(all),
		byLabel: [...perLabel].map(([label, values]) => ({
			label,
			series: seriesOf(values)!
		}))
	};
}

export interface HoldStats {
	label: string;
	sessions: number;
	/** Average time with it, in seconds. */
	averageSeconds: number;
	/** All the time you have spent with it, in seconds. */
	totalSeconds: number;
	plannedMinutes: number;
}

/** Per dilator: how often it was done and how long you stayed with it (the planned length of the latest). */
export function holdStats(log: LogEntry[]): HoldStats[] {
	const perLabel = new Map<string, { seconds: number[]; planned: number }>();
	for (const entry of doneSessions(log)) {
		entry.steps.forEach((st, i) => {
			const mine = perLabel.get(st.label) ?? { seconds: [], planned: st.plannedMinutes };
			mine.seconds.push(holdSeconds(entry.steps, i));
			mine.planned = st.plannedMinutes;
			perLabel.set(st.label, mine);
		});
	}
	return [...perLabel].map(([label, { seconds, planned }]) => {
		const total = seconds.reduce((a, b) => a + b, 0);
		return {
			label,
			sessions: seconds.length,
			averageSeconds: Math.round(total / seconds.length),
			totalSeconds: total,
			plannedMinutes: planned
		};
	});
}

export interface SessionSummary {
	/** Time with the dilators, in seconds. */
	heldSeconds: number;
	plannedMinutes: number;
	/** From pressing Start to the last timer ending, in seconds. */
	totalSeconds: number;
	readySeconds?: number;
	steps: { label: string; nickname?: string; color?: string; heldSeconds: number }[];
	/** The swap before each dilator after the first, in order. */
	swaps: { label: string; nickname?: string; seconds: number }[];
	averageSwapSeconds?: number;
}

/** What the end screen shows about a session that has just finished, or null while it is still going. */
export function summarizeSession(s: ActiveSession): SessionSummary | null {
	if (s.phase !== 'finished') return null;
	const end = alertStart(s);
	const swapBefore = (i: number) => s.records[i]?.switchedAfterMs;
	const steps = s.records.map((r, i) => {
		const next = swapBefore(i + 1);
		const ran = ((r.endedAt ?? end) - r.startedAt) / 1000;
		return {
			label: r.label,
			nickname: r.nickname,
			color: r.color,
			heldSeconds: Math.max(0, Math.round(ran - (isNumber(next) ? next / 1000 : 0)))
		};
	});
	const swaps = s.records.flatMap((r, i) =>
		i > 0 && isNumber(r.switchedAfterMs)
			? [{ label: r.label, nickname: r.nickname, seconds: Math.round(r.switchedAfterMs / 1000) }]
			: []
	);
	const ready = s.records[0]?.readyAfterMs;
	return {
		heldSeconds: steps.reduce((sum, st) => sum + st.heldSeconds, 0),
		plannedMinutes: s.records.reduce((sum, r) => sum + r.plannedMinutes, 0),
		totalSeconds: Math.max(0, Math.round((end - s.startedAt) / 1000)),
		...(isNumber(ready) ? { readySeconds: Math.round(ready / 1000) } : {}),
		steps,
		swaps,
		...(swaps.length
			? {
					averageSwapSeconds: Math.round(
						swaps.reduce((sum, w) => sum + w.seconds, 0) / swaps.length
					)
				}
			: {})
	};
}

/** Only ever kind: a nice line when this session beat your usual, nothing when it did not. */
export function praise(summary: SessionSummary, log: LogEntry[]): string[] {
	const lines: string[] = [];
	const swaps = swapStats(log).all;
	const quicker = (now: number, usual: number) => usual >= 20 && now <= usual * 0.85;
	if (swaps && summary.averageSwapSeconds !== undefined && swaps.values.length >= 3) {
		if (quicker(summary.averageSwapSeconds, swaps.typical)) {
			lines.push('Your swaps were quicker than usual ♡');
		}
	}
	const ready = readyStats(log);
	if (ready && summary.readySeconds !== undefined && ready.values.length >= 3) {
		if (quicker(summary.readySeconds, ready.typical)) lines.push('Quicker to Ready than usual ♡');
	}
	return lines;
}

// ---- day by day

/**
 * How a day went:
 * - done: every planned session (or an extra one on a rest day);
 * - partial: some of the planned sessions;
 * - skipped: sessions marked as skipped, nothing done;
 * - missed: sessions were planned, none done, and the day is over;
 * - pending: today, with sessions planned and none done yet;
 * - rest: a rest day; none: no phase covers the day; before: before Day 1.
 */
export type DayKind =
	'done' | 'partial' | 'skipped' | 'missed' | 'pending' | 'rest' | 'none' | 'before';

export interface DayCell {
	date: string;
	kind: DayKind;
	/** Sessions done that day. */
	sessions: number;
	/** Sessions the schedule planned for the day. */
	planned: number;
	/** Time with the dilators, in seconds. */
	seconds: number;
	isToday: boolean;
}

/** The `count` days up to and including `today`, oldest first. */
export function dayCells(
	settings: Settings,
	log: LogEntry[],
	today: string,
	count: number
): DayCell[] {
	const byDate = new Map<string, LogEntry[]>();
	for (const e of log) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
	return Array.from({ length: count }, (_, i) => {
		const date = addDays(today, i - (count - 1));
		const entries = byDate.get(date) ?? [];
		const done = entries.filter((e) => !e.skipped);
		const skipped = entries.length - done.length;
		const phase = phaseForDate(settings, date);
		const planned = phase?.slots.length ?? 0;
		const seconds = done.reduce(
			(sum, e) => sum + e.steps.reduce((t, _, k) => t + holdSeconds(e.steps, k), 0),
			0
		);
		let kind: DayKind;
		if (dayNumber(settings.startDate, date) < 1) kind = 'before';
		else if (done.length > 0) kind = planned > 0 && done.length < planned ? 'partial' : 'done';
		else if (skipped > 0) kind = 'skipped';
		else if (planned === 0) kind = phase && isRestPhase(phase) ? 'rest' : 'none';
		else kind = date === today ? 'pending' : 'missed';
		return { date, kind, sessions: done.length, planned, seconds, isToday: date === today };
	});
}

/** 0 for Monday .. 6 for Sunday. */
export function weekdayIndex(date: string): number {
	const [y, m, d] = date.split('-').map(Number);
	return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export interface Consistency {
	/** Days with at least one session. */
	activeDays: number;
	/** Days in the stretch that were part of the schedule (up to today). */
	days: number;
	/** Planned sessions that were done, and how many were planned, over that stretch. */
	doneSessions: number;
	plannedSessions: number;
	/** Days on which every planned session was done. */
	perfectDays: number;
	/** Days that had sessions planned (today only once it is done): what `perfectDays` is out of. */
	plannedDays: number;
}

/** How steady you have been over some days. Today only counts for what is already done. */
export function consistency(cells: DayCell[]): Consistency {
	const counted = cells.filter((c) => c.kind !== 'before');
	const done = (c: DayCell) => Math.min(c.sessions, c.planned);
	const asked = (c: DayCell) => (c.isToday ? done(c) : c.planned);
	return {
		activeDays: counted.filter((c) => c.sessions > 0).length,
		days: counted.length,
		doneSessions: counted.reduce((sum, c) => sum + done(c), 0),
		plannedSessions: counted.reduce((sum, c) => sum + asked(c), 0),
		perfectDays: counted.filter((c) => c.kind === 'done' && c.planned > 0).length,
		plannedDays: counted.filter((c) => c.planned > 0 && (!c.isToday || c.sessions >= c.planned))
			.length
	};
}

const sessionsWord = (n: number) => `${n} session${n === 1 ? '' : 's'}`;

/** How full a day's square is, 0 to 100: the share of the day's planned sessions that were done. */
export function dayFill(c: DayCell): number {
	if (c.planned > 0) return Math.round(Math.min(1, c.sessions / c.planned) * 100);
	return c.sessions > 0 ? 100 : 0; // an extra session on a day with nothing planned
}

/** What to say about a day, for hovering over it and for screen readers. */
export function dayLabel(c: DayCell): string {
	const time = c.seconds > 0 ? `, ${describeSeconds(c.seconds)}` : '';
	if (c.sessions > 0) {
		if (c.planned === 0) return `${sessionsWord(c.sessions)} (nothing was planned)${time}`;
		if (c.sessions > c.planned) {
			return `${sessionsWord(c.sessions)}, ${c.planned} planned${time}`;
		}
		return `${c.sessions} of ${sessionsWord(c.planned)} planned${time}`;
	}
	switch (c.kind) {
		case 'missed':
			return `none of ${sessionsWord(c.planned)} planned`;
		case 'pending':
			return `${sessionsWord(c.planned)} planned, not done yet`;
		case 'skipped':
			return 'skipped';
		case 'rest':
			return 'rest day, nothing planned';
		case 'none':
			return 'nothing planned';
		default:
			return '';
	}
}
