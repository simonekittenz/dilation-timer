import { dayNumber } from './dates';
import { isRestPhase, phaseForDay } from './schedule';
import type { Dilator, Phase, Settings } from './types';

/** How many days into a phase its "new dilator" message is still offered, if it wasn't answered. */
export const INTRO_FOR_DAYS = 3;

export interface NewDilator {
	dilator: Dilator;
	/** Minutes with this dilator in one session of the phase that introduces it. */
	minutes: number;
}

export interface DilatorIntro {
	phase: Phase;
	/** The sessions in this phase per day. */
	sessionsPerDay: number;
	dilators: NewDilator[];
}

/** What the user has already answered, per dilator. Includes the surgery date like milestones do. */
export function introKey(startDate: string, dilatorId: string): string {
	return `${startDate}:${dilatorId}`;
}

/**
 * The dilators a phase uses that no earlier phase used: its first appearance in the schedule.
 * Rest weeks use nothing, so a dilator that only shows up after a rest week is new again only if
 * it never appeared before.
 */
export function newDilatorIds(phases: Phase[], phase: Phase): string[] {
	if (isRestPhase(phase)) return [];
	const used = new Set(
		phases
			.filter((p) => p.id !== phase.id && p.fromDay < phase.fromDay && !isRestPhase(p))
			.flatMap((p) => p.steps.map((s) => s.dilatorId))
	);
	return [...new Set(phase.steps.map((s) => s.dilatorId))].filter((id) => !used.has(id));
}

/**
 * The "new dilator appears!" message to show today, or null. It is only for a phase that brings in a
 * dilator for the first time, not for any phase change, and only in the first few days of that phase.
 */
export function pendingIntro(
	settings: Settings,
	today: string,
	answered: readonly string[] = []
): DilatorIntro | null {
	const day = dayNumber(settings.startDate, today);
	const phase = phaseForDay(settings.phases, day);
	if (!phase || day - phase.fromDay > INTRO_FOR_DAYS) return null;
	const dilators: NewDilator[] = [];
	for (const id of newDilatorIds(settings.phases, phase)) {
		const dilator = settings.dilators.find((d) => d.id === id);
		if (!dilator || answered.includes(introKey(settings.startDate, id))) continue;
		const minutes = phase.steps
			.filter((s) => s.dilatorId === id)
			.reduce((sum, s) => sum + s.minutes, 0);
		dilators.push({ dilator, minutes });
	}
	if (dilators.length === 0) return null;
	return { phase, sessionsPerDay: phase.slots.length, dilators };
}

/** "once a day", "twice a day", "3 times a day". */
export function timesPerDay(n: number): string {
	if (n === 1) return 'once a day';
	if (n === 2) return 'twice a day';
	return `${n} times a day`;
}
