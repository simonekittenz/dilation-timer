import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { defaultSettings } from './defaults';
import { wihDilators } from './dilators';
import {
	REMINDER_DAYS,
	REMINDER_ID,
	REMINDER_IDS,
	SNOOZE_ID,
	atLocalTime,
	defaultReminders,
	normalizeReminders,
	planReminders,
	slotsInSchedule
} from './reminders';
import { PLAN_IDS, TEST_ALERT_ID } from './backgroundAlerts';
import type { LogEntry, Settings } from './types';

const START = '2026-01-01';
const onDay = (n: number) => addDays(START, n - 1);

function settings(reminders = defaultReminders()): Settings {
	return {
		...defaultSettings(),
		startDate: START,
		setup: 'done',
		dilators: wihDilators(),
		reminders
	};
}

/** Local noon on schedule day `n`: a time well before the evening reminders and after the morning ones. */
const noon = (n: number) => atLocalTime(onDay(n), '12:00');
const early = (n: number) => atLocalTime(onDay(n), '06:00');

const entry = (date: string, slot: LogEntry['slot'], skipped = false): LogEntry => ({
	id: `${date}-${slot}`,
	date,
	slot,
	startedAt: 0,
	finishedAt: 0,
	skipped,
	steps: []
});

describe('planReminders', () => {
	it('plans one reminder per session at the chosen time, with the routine in it', () => {
		const plan = planReminders(settings(), [], early(15), 1); // week 2: morning and evening
		expect(plan.map((p) => p.slot)).toEqual(['morning', 'evening']);
		expect(plan[0].at).toBe(atLocalTime(onDay(15), '08:00'));
		expect(plan[1].at).toBe(atLocalTime(onDay(15), '20:00'));
		expect(plan[0].title).toBe('Time for your morning session ♡');
		expect(plan[1].title).toBe('Time for your evening session ♡');
		expect(plan[0].body).toBe('Dilator 0 · 25 min, Dilator 1 · 50 min');
		expect(plan.every((p) => p.date === onDay(15))).toBe(true);
	});

	it('uses the times that were picked', () => {
		const s = settings({
			enabled: true,
			times: { morning: '07:15', evening: '21:30', daily: '09:00' }
		});
		const plan = planReminders(s, [], early(15), 1);
		expect(plan.map((p) => p.at)).toEqual([
			atLocalTime(onDay(15), '07:15'),
			atLocalTime(onDay(15), '21:30')
		]);
	});

	it('gives a once-a-day phase one reminder, titled without a time of day', () => {
		const plan = planReminders(settings(), [], early(9), 1); // week 1, day 2
		expect(plan).toHaveLength(1);
		expect(plan[0]).toMatchObject({ slot: 'daily', title: 'Time for your session ♡' });
		expect(plan[0].at).toBe(atLocalTime(onDay(9), '10:00'));
	});

	it('plans nothing for rest days, or when switched off, or while setting up', () => {
		expect(planReminders(settings(), [], early(3), 1)).toEqual([]);
		expect(
			planReminders(settings({ ...defaultReminders(), enabled: false }), [], early(15))
		).toEqual([]);
		expect(planReminders({ ...settings(), reminders: undefined }, [], early(15))).toEqual([]);
		expect(planReminders({ ...settings(), setup: 'confirm' }, [], early(15))).toEqual([]);
	});

	it('leaves out a time that has already passed today', () => {
		const plan = planReminders(settings(), [], noon(15), 1);
		expect(plan.map((p) => p.slot)).toEqual(['evening']);
	});

	it('leaves out sessions that are already done or skipped', () => {
		const date = onDay(15);
		expect(
			planReminders(settings(), [entry(date, 'morning')], early(15), 1).map((p) => p.slot)
		).toEqual(['evening']);
		expect(
			planReminders(settings(), [entry(date, 'morning', true)], early(15), 1).map((p) => p.slot)
		).toEqual(['evening']);
		expect(
			planReminders(settings(), [entry(date, 'morning'), entry(date, 'evening')], early(15), 1)
		).toEqual([]);
	});

	it('plans two weeks ahead and skips the rest days in between', () => {
		const plan = planReminders(settings(), [], early(1)); // day 1 is a rest day; dilation starts on day 8
		const days = new Set(plan.map((p) => p.date));
		expect(days.has(onDay(7))).toBe(false);
		expect(days.has(onDay(8))).toBe(true);
		expect(Math.max(...plan.map((p) => p.at))).toBeLessThan(
			atLocalTime(onDay(1 + REMINDER_DAYS), '00:00')
		);
	});

	it('follows a phase change: one a day, then two a day', () => {
		const plan = planReminders(settings(), [], early(13)); // week 1 day 6, then week 2 starts on day 15
		const perDay = (n: number) => plan.filter((p) => p.date === onDay(n)).length;
		expect(perDay(13)).toBe(1);
		expect(perDay(14)).toBe(1);
		expect(perDay(15)).toBe(2);
	});

	it('gives every reminder its own id inside the reminder range, apart from alerts and the test', () => {
		const plan = planReminders(settings(), [], early(15));
		const ids = plan.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(REMINDER_IDS).toContain(id);
		expect(REMINDER_IDS[0]).toBe(REMINDER_ID);
		for (const id of [...PLAN_IDS, TEST_ALERT_ID, SNOOZE_ID])
			expect(REMINDER_IDS).not.toContain(id);
		expect(REMINDER_IDS).toHaveLength(REMINDER_DAYS * 3);
	});

	it('stays under the iPhone limit of 64 pending notifications, even with the alerts and a snooze', () => {
		const plan = planReminders(settings(), [], early(15));
		expect(plan.length + PLAN_IDS.length + 2).toBeLessThan(64);
	});
});

describe('slotsInSchedule', () => {
	it('lists the parts of the day the schedule uses, in order', () => {
		expect(slotsInSchedule(settings())).toEqual(['morning', 'evening', 'daily']);
		const s = settings();
		s.phases = s.phases.filter((p) => !p.slots.includes('daily'));
		expect(slotsInSchedule(s)).toEqual(['morning', 'evening']);
		s.phases = [];
		expect(slotsInSchedule(s)).toEqual([]);
	});
});

describe('normalizeReminders', () => {
	it('is undefined when never set up, and fills gaps from the defaults', () => {
		expect(normalizeReminders(undefined)).toBeUndefined();
		expect(normalizeReminders('nope')).toBeUndefined();
		expect(normalizeReminders({ enabled: true, times: { morning: '07:30' } })).toEqual({
			enabled: true,
			times: { morning: '07:30', evening: '20:00', daily: '10:00' }
		});
	});

	it('throws away broken times and treats anything but true as off', () => {
		const r = normalizeReminders({ enabled: 'yes', times: { morning: '25:00', evening: 'late' } })!;
		expect(r.enabled).toBe(false);
		expect(r.times).toEqual(defaultReminders().times);
	});
});
