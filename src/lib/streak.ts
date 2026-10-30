import { isRestPhase, phaseForDate, slotsForDate } from './schedule';
import { addDays, dayNumber } from './dates';
import type { LogEntry, Settings } from './types';

export interface Streak {
	/** Days in a row with every scheduled session done. Rest days neither add to it nor break it. */
	current: number;
	/** The longest run there has been. */
	best: number;
	/** Today has sessions that are not all done yet (so the streak can still grow today). */
	todayPending: boolean;
}

/**
 * A day counts when all of its scheduled sessions were done; a skipped or missing one ends the
 * run. Rest days (and days before the schedule or outside any phase) are passed over. Today is
 * never held against you: while it is unfinished the streak stands at what it was yesterday.
 * `graceDate` is a past day that may still be finished, for instance last night's evening session
 * (see `lateNightSession`), and is treated the same way.
 */
export function computeStreak(
	settings: Settings,
	log: LogEntry[],
	today: string,
	graceDate: string | null = null
): Streak {
	const none: Streak = { current: 0, best: 0, todayPending: false };
	const days = dayNumber(settings.startDate, today);
	if (!Number.isFinite(days) || days < 1) return none;

	let current = 0;
	let best = 0;
	let todayPending = false;
	// walk back from today only as far as the first log entry could matter
	const first = log.reduce((min, e) => (e.date < min ? e.date : min), today);
	const from = first < settings.startDate ? settings.startDate : first;
	for (let date = from; date <= today; date = addDays(date, 1)) {
		const phase = phaseForDate(settings, date);
		if (!phase || isRestPhase(phase)) continue;
		const slots = slotsForDate(settings, date, '00:00', log);
		if (slots.every((s) => s.status === 'done')) {
			current++;
			best = Math.max(best, current);
		} else if (date === today) {
			todayPending = true;
		} else if (date !== graceDate) {
			current = 0;
		}
	}
	return { current, best, todayPending };
}
