import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_NUDGES } from './backgroundAlerts';
import { REMINDER_IDS } from './reminders';

// The iPhone app can't be built by the tests, but the settings Apple's checks (and App Review) look at
// are plain files, and an upload that gets refused costs a day. These keep them from drifting.
const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const info = read('ios/App/App/Info.plist');
const project = read('ios/App/App.xcodeproj/project.pbxproj');

describe('the iPhone app files', () => {
	it('uses the same app id as Android and Capacitor', () => {
		expect(read('capacitor.config.ts')).toContain("appId: 'com.simonekittenz.dilationtimer'");
		const ids = [...project.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) => m[1]);
		expect(ids.length).toBeGreaterThan(0);
		expect(new Set(ids)).toEqual(new Set(['com.simonekittenz.dilationtimer']));
	});

	it('says it uses no special encryption, so uploads skip the export-compliance question', () => {
		expect(info).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
	});

	it('requires a 64-bit iPhone (not the old armv7), and is for iPhone only', () => {
		expect(info).toContain('<string>arm64</string>');
		expect(info).not.toContain('armv7');
		const families = [...project.matchAll(/TARGETED_DEVICE_FAMILY = ([^;]+);/g)].map((m) => m[1]);
		expect(new Set(families)).toEqual(new Set(['1']));
	});

	it('has a privacy manifest that is part of the app: no tracking, no data collected', () => {
		const manifest = read('ios/App/App/PrivacyInfo.xcprivacy');
		expect(manifest).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
		expect(manifest).toMatch(/<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/);
		expect(project).toContain('PrivacyInfo.xcprivacy in Resources');
	});

	it('has the app icon and no version of its own (the build script sets it)', () => {
		expect(read('ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json')).toContain(
			'"size": "1024x1024"'
		);
		expect(info).toContain('$(MARKETING_VERSION)');
		expect(info).toContain('$(CURRENT_PROJECT_VERSION)');
	});

	it('never schedules more alerts than iPhone keeps (64 waiting notifications)', () => {
		// reminders + one "remind me again" + a session's alerts + the Settings test
		const most = REMINDER_IDS.length + 1 + (MAX_NUDGES + 1) + 1;
		expect(most).toBeLessThan(64);
	});

	it('has commands to check the build, archive it, and send it to TestFlight', () => {
		const scripts = JSON.parse(read('package.json')).scripts;
		expect(scripts['ios:check']).toBe('node scripts/build-ios.mjs --check');
		expect(scripts['ios:archive']).toBe('node scripts/build-ios.mjs --archive');
		expect(scripts['ios:testflight']).toBe('node scripts/build-ios.mjs --upload');
		expect(read('.gitignore')).toContain('ios/build');
	});

	it('does not check for updates on iPhone (App Store and TestFlight do that)', () => {
		expect(read('src/lib/updates.svelte.ts')).toContain("nativePlatform() !== 'android'");
	});
});
