import { addDays, toDateString } from './dates';
import { resolveSteps } from './dilators';
import { isRestPhase, phaseForDate, slotsForDate } from './schedule';
import type { LogEntry, Reminders, Settings, SlotId } from './types';

/** Reminders get ids in this range, so they can all be found and cancelled again. */
export const REMINDER_ID = 42_000;
/** How many days ahead are scheduled. The plan is redone every time the app is opened. */
export const REMINDER_DAYS = 14;
export const SLOT_ORDER: readonly SlotId[] = ['morning', 'evening', 'daily'];
/** Every id a plan can use. */
export const REMINDER_IDS: readonly number[] = Array.from(
	{ length: REMINDER_DAYS * SLOT_ORDER.length },
	(_, i) => REMINDER_ID + i
);
/** The "remind me again" notification. Only one exists at a time. */
export const SNOOZE_ID = 43_000;
export const SNOOZE_MINUTES = 30;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function defaultReminders(): Reminders {
	return { enabled: true, times: { morning: '08:00', evening: '20:00', daily: '10:00' } };
}

/** Reads reminders from storage or a backup, whatever shape they are in. */
export function normalizeReminders(raw: unknown): Reminders | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const r = raw as { enabled?: unknown; times?: Partial<Record<SlotId, unknown>> };
	const base = defaultReminders();
	const times = { ...base.times };
	for (const slot of SLOT_ORDER) {
		const t = r.times?.[slot];
		if (typeof t === 'string' && TIME.test(t)) times[slot] = t;
	}
	return { enabled: r.enabled === true, times };
}

/** The parts of the day the schedule has sessions in, in the order of the day. */
export function slotsInSchedule(settings: Settings): SlotId[] {
	const used = new Set(
		settings.phases.filter((p) => !isRestPhase(p)).flatMap((p) => p.slots as SlotId[])
	);
	return SLOT_ORDER.filter((s) => used.has(s));
}

/** The moment a local date (YYYY-MM-DD) and time (HH:MM) fall on. */
export function atLocalTime(date: string, time: string): number {
	const [y, m, d] = date.split('-').map(Number);
	const [hh, mm] = time.split(':').map(Number);
	return new Date(y, m - 1, d, hh, mm).getTime();
}

export interface PlannedReminder {
	id: number;
	at: number;
	slot: SlotId;
	date: string;
	title: string;
	body: string;
}

const TITLES: Record<SlotId, string> = {
	morning: 'Time for your morning session ♡',
	evening: 'Time for your evening session ♡',
	daily: 'Time for your session ♡'
};

/**
 * The reminders to hand to the phone: one for every session in the next `REMINDER_DAYS` days that
 * is still to come, at the time chosen for its part of the day. Rest days get none, and neither does
 * a session that is already done or skipped.
 */
export function planReminders(
	settings: Settings,
	log: LogEntry[],
	now: number,
	days = REMINDER_DAYS
): PlannedReminder[] {
	const reminders = settings.reminders;
	if (!reminders?.enabled || (settings.setup ?? 'done') !== 'done') return [];
	const today = toDateString(new Date(now));
	const planned: PlannedReminder[] = [];
	for (let k = 0; k < days; k++) {
		const date = addDays(today, k);
		const phase = phaseForDate(settings, date);
		if (!phase || isRestPhase(phase)) continue;
		const body = resolveSteps(settings.dilators, phase.steps)
			.map((s) => `${s.label} · ${s.minutes} min`)
			.join(', ');
		for (const view of slotsForDate(settings, date, '00:00', log)) {
			if (view.status === 'done' || view.status === 'skipped') continue;
			const at = atLocalTime(date, reminders.times[view.slot]);
			if (at <= now) continue;
			planned.push({
				id: REMINDER_ID + k * SLOT_ORDER.length + SLOT_ORDER.indexOf(view.slot),
				at,
				slot: view.slot,
				date,
				title: TITLES[view.slot],
				body
			});
		}
	}
	return planned;
}
