import { dayNumber } from './dates';
import type { LogEntry, Phase, Settings, SlotView } from './types';

export function phaseForDay(phases: Phase[], day: number): Phase | undefined {
	return phases.find((p) => day >= p.fromDay && (p.toDay === null || day <= p.toDay));
}

export function phaseForDate(settings: Settings, date: string): Phase | undefined {
	return phaseForDay(settings.phases, dayNumber(settings.startDate, date));
}

/** Today's slots with done/overdue/upcoming status, derived from the log. */
export function slotsForDate(
	settings: Settings,
	date: string,
	nowTime: string,
	log: LogEntry[]
): SlotView[] {
	const phase = phaseForDate(settings, date);
	if (!phase) return [];
	const claimed = new Set<string>();
	return [...phase.times].sort().map((time) => {
		const entry = log.find((e) => e.date === date && e.slot === time && !claimed.has(e.id));
		if (entry) {
			claimed.add(entry.id);
			return { time, status: 'done', entry };
		}
		return { time, status: time <= nowTime ? 'overdue' : 'upcoming' };
	});
}

export function nextOpenSlot(slots: SlotView[]): SlotView | undefined {
	return slots.find((s) => s.status !== 'done');
}
