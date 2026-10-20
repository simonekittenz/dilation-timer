import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALERT_ID, PLAN_IDS, TEST_ALERT_ID, type BackgroundAlert } from './backgroundAlerts';
import { REMINDER_IDS, SNOOZE_ID, SNOOZE_MINUTES, type PlannedReminder } from './reminders';
import {
	armAlerts,
	CHANNELS,
	clearReminderNotifications,
	REMINDER_ACTION_TYPE,
	snoozeReminder,
	syncReminders,
	watchReminderActions,
	disarmAlerts,
	noteAppActive,
	TEST_ALERT_SHOWN_FOR_SECONDS,
	getAlertsPermission,
	notificationsAvailable,
	sendTestAlert,
	setNotificationsForTests,
	type NotificationsApi
} from './notifications';

interface Sent {
	id: number;
	channelId: string;
	schedule: { at: Date; allowWhileIdle: boolean };
}

function fake(display = 'granted') {
	const calls: string[] = [];
	const api = {
		checkPermissions: vi.fn(async () => ({ display })),
		requestPermissions: vi.fn(async () => ({ display: 'granted' })),
		createChannel: vi.fn(async (c: { id: string }) => void calls.push('channel:' + c.id)),
		schedule: vi.fn(async (_options: { notifications: Sent[] }) => void calls.push('schedule')),
		cancel: vi.fn(
			async (_options: { notifications: { id: number }[] }) => void calls.push('cancel')
		),
		removeDeliveredNotifications: vi.fn(
			async (_options: { notifications: { id: number }[] }) => void calls.push('clear')
		),
		registerActionTypes: vi.fn(async (_options: unknown) => void calls.push('actions')),
		addListener: vi.fn(
			async (_event: string, _listener: (a: unknown) => void) => void calls.push('listen')
		)
	};
	return { api: api as unknown as NotificationsApi & typeof api, calls };
}

const alerts: BackgroundAlert[] = [
	{ id: ALERT_ID, at: 100_000, kind: 'switch', title: 'Time to switch', body: 'b' },
	{ id: ALERT_ID + 1, at: 160_000, kind: 'nudge', title: 'Psst', body: 'b' }
];

afterEach(() => setNotificationsForTests(undefined));

