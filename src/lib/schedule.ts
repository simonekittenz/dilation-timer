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
