import { dayNumber } from './dates';
import type { LogEntry, Phase, Settings, SlotId, SlotStatus, SlotView } from './types';

export const SLOT_LABELS: Record<SlotId, string> = {
	morning: 'Morning',
	evening: 'Evening',
	daily: 'Today'
};

export const SLOT_EMOJI: Record<SlotId, string> = {
	morning: '☀️',
	evening: '🌙',
	daily: '🌸'
};

/**
 * When each part of the day opens, and when (if ever) an open slot counts as overdue.
 * Evening and daily slots can't go overdue: the day just ends.
 */
const WINDOWS: Record<SlotId, { opensAt: string; overdueAt: string | null }> = {
	morning: { opensAt: '00:00', overdueAt: '12:00' },
	evening: { opensAt: '17:00', overdueAt: null },
	daily: { opensAt: '00:00', overdueAt: null }
};

export function phaseForDay(phases: Phase[], day: number): Phase | undefined {
	return phases.find((p) => day >= p.fromDay && (p.toDay === null || day <= p.toDay));
}

export function phaseForDate(settings: Settings, date: string): Phase | undefined {
	return phaseForDay(settings.phases, dayNumber(settings.startDate, date));
}

export type PhaseProgress = 'past' | 'current' | 'upcoming';

/** Where a phase sits relative to `day`. Only the phase that wins the lookup counts as current. */
export function phaseProgress(phases: Phase[], phase: Phase, day: number): PhaseProgress {
	if (phaseForDay(phases, day)?.id === phase.id) return 'current';
	if (phase.toDay !== null && day > phase.toDay) return 'past';
	return 'upcoming';
}

/** Whether a phase has anything to do (rest weeks have no sessions). */
export function isRestPhase(p: Phase): boolean {
	return p.slots.length === 0 || p.steps.length === 0;
}

/** Days until the next phase with sessions begins (the first dilation day, when called on a rest day), or null if none is left. */
export function daysUntilDilation(phases: Phase[], day: number): number | null {
	const upcoming = phases
		.filter((p) => !isRestPhase(p) && p.fromDay > day)
		.map((p) => p.fromDay - day);
	return upcoming.length ? Math.min(...upcoming) : null;
}

function statusFor(slot: SlotId, nowTime: string): SlotStatus {
	const w = WINDOWS[slot];
	if (w.overdueAt && nowTime >= w.overdueAt) return 'overdue';
	return nowTime >= w.opensAt ? 'due' : 'upcoming';
}

/** Today's slots with their status, derived from the log. */
export function slotsForDate(
	settings: Settings,
	date: string,
	nowTime: string,
	log: LogEntry[]
): SlotView[] {
	const phase = phaseForDate(settings, date);
	if (!phase) return [];
	const claimed = new Set<string>();
	return phase.slots.map((slot) => {
		const entry = log.find(
			(e) =>
				e.date === date &&
				!claimed.has(e.id) &&
				(slot === 'daily' ? e.slot !== null : e.slot === slot)
		);
		const label = SLOT_LABELS[slot];
		if (entry) {
			claimed.add(entry.id);
			return { slot, label, status: entry.skipped ? 'skipped' : 'done', entry };
		}
		return { slot, label, status: statusFor(slot, nowTime) };
	});
}

export function isOpen(s: SlotView): boolean {
	return s.status !== 'done' && s.status !== 'skipped';
}

export function nextOpenSlot(slots: SlotView[]): SlotView | undefined {
	return slots.find(isOpen);
}