describe('locked-screen alerts', () => {
	it('does nothing in a normal browser', async () => {
		expect(notificationsAvailable()).toBe(false);
		expect(await getAlertsPermission()).toBe('unavailable');
		await armAlerts(alerts, false);
		await disarmAlerts();
		expect(await sendTestAlert(false)).toBe(false);
	});

	it('schedules each alert at its exact time, allowed while the phone is asleep', async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		await armAlerts(alerts, false);
		const sent = api.schedule.mock.calls[0][0].notifications;
		expect(sent.map((n) => n.id)).toEqual([ALERT_ID, ALERT_ID + 1]);
		expect(sent[0].schedule.at.getTime()).toBe(100_000);
		expect(sent.every((n) => n.schedule.allowWhileIdle)).toBe(true);
		expect(sent.map((n) => n.channelId)).toEqual([CHANNELS.switch, CHANNELS.nudge]);
	});

	it('clears old alerts before scheduling new ones, so nothing is doubled', async () => {
		const { api, calls } = fake();
		setNotificationsForTests(api);
		await armAlerts(alerts, false);
		expect(calls.indexOf('cancel')).toBeLessThan(calls.indexOf('schedule'));
	});

	it('uses the silent channel when the volume is off', async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		await armAlerts(alerts, true);
		const sent = api.schedule.mock.calls[0][0].notifications;
		expect(sent.every((n) => n.channelId === CHANNELS.quiet)).toBe(true);
	});

	it('schedules nothing without permission', async () => {
		const { api } = fake('denied');
		setNotificationsForTests(api);
		await armAlerts(alerts, false);
		expect(api.schedule).not.toHaveBeenCalled();
		expect(await getAlertsPermission()).toBe('denied');
		expect(await sendTestAlert(false)).toBe(false);
	});

	it('coming back to the app cancels what is scheduled and what is showing', async () => {
		const { api, calls } = fake();
		setNotificationsForTests(api);
		await disarmAlerts();
		expect(calls).toEqual(['cancel', 'clear']);
	});

	it('arming with an empty plan just clears', async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		await armAlerts([], false);
		expect(api.schedule).not.toHaveBeenCalled();
		expect(api.cancel).toHaveBeenCalled();
	});

	it('goes to the background and straight back: the last call wins, in order', async () => {
		const { api, calls } = fake();
		setNotificationsForTests(api);
		void armAlerts(alerts, false);
		await disarmAlerts();
		expect(calls.at(-2)).toBe('cancel');
		expect(calls.at(-1)).toBe('clear');
		expect(calls.indexOf('schedule')).toBeLessThan(calls.lastIndexOf('cancel'));
	});

	it('survives the plugin failing', async () => {
		const { api } = fake();
		api.schedule.mockRejectedValue(new Error('boom'));
		setNotificationsForTests(api);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await expect(armAlerts(alerts, false)).resolves.toBeUndefined();
		warn.mockRestore();
	});

	it('the test alert fires about 10 seconds from now', async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		const now = Date.now();
		expect(await sendTestAlert(false)).toBe(true);
		const at = api.schedule.mock.calls[0][0].notifications[0].schedule.at.getTime();
		expect(at - now).toBeGreaterThanOrEqual(9_000);
		expect(at - now).toBeLessThanOrEqual(11_000);
	});

	it("the Settings test alert is not one of a session's alert ids", () => {
		expect(PLAN_IDS).not.toContain(TEST_ALERT_ID);
		expect(PLAN_IDS).toContain(ALERT_ID);
	});

	it('leaving the app after "Send a test" does not cancel a test that is still to go off (the bug: it did)', async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		expect(await sendTestAlert(false)).toBe(true);
		// what the app does as the phone is locked, and again when it is opened
		await armAlerts([], false);
		await armAlerts(alerts, false);
		await disarmAlerts();
		const cancelled = api.cancel.mock.calls.flatMap((c) =>
			c[0].notifications.map((n: { id: number }) => n.id)
		);
		expect(cancelled.length).toBeGreaterThan(0);
		expect(cancelled).not.toContain(TEST_ALERT_ID); // cancelling would stop it from ever firing
		expect(api.schedule.mock.calls[0][0].notifications[0].id).toBe(TEST_ALERT_ID);
	});

	it('coming back to the app takes a test alert that already went off off the screen (no dot left on the icon)', async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		await disarmAlerts();
		const removed = api.removeDeliveredNotifications.mock.calls.flatMap((c) =>
			c[0].notifications.map((n: { id: number }) => n.id)
		);
		expect(removed).toContain(TEST_ALERT_ID);
		for (const id of PLAN_IDS) expect(removed).toContain(id);
	});

	it("a session's alerts are all cleared when coming back to the app", async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		await disarmAlerts();
		const cancelled = api.cancel.mock.calls[0][0].notifications.map((n: { id: number }) => n.id);
		for (const id of PLAN_IDS) expect(cancelled).toContain(id);
	});

	describe('a test alert you watch go off with the app open', () => {
		const wait = (s: number) => vi.advanceTimersByTimeAsync(s * 1000);
		const removedIds = (api: ReturnType<typeof fake>['api']) =>
			api.removeDeliveredNotifications.mock.calls.flatMap((c) =>
				c[0].notifications.map((n: { id: number }) => n.id)
			);

		afterEach(() => {
			vi.useRealTimers();
			noteAppActive(true);
		});

		it('is taken down a few seconds after it went off, so it leaves no dot behind', async () => {
			vi.useFakeTimers();
			const { api } = fake();
			setNotificationsForTests(api);
			noteAppActive(true);
			await sendTestAlert(false, 10);
			await wait(10 + TEST_ALERT_SHOWN_FOR_SECONDS - 1);
			expect(removedIds(api)).not.toContain(TEST_ALERT_ID);
			await wait(2);
			expect(removedIds(api)).toEqual([TEST_ALERT_ID]);
		});

		it('is left alone while you are away (coming back clears it instead)', async () => {
			vi.useFakeTimers();
			const { api } = fake();
			setNotificationsForTests(api);
			await sendTestAlert(false, 10);
			noteAppActive(false);
			await wait(60);
			expect(removedIds(api)).toEqual([]);
		});
	});
});

