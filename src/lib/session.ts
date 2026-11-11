import type { ActiveSession, LogEntry, SessionStep, SlotId } from './types';

export const WARN_MS = 10_000;
export const ADJUST_MS = 60_000;

/**
 * The gentle switch window: one number for every swap, or a function that gives the window before each
 * dilator (so it can depend on how long you usually take to switch to it).
 */
export type SwitchWindows = number | ((toStep: number) => number);
const windowBefore = (windows: SwitchWindows, step: number) =>
	typeof windows === 'function' ? windows(step) : windows;

export function startSession(
	steps: SessionStep[],
	slot: SlotId | null,
	date: string,
	now: number,
	id: string = crypto.randomUUID()
): ActiveSession {
	return {
		id,
		date,
		slot,
		startedAt: now,
		steps,
		stepIndex: 0,
		stepStartedAt: now,
		phase: 'running',
		warned: false,
		pausedAt: null,
		adjustMs: 0,
		alertSince: null,
		records: [
			{
				label: steps[0].label,
				nickname: steps[0].nickname,
				color: steps[0].color,
				plannedMinutes: steps[0].minutes,
				startedAt: now,
				endedAt: null
			}
		]
	};
}

/** Length of the current step, including any +/- minute adjustments. */
export function stepDurationMs(s: ActiveSession): number {
	return s.steps[s.stepIndex].minutes * 60_000 + (s.adjustMs ?? 0);
}

export function plannedEnd(s: ActiveSession): number {
	return s.stepStartedAt + stepDurationMs(s);
}

export function isPaused(s: ActiveSession): boolean {
	return s.phase === 'running' && s.pausedAt != null;
}

/** Positive while counting down. A paused timer is frozen at the moment it was paused. */
export function remainingMs(s: ActiveSession, now: number): number {
	return plannedEnd(s) - (s.pausedAt ?? now);
}

/** When the "time to switch" state began: the planned end, or the moment you skipped ahead. */
export function alertStart(s: ActiveSession): number {
	return s.alertSince ?? plannedEnd(s);
}

export function overtimeMs(s: ActiveSession, now: number): number {
	return Math.max(0, now - alertStart(s));
}

/**
 * When the gentle switch window ends and the alarm escalates: the switch window after the timer
 * ended, pushed back by any "+1 min" presses, or by "Chill out, I'm on it" (whichever is later).
 */
export function escalateAt(s: ActiveSession, switchWindowMs: number): number {
	return Math.max(alertStart(s) + switchWindowMs + (s.windowExtraMs ?? 0), s.quietUntil ?? 0);
}

/** Time left in the switch window after the timer ended (<= 0 once the alarm should escalate). */
export function switchWindowLeftMs(s: ActiveSession, now: number, switchWindowMs: number): number {
	return escalateAt(s, switchWindowMs) - now;
}

/** Only the "swap to the next dilator" prompt escalates; finishing the last dilator never nags. */
export function isEscalated(s: ActiveSession, now: number, switchWindowMs: number): boolean {
	return s.phase === 'switch' && switchWindowLeftMs(s, now, switchWindowMs) <= 0;
}

export const ADD_WINDOW_MS = 60_000;
/** If the switch window is set to 0, "Chill out" still buys this long. */
export const MIN_CHILL_MS = 60_000;

/** "+1 min" on the switch screen: more gentle time for this one switch, not the setting itself. */
export function extendSwitchWindow(
	s: ActiveSession,
	now: number,
	switchWindowMs: number
): ActiveSession {
	if (s.phase !== 'switch' || isEscalated(s, now, switchWindowMs)) return s;
	return { ...s, windowExtraMs: (s.windowExtraMs ?? 0) + ADD_WINDOW_MS };
}

/**
 * "Chill out, I'm on it!": ends the nagging and waits a fresh switch window before nudging again.
 * Only meaningful once the alarm has escalated.
 */
export function chillOut(s: ActiveSession, now: number, switchWindowMs: number): ActiveSession {
	if (!isEscalated(s, now, switchWindowMs)) return s;
	return { ...s, quietUntil: now + (switchWindowMs > 0 ? switchWindowMs : MIN_CHILL_MS) };
}

/**
 * When the whole session should be over, as a timestamp, or null once it already is.
 * It adds up the time left on this dilator and the planned time of the ones after it, as if you
 * carried on right now, plus an allowance for each swap still to come: the gentle switch window from
 * Settings (`switchWindowMs`). While you are waiting to switch, the swap in progress counts only what
 * is left of that window. While paused the estimate moves on with the clock.
 */
