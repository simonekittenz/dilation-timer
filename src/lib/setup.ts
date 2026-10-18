import { addDays, dayNumber } from './dates';
import { daysUntilDilation, isRestPhase, phaseForDay } from './schedule';
import type { Phase, Settings } from './types';

export type WeekState =
	/** Surgery hasn't happened yet. */
	| 'before-surgery'
	/** A rest phase (e.g. the 7 days before dilation starts). */
	| 'rest'
	/** A phase with sessions. */
	| 'dilation'
	/** The date is so long ago (or the plan so short) that no phase covers today. */
	| 'beyond';

export interface WeekSummary {
	state: WeekState;
	/** Today's day number; below 1 means surgery is still ahead. */
	day: number;
	surgeryDate: string;
	phase?: Phase;
	/** The calendar dates of the current phase. `phaseEnd` is null when it keeps going. */
	phaseStart?: string;
	phaseEnd?: string | null;
	/** Before surgery: how many days to go. */
	daysUntilSurgery?: number;
	/** On a rest day: days until sessions start, and that date. */
	daysUntilDilation?: number | null;
	firstDilationDate?: string;
	/** On a dilation day. */
	sessionsPerDay?: number;
	minutesPerSession?: number;
}

/** Describes where `today` falls in the schedule, for the "does this look right?" question. */
export function summarizeWeek(settings: Settings, today: string): WeekSummary {
	const surgeryDate = settings.startDate;
	const day = dayNumber(surgeryDate, today);
	if (day < 1) {
		return { state: 'before-surgery', day, surgeryDate, daysUntilSurgery: 1 - day };
	}
	const phase = phaseForDay(settings.phases, day);
	if (!phase) return { state: 'beyond', day, surgeryDate };

	const base = {
		day,
		surgeryDate,
		phase,
		phaseStart: addDays(surgeryDate, phase.fromDay - 1),
		phaseEnd: phase.toDay === null ? null : addDays(surgeryDate, phase.toDay - 1)
	};
	if (isRestPhase(phase)) {
		const until = daysUntilDilation(settings.phases, day);
		return {
			...base,
			state: 'rest',
			daysUntilDilation: until,
			firstDilationDate: until === null ? undefined : addDays(today, until)
		};
	}
	return {
		...base,
		state: 'dilation',
		sessionsPerDay: phase.slots.length,
		minutesPerSession: Math.round(phase.steps.reduce((sum, s) => sum + s.minutes, 0) * 10) / 10
	};
}
