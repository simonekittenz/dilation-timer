import type { ActiveSession, LogEntry, SlotId, Step } from './types';

export const WARN_MS = 10_000;

export function startSession(
	steps: Step[],
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
		records: [
			{ label: steps[0].label, plannedMinutes: steps[0].minutes, startedAt: now, endedAt: null }
		]
	};
}

export function stepDurationMs(s: ActiveSession): number {
	return s.steps[s.stepIndex].minutes * 60_000;
}

/** Positive while counting down, negative once overtime. */
export function remainingMs(s: ActiveSession, now: number): number {
	return s.stepStartedAt + stepDurationMs(s) - now;
}

/** Time left in the calm window after the timer elapsed (<= 0 once the alarm should escalate). */
export function leewayLeftMs(s: ActiveSession, now: number, leewayMs: number): number {
	return leewayMs + remainingMs(s, now);
}

export function isEscalated(s: ActiveSession, now: number, leewayMs: number): boolean {
	return s.phase !== 'running' && leewayLeftMs(s, now, leewayMs) <= 0;
}

export function isLastStep(s: ActiveSession): boolean {
	return s.stepIndex === s.steps.length - 1;
}

/** Advances a running session to `switch` / `finished` once its timer elapses. */
export function tick(s: ActiveSession, now: number): ActiveSession {
	if (s.phase !== 'running') return s;
	const left = remainingMs(s, now);
	if (left <= 0) return { ...s, phase: isLastStep(s) ? 'finished' : 'switch' };
	if (left <= WARN_MS && !s.warned) return { ...s, warned: true };
	return s;
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
		stepIndex: s.stepIndex + 1,
		stepStartedAt: now,
		records: [
			...closeCurrent(s, now),
			{ label: next.label, plannedMinutes: next.minutes, startedAt: now, endedAt: null }
		]
	};
}

export function finish(s: ActiveSession, now: number): LogEntry {
	const records = closeCurrent(s, now);
	return {
		id: s.id,
		date: s.date,
		slot: s.slot,
		startedAt: s.startedAt,
		finishedAt: now,
		steps: records.map((r) => ({
			label: r.label,
			plannedMinutes: r.plannedMinutes,
			actualSeconds: Math.round(((r.endedAt ?? now) - r.startedAt) / 1000)
		}))
	};
}