export function estimatedFinish(
	s: ActiveSession,
	now: number,
	windows: SwitchWindows = 0
): number | null {
	if (s.phase === 'finished') return null;
	const later = s.steps.slice(s.stepIndex + 1);
	const laterMs = later.reduce((sum, step) => sum + step.minutes * 60_000, 0);
	// the window before dilator `i`, for each of the swaps still to come
	const window = (from: number) =>
		s.steps.slice(from).reduce((sum, _, k) => sum + windowBefore(windows, from + k), 0);
	let swaps: number;
	let thisOne: number;
	if (s.phase === 'running') {
		thisOne = Math.max(0, remainingMs(s, now));
		swaps = window(s.stepIndex + 1); // one swap before every dilator still to come
	} else {
		// 'switch': this dilator is done; the swap to the next one is happening now
		thisOne = Math.max(0, switchWindowLeftMs(s, now, windowBefore(windows, s.stepIndex + 1)));
		swaps = window(s.stepIndex + 2);
	}
	return now + thisOne + swaps + laterMs;
}

export function isLastStep(s: ActiveSession): boolean {
	return s.stepIndex === s.steps.length - 1;
}

/** Advances a running session to `switch` / `finished` once its timer elapses. */
export function tick(s: ActiveSession, now: number): ActiveSession {
	if (s.phase !== 'running' || s.pausedAt != null) return s;
	const left = remainingMs(s, now);
	if (left <= 0) {
		return { ...s, phase: isLastStep(s) ? 'finished' : 'switch', alertSince: plannedEnd(s) };
	}
	if (left <= WARN_MS && !s.warned) return { ...s, warned: true };
	return s;
}

export function pause(s: ActiveSession, now: number): ActiveSession {
	if (s.phase !== 'running' || s.pausedAt != null) return s;
	return { ...s, pausedAt: now };
}

/** Continues a paused timer; the time spent paused doesn't count towards the step. */
export function resume(s: ActiveSession, now: number): ActiveSession {
	if (s.phase !== 'running' || s.pausedAt == null) return s;
	const gap = now - s.pausedAt;
	return {
		...s,
		pausedAt: null,
		stepStartedAt: s.stepStartedAt + gap,
		records: s.records.map((r, i) =>
			i === s.stepIndex ? { ...r, startedAt: r.startedAt + gap } : r
		)
	};
}

/** Adds or removes time on the current step. Refuses to cut it down to nothing. */
export function adjust(s: ActiveSession, deltaMs: number, now: number): ActiveSession {
	if (s.phase !== 'running') return s;
	if (remainingMs(s, now) + deltaMs < 1000) return s;
	const next = { ...s, adjustMs: (s.adjustMs ?? 0) + deltaMs };
	return { ...next, warned: remainingMs(next, now) <= WARN_MS ? s.warned : false };
}

/** Ends the current timer right now (e.g. "next dilator" or "I'm done early"). */
export function skipStep(s: ActiveSession, now: number): ActiveSession {
	if (s.phase !== 'running') return s;
	return {
		...s,
		pausedAt: null,
		phase: isLastStep(s) ? 'finished' : 'switch',
		alertSince: now
	};
}

function closeCurrent(s: ActiveSession, now: number) {
	return s.records.map((r, i) => (i === s.stepIndex ? { ...r, endedAt: now } : r));
}

/**
 * "I switched the dilator" — closes the current step and starts the next timer.
 * The swap is noted with how long it took and whether the nudge had started (given the switch window
 * that was in force) and whether you asked for more time, so the app can tell a slow swap from a forgotten one.
 */
export function confirmSwitch(
	s: ActiveSession,
	now: number,
	switchWindowMs?: number
): ActiveSession {
	if (s.phase !== 'switch') return s;
	const next = s.steps[s.stepIndex + 1];
	const switchedAfterMs = Math.max(0, now - alertStart(s));
	// "Chill out" only exists once the nudge has happened, so it counts as nudged even though it moves the time
	const nudged =
		switchWindowMs !== undefined &&
		(s.quietUntil != null || now >= escalateAt({ ...s, quietUntil: null }, switchWindowMs));
	const askedMore = (s.windowExtraMs ?? 0) > 0 || s.quietUntil != null;
	return {
		...s,
		phase: 'running',
		warned: false,
		pausedAt: null,
		adjustMs: 0,
		alertSince: null,
		windowExtraMs: 0,
		quietUntil: null,
		stepIndex: s.stepIndex + 1,
		stepStartedAt: now,
		records: [
			...closeCurrent(s, now),
			{
				label: next.label,
				nickname: next.nickname,
				color: next.color,
				plannedMinutes: next.minutes,
				startedAt: now,
				endedAt: null,
				switchedAfterMs,
				...(nudged ? { switchNudged: true } : {}),
				...(askedMore ? { switchAskedMore: true } : {})
			}
		]
	};
}

