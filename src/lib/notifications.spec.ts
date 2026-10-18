import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALERT_ID, type BackgroundAlert } from './backgroundAlerts';
import {
	armAlerts,
	CHANNELS,
	disarmAlerts,
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
		cancel: vi.fn(async () => void calls.push('cancel')),
		removeAllDeliveredNotifications: vi.fn(async () => void calls.push('clear'))
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
});
