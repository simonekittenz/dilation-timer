import { ALERT_ID, MAX_NUDGES, type AlertKind, type BackgroundAlert } from './backgroundAlerts';
import { isNative, nativePlatform } from './platform';

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
	removeAllDeliveredNotifications(): Promise<void>;
}

interface ScheduledNotification {
	id: number;
	title: string;
	body: string;
	channelId: string;
	schedule: { at: Date; allowWhileIdle: boolean };
}

/** Android channel ids. A channel's sound can't be changed once it exists, so bump the version
 * suffix whenever a sound changes. */
export const CHANNELS = {
	switch: 'dt-switch-v1',
	nudge: 'dt-nudge-v1',
	done: 'dt-done-v1',
	quiet: 'dt-quiet-v1'
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

/** Tests swap in a fake (or `null` for "not available"); `undefined` resets. */
export function setNotificationsForTests(api: NotificationsApi | null | undefined) {
	injected = api;
	channelsReady = false;
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

const channelFor = (kind: AlertKind, quiet: boolean) => (quiet ? CHANNELS.quiet : CHANNELS[kind]);

/** Clears whatever is scheduled or still showing from our earlier alerts. */
function cancelAll(n: NotificationsApi) {
	const ids = Array.from({ length: MAX_NUDGES + 100 }, (_, i) => ({ id: ALERT_ID + i }));
	return n.cancel({ notifications: ids }).then(() => n.removeAllDeliveredNotifications());
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
export function sendTestAlert(quiet: boolean, inSeconds = 10): Promise<boolean> {
	return enqueue(() =>
		use(async (n) => {
			if (toPermission((await n.checkPermissions()).display) !== 'granted') return false;
			await ensureChannels(n);
			await n.schedule({
				notifications: [
					{
						id: ALERT_ID + 99,
						title: 'Test alert 🔔',
						body: 'If you can see this on your lock screen, locked-screen alerts work.',
						channelId: channelFor('switch', quiet),
						schedule: { at: new Date(Date.now() + inSeconds * 1000), allowWhileIdle: true }
					}
				]
			});
			return true;
		})
	).then((ok) => ok === true);
}

/** Calls back when the app goes to (false) or comes back from (true) the background. */
export async function watchAppState(callback: (isActive: boolean) => void): Promise<void> {
	if (!isNative()) return;
	try {
		const { App } = await import('@capacitor/app');
		await App.addListener('appStateChange', ({ isActive }) => callback(isActive));
	} catch (error) {
		console.warn('Could not watch the app going to the background.', error);
	}
}
