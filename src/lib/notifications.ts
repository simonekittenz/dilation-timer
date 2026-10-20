import { PLAN_IDS, TEST_ALERT_ID, type AlertKind, type BackgroundAlert } from './backgroundAlerts';
import { isNative, nativePlatform } from './platform';
import { REMINDER_IDS, SNOOZE_ID, SNOOZE_MINUTES, type PlannedReminder } from './reminders';
import type { SlotId } from './types';

/**
 * Locked-screen alerts. When the app goes to the background the phone's own alarm clock is given a
 * few notifications to show at the right moments (see backgroundAlerts.ts); when the app comes
 * back they are cancelled again. Only the iOS/Android app does this; the website cannot.
 *
 * (This is the only place that talks to @capacitor/local-notifications. Its plugin object must
 * never be returned from a promise: it answers to every property name, including `then`.)
 */

export type AlertsPermission = 'granted' | 'denied' | 'prompt' | 'unavailable';

/** The few parts of the notification plugin we use (also what tests replace). */
export interface NotificationsApi {
	checkPermissions(): Promise<{ display: string }>;
	requestPermissions(): Promise<{ display: string }>;
	createChannel(channel: {
		id: string;
		name: string;
		description?: string;
		importance?: number;
		visibility?: number;
		sound?: string;
		vibration?: boolean;
	}): Promise<void>;
	schedule(options: { notifications: ScheduledNotification[] }): Promise<unknown>;
	cancel(options: { notifications: { id: number }[] }): Promise<void>;
	removeDeliveredNotifications(options: { notifications: { id: number }[] }): Promise<void>;
	registerActionTypes(options: {
		types: { id: string; actions: { id: string; title: string; foreground?: boolean }[] }[];
	}): Promise<void>;
	addListener(
		event: 'localNotificationActionPerformed',
		listener: (action: {
			actionId: string;
			notification: { id: number; extra?: Record<string, unknown> };
		}) => void
	): Promise<unknown>;
}

interface ScheduledNotification {
	id: number;
	title: string;
	body: string;
	channelId: string;
	schedule: { at: Date; allowWhileIdle: boolean };
	actionTypeId?: string;
	extra?: Record<string, unknown>;
}

/** Android channel ids. A channel's sound can't be changed once it exists, so bump the version
 * suffix whenever a sound changes. */
export const CHANNELS = {
	switch: 'dt-switch-v1',
	nudge: 'dt-nudge-v1',
	done: 'dt-done-v1',
	quiet: 'dt-quiet-v1',
	reminder: 'dt-reminder-v1'
} as const;

/** Importance 4 = high: a sound and a banner. 3 = default. */
const CHANNEL_DEFS = [
	{
		id: CHANNELS.switch,
		name: 'Time to switch',
		description: 'When a dilator timer ends',
		importance: 4,
		visibility: 1,
		sound: 'bg_ping',
		vibration: true
	},
	{
		id: CHANNELS.nudge,
		name: 'Still waiting reminders',
		description: 'Gentle reminders to switch',
		importance: 4,
		visibility: 1,
		sound: 'bg_nudge',
		vibration: true
	},
	{
		id: CHANNELS.done,
		name: 'Session finished',
		description: 'When the last dilator is done',
		importance: 4,
		visibility: 1,
		sound: 'bg_done',
		vibration: true
	},
	{
		id: CHANNELS.reminder,
		name: 'Session reminders',
		description: 'Your daily reminders to start a session',
		importance: 4,
		visibility: 1,
		sound: 'bg_ping',
		vibration: true
	},
	{
		id: CHANNELS.quiet,
		name: 'Silent alerts',
		description: 'Used when the alarm volume is off',
		importance: 3,
		visibility: 1,
		vibration: false
	}
];

let injected: NotificationsApi | null | undefined;
let queue: Promise<unknown> = Promise.resolve();
let channelsReady = false;
let reminderActionsReady = false;

/** Tests swap in a fake (or `null` for "not available"); `undefined` resets. */
export function setNotificationsForTests(api: NotificationsApi | null | undefined) {
	injected = api;
	channelsReady = false;
	reminderActionsReady = false;
	queue = Promise.resolve();
}

export function notificationsAvailable(): boolean {
	return injected === undefined ? isNative() : injected !== null;
}

/** Runs `fn` with the plugin. Resolves to undefined (never throws) if it isn't there or fails. */
async function use<T>(fn: (n: NotificationsApi) => Promise<T>): Promise<T | undefined> {
	if (!notificationsAvailable()) return undefined;
	try {
		if (injected) return await fn(injected);
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		return await fn(LocalNotifications as unknown as NotificationsApi);
	} catch (error) {
		console.warn('Locked-screen alerts failed.', error);
		return undefined;
	}
}

