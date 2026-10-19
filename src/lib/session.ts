import type { ActiveSession, LogEntry, SessionStep, SlotId } from './types';

export const WARN_MS = 10_000;
export const ADJUST_MS = 60_000;

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

/** "I switched the dilator" — closes the current step and starts the next timer. */
export function confirmSwitch(s: ActiveSession, now: number): ActiveSession {
	if (s.phase !== 'switch') return s;
	const next = s.steps[s.stepIndex + 1];
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
				endedAt: null
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
			actualSeconds: Math.round(((r.endedAt ?? now) - r.startedAt) / 1000)
		}))
	};
}
