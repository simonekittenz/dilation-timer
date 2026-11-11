import { nativePlatform } from './platform';

/**
 * Some phone makers put apps to sleep to save battery, and then locked-screen alerts can come late or not
 * at all. The Android app reads who made the phone and whether it is left out of those limits, and can open
 * its own page in the system settings. (Only Android has this plugin.)
 */
export interface DeviceInfo {
	/** Lower case, e.g. "samsung". */
	manufacturer: string;
	/** The system leaves the app out of its battery limits. */
	unrestricted: boolean;
}

export interface DeviceHelpPlugin {
	info(): Promise<DeviceInfo>;
	openAppSettings(): Promise<void>;
}

let injected: DeviceHelpPlugin | null | undefined;
let loaded: Promise<{ plugin: DeviceHelpPlugin }> | null = null;

/** Tests swap in a fake (or `null` for "not available"); `undefined` resets. */
export function setDeviceHelpForTests(p: DeviceHelpPlugin | null | undefined) {
	injected = p;
	loaded = null;
}

export function deviceHelpAvailable(): boolean {
	return injected === undefined ? nativePlatform() === 'android' : injected !== null;
}

// A Capacitor plugin answers to every property name, `then` included: it is passed around in a wrapper.
function getPlugin(): Promise<{ plugin: DeviceHelpPlugin }> {
	if (injected) return Promise.resolve({ plugin: injected });
	loaded ??= import('@capacitor/core').then(({ registerPlugin }) => ({
		plugin: registerPlugin<DeviceHelpPlugin>('DeviceHelp')
	}));
	return loaded;
}

/** null when this is not the Android app, or the phone would not say. Never throws. */
export async function getDeviceInfo(): Promise<DeviceInfo | null> {
	if (!deviceHelpAvailable()) return null;
	try {
		const { plugin } = await getPlugin();
		const info = await plugin.info();
		return {
			manufacturer: String(info.manufacturer ?? ''),
			unrestricted: info.unrestricted === true
		};
	} catch {
		return null;
	}
}

/** Opens this app's page in the phone's settings. false if that was not possible. */
export async function openAppSettings(): Promise<boolean> {
	if (!deviceHelpAvailable()) return false;
	try {
		const { plugin } = await getPlugin();
		await plugin.openAppSettings();
		return true;
	} catch {
		return false;
	}
}

export type MakerGroup = 'samsung' | 'xiaomi' | 'oppo' | 'huawei' | 'vivo' | 'other';

/** Which family of phones this is, as far as battery settings go. */
export function makerGroup(manufacturer: string): MakerGroup {
	const m = manufacturer.toLowerCase();
	if (m.includes('samsung')) return 'samsung';
	if (/xiaomi|redmi|poco/.test(m)) return 'xiaomi';
	if (/oppo|realme|oneplus/.test(m)) return 'oppo';
	if (/huawei|honor/.test(m)) return 'huawei';
	if (/vivo|iqoo/.test(m)) return 'vivo';
	return 'other';
}

/** Makers known to be strict with background apps, which is where a hint is worth showing unasked. */
export const isStrictMaker = (manufacturer: string) => makerGroup(manufacturer) !== 'other';

export interface BatteryAdvice {
	/** What to call the phone in a sentence: "Samsung phones", or just "some phones". */
	who: string;
	steps: string[];
}

const OPEN = 'Press “Open app settings” below, then tap Battery';

/** What to do, in the words that phone's settings use (they differ a little between versions). */
export function batteryAdvice(group: MakerGroup): BatteryAdvice {
	switch (group) {
		case 'samsung':
			return {
				who: 'Samsung phones',
				steps: [
					`${OPEN} and choose Unrestricted.`,
					'Then open Settings → Battery → Background usage limits. Make sure Dilation timer is not in “Sleeping apps” or “Deep sleeping apps”, and turn off “Put unused apps to sleep”.'
				]
			};
		case 'xiaomi':
			return {
				who: 'Xiaomi, Redmi and Poco phones',
				steps: [
					`${OPEN} saver (or Battery) and choose No restrictions.`,
					'Turn on Autostart for Dilation timer (Settings → Apps → Permissions → Autostart).',
					'In the recent apps view, lock the app’s card so the phone doesn’t clean it away.'
				]
			};
		case 'oppo':
			return {
				who: 'Oppo, Realme and OnePlus phones',
				steps: [
					`${OPEN} usage and allow background activity.`,
					'If you see Auto launch (or App auto-start), turn it on for Dilation timer.'
				]
			};
		case 'huawei':
			return {
				who: 'Huawei and Honor phones',
				steps: [
					`${OPEN} → App launch. Turn off “Manage automatically”, then turn on Auto-launch, Secondary launch and Run in background.`
				]
			};
		case 'vivo':
			return {
				who: 'Vivo and iQOO phones',
				steps: [
					`${OPEN} and allow background activity (sometimes called high background power consumption).`,
					'Allow Autostart for Dilation timer if the phone lists it.'
				]
			};
		default:
			return {
				who: 'some phones',
				steps: [`${OPEN} and choose Unrestricted (or “Not optimised”).`]
			};
	}
}

const DISMISSED_KEY = 'dilation-timer:battery-hint-dismissed';

export function batteryHintDismissed(): boolean {
	try {
		return localStorage.getItem(DISMISSED_KEY) !== null;
	} catch {
		return false;
	}
}

export function dismissBatteryHint() {
	try {
		localStorage.setItem(DISMISSED_KEY, '1');
	} catch {
		// private mode: it will just be offered again
	}
}

/** The note on Today: only on a strict maker's phone that still has the limits on, and not once dismissed. */
export function shouldShowBatteryHint(info: DeviceInfo | null, dismissed: boolean): boolean {
	return !!info && !info.unrestricted && isStrictMaker(info.manufacturer) && !dismissed;
}