/** One thing at a time, in order: "go to background" then "come back" must never overlap. */
function enqueue<T>(task: () => Promise<T>): Promise<T | undefined> {
	const run = queue.then(task, task);
	queue = run.catch(() => undefined);
	return run.catch(() => undefined);
}

function toPermission(display: string | undefined): AlertsPermission {
	if (display === 'granted') return 'granted';
	if (display === 'denied') return 'denied';
	return 'prompt';
}

export async function getAlertsPermission(): Promise<AlertsPermission> {
	const result = await use((n) => n.checkPermissions());
	return result ? toPermission(result.display) : 'unavailable';
}

export async function requestAlertsPermission(): Promise<AlertsPermission> {
	const result = await use((n) => n.requestPermissions());
	return result ? toPermission(result.display) : 'unavailable';
}

async function ensureChannels(n: NotificationsApi) {
	// channels are an Android idea; iPhone has none
	if (channelsReady || (injected === undefined && nativePlatform() !== 'android')) return;
	for (const channel of CHANNEL_DEFS) await n.createChannel(channel);
	channelsReady = true;
}

const channelFor = (kind: AlertKind | 'reminder', quiet: boolean) =>
	quiet ? CHANNELS.quiet : CHANNELS[kind];

/**
 * Clears a session's alerts, scheduled or already showing. The Settings test alert is only taken off
 * the screen once it has been shown: one still waiting to go off is left scheduled, so locking the
 * phone doesn't cancel it, but a delivered one doesn't stay behind (it would leave a dot on the icon).
 */
function cancelAll(n: NotificationsApi) {
	const ids = PLAN_IDS.map((id) => ({ id }));
	const showing = [...ids, { id: TEST_ALERT_ID }];
	return n
		.cancel({ notifications: ids })
		.then(() => n.removeDeliveredNotifications({ notifications: showing }));
}

/** The app is going away for a while: hand these to the phone's alarm clock. */
export function armAlerts(alerts: BackgroundAlert[], quiet: boolean): Promise<void> {
	return enqueue(() =>
		use(async (n) => {
			if (toPermission((await n.checkPermissions()).display) !== 'granted') return;
			await ensureChannels(n);
			await cancelAll(n);
			if (!alerts.length) return;
			await n.schedule({
				notifications: alerts.map((a) => ({
					id: a.id,
					title: a.title,
					body: a.body,
					channelId: channelFor(a.kind, quiet),
					// exact time, and even while the phone is in deep sleep
					schedule: { at: new Date(a.at), allowWhileIdle: true }
				}))
			});
		})
	).then(() => undefined);
}

/** The app is back in front: the alerts are no longer needed. */
export function disarmAlerts(): Promise<void> {
	return enqueue(() => use((n) => cancelAll(n))).then(() => undefined);
}

/** Settings' "send a test alert": one alert shortly, so the phone can be locked to try it. */
/** Whether the app is in front, as far as appStateChange has told us. */
let inFront = true;

/** How long a test alert that went off while the app is open stays on the screen. */
export const TEST_ALERT_SHOWN_FOR_SECONDS = 6;

/** Called when the app goes to the background (false) or comes back (true). */
export function noteAppActive(isActive: boolean) {
	inFront = isActive;
}

export function sendTestAlert(quiet: boolean, inSeconds = 10): Promise<boolean> {
	return enqueue(() =>
		use(async (n) => {
			if (toPermission((await n.checkPermissions()).display) !== 'granted') return false;
			await ensureChannels(n);
			await n.schedule({
				notifications: [
					{
						id: TEST_ALERT_ID,
						title: 'Test alert 🔔',
						body: 'If you can see this on your lock screen, locked-screen alerts work.',
						channelId: channelFor('switch', quiet),
						schedule: { at: new Date(Date.now() + inSeconds * 1000), allowWhileIdle: true }
					}
				]
			});
			// If you stay in the app and watch it go off, take it down again afterwards so it doesn't
			// leave a dot on the icon. (If you leave, coming back to the app clears it.)
			setTimeout(
				() => {
					if (inFront)
						void enqueue(() =>
							use((m) => m.removeDeliveredNotifications({ notifications: [{ id: TEST_ALERT_ID }] }))
						);
				},
				(inSeconds + TEST_ALERT_SHOWN_FOR_SECONDS) * 1000
			);
			return true;
		})
	).then((ok) => ok === true);
}