export function finish(s: ActiveSession, now: number): LogEntry {
	const records = closeCurrent(s, now);
	return {
		id: s.id,
		date: s.date,
		slot: s.slot,
		...(s.custom ? { custom: true } : {}),
		startedAt: s.startedAt,
		finishedAt: now,
		steps: records.map((r) => ({
			label: r.label,
			nickname: r.nickname,
			color: r.color,
			plannedMinutes: r.plannedMinutes,
			actualSeconds: Math.round(((r.endedAt ?? now) - r.startedAt) / 1000),
			...(r.switchedAfterMs !== undefined
				? { switchSeconds: Math.round(r.switchedAfterMs / 1000) }
				: {}),
			...(r.switchNudged ? { switchNudged: true } : {}),
			...(r.switchAskedMore ? { switchAskedMore: true } : {})
		}))
	};
}

export type OverviewStatus = 'done' | 'now' | 'later';

export interface OverviewRow {
	label: string;
	nickname?: string;
	color: string;
	/** Planned length, including any minutes added or taken off the dilator being timed. */
	minutes: number;
	status: OverviewStatus;
	startAt: number;
	endAt: number;
	/** The times come from a guess (the dilator hasn't started, or hasn't ended yet), not from the clock. */
	estimated: boolean;
}

export interface Overview {
	rows: OverviewRow[];
	startedAt: number;
	/** When the session should be done, or null once it is. */
	finishAt: number | null;
	plannedMinutes: number;
}

/**
 * The whole session at a glance: every dilator with its length and its start and end time. Dilators that
 * are done show when they really ran; the one being timed ends when its timer does; the ones after it are
 * planned back to back, with the gentle switch window between them (the same guess as `estimatedFinish`).
 */
export function sessionOverview(
	s: ActiveSession,
	now: number,
	windows: SwitchWindows = 0
): Overview {
	const rows: OverviewRow[] = [];
	let cursor = now;
	s.steps.forEach((step, i) => {
		const record = s.records[i];
		const base = { label: step.label, nickname: step.nickname, color: step.color };
		if (i < s.stepIndex || s.phase !== 'running') {
			if (i <= s.stepIndex) {
				// finished dilators: when they really ran (the last one ended when its timer did)
				const startAt = record?.startedAt ?? now;
				const endAt = record?.endedAt ?? (i === s.stepIndex ? alertStart(s) : startAt);
				rows.push({
					...base,
					minutes: step.minutes + (i === s.stepIndex ? (s.adjustMs ?? 0) / 60_000 : 0),
					status: 'done',
					startAt,
					endAt,
					estimated: false
				});
				cursor =
					s.phase === 'finished'
						? endAt
						: now + Math.max(0, switchWindowLeftMs(s, now, windowBefore(windows, s.stepIndex + 1)));
				return;
			}
		} else if (i === s.stepIndex) {
			const endAt = now + Math.max(0, remainingMs(s, now));
			rows.push({
				...base,
				minutes: stepDurationMs(s) / 60_000,
				status: 'now',
				startAt: record?.startedAt ?? s.stepStartedAt,
				endAt,
				estimated: true
			});
			cursor = endAt + windowBefore(windows, i + 1);
			return;
		}
		const startAt = cursor;
		const endAt = startAt + step.minutes * 60_000;
		rows.push({ ...base, minutes: step.minutes, status: 'later', startAt, endAt, estimated: true });
		cursor = endAt + windowBefore(windows, i + 1);
	});
	const plannedMinutes = Math.round(rows.reduce((sum, r) => sum + r.minutes, 0) * 10) / 10;
	return {
		rows,
		startedAt: s.startedAt,
		finishAt: s.phase === 'finished' ? null : (rows.at(-1)?.endAt ?? null),
		plannedMinutes
	};
}