describe('daily reminders', () => {
	const planned: PlannedReminder[] = [
		{
			id: REMINDER_IDS[0],
			at: 1_000_000,
			slot: 'morning',
			date: '2026-01-15',
			title: 'Time for your morning session ♡',
			body: 'Dilator 0 · 25 min'
		},
		{
			id: REMINDER_IDS[1],
			at: 2_000_000,
			slot: 'evening',
			date: '2026-01-15',
			title: 'Time for your evening session ♡',
			body: 'Dilator 0 · 25 min'
		}
	];
	const idsOf = (calls: { notifications: { id: number }[] }[]) =>
		calls.flatMap((c) => c.notifications.map((n) => n.id));

	it('does nothing in a normal browser', async () => {
		await syncReminders(planned, false);
		expect(await snoozeReminder('morning', '2026-01-15', 't', 'b', false)).toBe(false);
		await clearReminderNotifications({ pendingSnooze: true });
		await watchReminderActions(() => {});
	});

	it('schedules each reminder with its three buttons and what they need to know', async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		await syncReminders(planned, false);
		const sent = api.schedule.mock.calls[0][0].notifications as unknown as Array<
			Sent & { actionTypeId: string; extra: Record<string, string>; title: string }
		>;
		expect(sent.map((n) => n.id)).toEqual([REMINDER_IDS[0], REMINDER_IDS[1]]);
		expect(sent[0].schedule.at.getTime()).toBe(1_000_000);
		expect(sent.every((n) => n.schedule.allowWhileIdle)).toBe(true);
		expect(sent.every((n) => n.channelId === CHANNELS.reminder)).toBe(true);
		expect(sent.every((n) => n.actionTypeId === REMINDER_ACTION_TYPE)).toBe(true);
		expect(sent[1].extra).toEqual({ slot: 'evening', date: '2026-01-15' });
		const types = (
			api.registerActionTypes.mock.calls[0][0] as {
				types: { actions: { id: string; title: string }[] }[];
			}
		).types;
		expect(types[0].actions.map((a) => a.id)).toEqual(['start', 'snooze', 'off']);
		expect(types[0].actions.map((a) => a.title)).toEqual([
			'Start session',
			'Remind me in 30 min',
			'Turn off'
		]);
	});

	it('replaces the old plan instead of adding to it, and never touches the alerts or a snooze', async () => {
		const { api, calls } = fake();
		setNotificationsForTests(api);
		await syncReminders(planned, false);
		expect(calls.indexOf('cancel')).toBeLessThan(calls.indexOf('schedule'));
		const cancelled = idsOf(api.cancel.mock.calls.map((c) => c[0]));
		for (const id of REMINDER_IDS) expect(cancelled).toContain(id);
		for (const id of [...PLAN_IDS, TEST_ALERT_ID, SNOOZE_ID]) expect(cancelled).not.toContain(id);
	});

	it('uses the silent channel when the volume is off', async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		await syncReminders(planned, true);
		const sent = api.schedule.mock.calls[0][0].notifications;
		expect(sent.every((n) => n.channelId === CHANNELS.quiet)).toBe(true);
	});

	it('an empty plan just clears, and no permission schedules nothing', async () => {
		const a = fake();
		setNotificationsForTests(a.api);
		await syncReminders([], false);
		expect(a.api.cancel).toHaveBeenCalled();
		expect(a.api.schedule).not.toHaveBeenCalled();

		const b = fake('denied');
		setNotificationsForTests(b.api);
		await syncReminders(planned, false);
		expect(b.api.schedule).not.toHaveBeenCalled();
	});

	it('"remind me in 30 minutes" schedules one more reminder, with the same buttons', async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		const now = 5_000_000;
		expect(await snoozeReminder('evening', '2026-01-15', 'Time ♡', 'Soon', false, now)).toBe(true);
		const sent = api.schedule.mock.calls[0][0].notifications as unknown as Array<
			Sent & { actionTypeId: string; extra: Record<string, string> }
		>;
		expect(sent).toHaveLength(1);
		expect(sent[0].id).toBe(SNOOZE_ID);
		expect(sent[0].schedule.at.getTime()).toBe(now + SNOOZE_MINUTES * 60_000);
		expect(sent[0].actionTypeId).toBe(REMINDER_ACTION_TYPE);
		expect(sent[0].extra).toEqual({ slot: 'evening', date: '2026-01-15' });
	});

	it('cannot snooze without permission', async () => {
		const { api } = fake('denied');
		setNotificationsForTests(api);
		expect(await snoozeReminder('evening', '2026-01-15', 't', 'b', false)).toBe(false);
	});

	it('takes shown reminders off the screen, and a waiting snooze away only when asked', async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		await clearReminderNotifications({ pendingSnooze: false });
		expect(api.cancel).not.toHaveBeenCalled();
		const shown = idsOf(api.removeDeliveredNotifications.mock.calls.map((c) => c[0]));
		for (const id of [...REMINDER_IDS, SNOOZE_ID]) expect(shown).toContain(id);

		await clearReminderNotifications({ pendingSnooze: true });
		expect(idsOf(api.cancel.mock.calls.map((c) => c[0]))).toEqual([SNOOZE_ID]);
	});

	it('turns a tapped button into start / snooze / off, and anything else into just opening', async () => {
		const { api } = fake();
		setNotificationsForTests(api);
		const seen: unknown[] = [];
		await watchReminderActions((action, extra) => seen.push([action, extra]));
		const listener = api.addListener.mock.calls[0][1] as (a: unknown) => void;
		const tap = (actionId: string, extra?: object) =>
			listener({ actionId, notification: { id: 1, extra } });
		tap('start', { slot: 'morning', date: '2026-01-15' });
		tap('snooze', { slot: 'evening', date: '2026-01-15' });
		tap('off', { slot: 'evening', date: '2026-01-15' });
		tap('tap', { slot: 7 });
		tap('tap');
		expect(seen).toEqual([
			['start', { slot: 'morning', date: '2026-01-15' }],
			['snooze', { slot: 'evening', date: '2026-01-15' }],
			['off', { slot: 'evening', date: '2026-01-15' }],
			['open', { slot: undefined, date: undefined }],
			['open', { slot: undefined, date: undefined }]
		]);
	});
});
