import { alertStart } from './session';
import type { ActiveSession, LogEntry } from './types';

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
	return [...perLabel].map(([label, { seconds, planned }]) => ({
		label,
		sessions: seconds.length,
		averageSeconds: Math.round(seconds.reduce((a, b) => a + b, 0) / seconds.length),
		plannedMinutes: planned
	}));
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