/** Calls back when the app goes to (false) or comes back from (true) the background. */
export async function watchAppState(callback: (isActive: boolean) => void): Promise<void> {
	if (!isNative()) return;
	try {
		const { App } = await import('@capacitor/app');
		await App.addListener('appStateChange', ({ isActive }) => {
			noteAppActive(isActive);
			callback(isActive);
		});
	} catch (error) {
		console.warn('Could not watch the app going to the background.', error);
	}
}

// ---- daily reminders to start a session ----

/** The buttons on a reminder. They all open the app: that is the only way to be sure the phone runs our code. */
export const REMINDER_ACTION_TYPE = 'dt-reminder';
export type ReminderAction = 'start' | 'snooze' | 'off' | 'open';
export const REMINDER_ACTIONS = [
	{ id: 'start', title: 'Start session', foreground: true },
	{ id: 'snooze', title: `Remind me in ${SNOOZE_MINUTES} min`, foreground: true },
	{ id: 'off', title: 'Turn off', foreground: true }
];

async function ensureReminderActions(n: NotificationsApi) {
	if (reminderActionsReady) return;
	await n.registerActionTypes({
		types: [{ id: REMINDER_ACTION_TYPE, actions: REMINDER_ACTIONS }]
	});
	reminderActionsReady = true;
}

const reminderIds = [...REMINDER_IDS, SNOOZE_ID].map((id) => ({ id }));

function reminderNotification(
	r: Pick<PlannedReminder, 'id' | 'title' | 'body' | 'slot' | 'date'>,
	at: number,
	quiet: boolean
): ScheduledNotification {
	return {
		id: r.id,
		title: r.title,
		body: r.body,
		channelId: channelFor('reminder', quiet),
		schedule: { at: new Date(at), allowWhileIdle: true },
		actionTypeId: REMINDER_ACTION_TYPE,
		extra: { slot: r.slot, date: r.date }
	};
}

/**
 * Hands the phone the planned reminders, replacing whatever was planned before. An empty plan (or
 * no permission) just clears them. A pending "remind me again" is left alone.
 */
export function syncReminders(planned: PlannedReminder[], quiet: boolean): Promise<void> {
	return enqueue(() =>
		use(async (n) => {
			const ids = REMINDER_IDS.map((id) => ({ id }));
			await n.cancel({ notifications: ids });
			if (!planned.length) return;
			if (toPermission((await n.checkPermissions()).display) !== 'granted') return;
			await ensureChannels(n);
			await ensureReminderActions(n);
			await n.schedule({ notifications: planned.map((r) => reminderNotification(r, r.at, quiet)) });
		})
	).then(() => undefined);
}

/** "Remind me in 30 minutes": one more reminder for the same session. */
export function snoozeReminder(
	slot: SlotId,
	date: string,
	title: string,
	body: string,
	quiet: boolean,
	now = Date.now()
): Promise<boolean> {
	return enqueue(() =>
		use(async (n) => {
			if (toPermission((await n.checkPermissions()).display) !== 'granted') return false;
			await ensureChannels(n);
			await ensureReminderActions(n);
			const at = now + SNOOZE_MINUTES * 60_000;
			await n.schedule({
				notifications: [reminderNotification({ id: SNOOZE_ID, title, body, slot, date }, at, quiet)]
			});
			return true;
		})
	).then((ok) => ok === true);
}

/** Takes reminders that already went off off the screen, and a waiting "remind me again" away. */
export function clearReminderNotifications(options: { pendingSnooze: boolean }): Promise<void> {
	return enqueue(() =>
		use(async (n) => {
			if (options.pendingSnooze) await n.cancel({ notifications: [{ id: SNOOZE_ID }] });
			await n.removeDeliveredNotifications({ notifications: reminderIds });
		})
	).then(() => undefined);
}

/** Calls back when a button on a reminder (or the reminder itself) is tapped. */
export async function watchReminderActions(
	callback: (action: ReminderAction, extra: { slot?: string; date?: string }) => void
): Promise<void> {
	await use((n) =>
		n.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
			const action: ReminderAction =
				actionId === 'start' || actionId === 'snooze' || actionId === 'off' ? actionId : 'open';
			const extra = notification.extra ?? {};
			callback(action, {
				slot: typeof extra.slot === 'string' ? extra.slot : undefined,
				date: typeof extra.date === 'string' ? extra.date : undefined
			});
		})
	);
}

/** Android only: after "snooze" or "turn off" there is no reason to keep the app in front. */
export async function sendAppToBackground(): Promise<void> {
	if (!isNative() || nativePlatform() !== 'android') return;
	try {
		const { App } = await import('@capacitor/app');
		await App.minimizeApp();
	} catch {
		// staying in the app is harmless
	}
}
