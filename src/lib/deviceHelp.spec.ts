import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	batteryAdvice,
	batteryHintDismissed,
	deviceHelpAvailable,
	dismissBatteryHint,
	getDeviceInfo,
	isStrictMaker,
	makerGroup,
	openAppSettings,
	setDeviceHelpForTests,
	shouldShowBatteryHint,
	type DeviceHelpPlugin
} from './deviceHelp';

afterEach(() => setDeviceHelpForTests(undefined));

describe('which phone is it', () => {
	it('groups the makers that are strict with background apps', () => {
		expect(makerGroup('samsung')).toBe('samsung');
		expect(makerGroup('Samsung')).toBe('samsung');
		for (const m of ['xiaomi', 'redmi', 'poco']) expect(makerGroup(m)).toBe('xiaomi');
		for (const m of ['oppo', 'realme', 'oneplus']) expect(makerGroup(m)).toBe('oppo');
		for (const m of ['huawei', 'honor']) expect(makerGroup(m)).toBe('huawei');
		for (const m of ['vivo', 'iQOO']) expect(makerGroup(m)).toBe('vivo');
		for (const m of ['google', 'motorola', 'sony', '']) expect(makerGroup(m)).toBe('other');
	});

	it('says only the strict makers are worth a hint nobody asked for', () => {
		expect(isStrictMaker('samsung')).toBe(true);
		expect(isStrictMaker('google')).toBe(false);
	});
});

describe('what to do about it', () => {
	it('has steps for every kind of phone, in that phone’s words', () => {
		for (const group of ['samsung', 'xiaomi', 'oppo', 'huawei', 'vivo', 'other'] as const) {
			const a = batteryAdvice(group);
			expect(a.steps.length, group).toBeGreaterThan(0);
			expect(a.steps[0], group).toContain('Open app settings');
		}
		expect(batteryAdvice('samsung').steps.join(' ')).toContain('Unrestricted');
		expect(batteryAdvice('samsung').steps.join(' ')).toContain('Sleeping apps');
		expect(batteryAdvice('xiaomi').steps.join(' ')).toContain('Autostart');
		expect(batteryAdvice('xiaomi').steps.join(' ')).toContain('No restrictions');
	});
});

describe('the note on Today', () => {
	const limited = { manufacturer: 'samsung', unrestricted: false };

	it('shows on a strict maker’s phone that still has the limits on', () => {
		expect(shouldShowBatteryHint(limited, false)).toBe(true);
	});

	it('stays away once the limits are off, after “Got it”, on other phones, and without a plugin', () => {
		expect(shouldShowBatteryHint({ ...limited, unrestricted: true }, false)).toBe(false);
		expect(shouldShowBatteryHint(limited, true)).toBe(false);
		expect(shouldShowBatteryHint({ manufacturer: 'google', unrestricted: false }, false)).toBe(
			false
		);
		expect(shouldShowBatteryHint(null, false)).toBe(false);
	});

	it('remembers “Got it”', () => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v)
		});
		expect(batteryHintDismissed()).toBe(false);
		dismissBatteryHint();
		expect(batteryHintDismissed()).toBe(true);
		vi.unstubAllGlobals();
	});
});

describe('talking to the native plugin', () => {
	it('is not there in a browser', async () => {
		expect(deviceHelpAvailable()).toBe(false);
		expect(await getDeviceInfo()).toBeNull();
		expect(await openAppSettings()).toBe(false);
	});

	it('reads the maker and the battery state, and opens the settings', async () => {
		const plugin: DeviceHelpPlugin = {
			info: vi.fn(async () => ({ manufacturer: 'xiaomi', unrestricted: false })),
			openAppSettings: vi.fn(async () => {})
		};
		setDeviceHelpForTests(plugin);
		expect(await getDeviceInfo()).toEqual({ manufacturer: 'xiaomi', unrestricted: false });
		expect(await openAppSettings()).toBe(true);
		expect(plugin.openAppSettings).toHaveBeenCalledOnce();
	});

	it('never throws: a failing phone is just “unknown”', async () => {
		setDeviceHelpForTests({
			info: async () => {
				throw new Error('nope');
			},
			openAppSettings: async () => {
				throw new Error('nope');
			}
		});
		expect(await getDeviceInfo()).toBeNull();
		expect(await openAppSettings()).toBe(false);
	});
});

describe('JavaScript, Java and the screens agree', () => {
	const root = new URL('../../', import.meta.url);
	const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
	const java = read(
		'android/app/src/main/java/com/simonekittenz/dilationtimer/DeviceHelpPlugin.java'
	);

	it('use the same plugin name and methods', () => {
		expect(read('src/lib/deviceHelp.ts')).toContain(
			"registerPlugin<DeviceHelpPlugin>('DeviceHelp')"
		);
		expect(java).toContain('@CapacitorPlugin(name = "DeviceHelp")');
		for (const m of ['info', 'openAppSettings']) {
			expect(java).toMatch(new RegExp(`@PluginMethod\\s+public void ${m}\\(PluginCall call\\)`));
		}
		expect(java).toContain('"manufacturer"');
		expect(java).toContain('"unrestricted"');
		expect(java).toContain('isIgnoringBatteryOptimizations');
		expect(java).toContain('ACTION_APPLICATION_DETAILS_SETTINGS');
	});

	it('is registered, and needs no extra permission (it only reads, and opens the settings page)', () => {
		expect(
			read('android/app/src/main/java/com/simonekittenz/dilationtimer/MainActivity.java')
		).toContain('registerPlugin(DeviceHelpPlugin.class)');
		expect(read('android/app/src/main/AndroidManifest.xml')).not.toContain(
			'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'
		);
	});

	it('is in Settings (next to the locked-screen alerts) and on Today', () => {
		const alerts = read('src/routes/settings/alerts/+page.svelte');
		expect(alerts).toContain('data-testid="battery-help"');
		expect(alerts).toContain('id="battery"');
		expect(read('src/routes/+page.svelte')).toContain('<BatteryHint />');
		expect(read('src/lib/BatteryHint.svelte')).toContain('href="/settings/alerts#battery"');
	});
});
