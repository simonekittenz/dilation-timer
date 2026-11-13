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
		// the lock screen extension has to be named after the app: the app's id, then a suffix
		expect(new Set(ids)).toEqual(
			new Set(['com.simonekittenz.dilationtimer', 'com.simonekittenz.dilationtimer.SessionWidget'])
		);
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

describe('the Live Activity on the lock screen', () => {
	const widgetInfo = read('ios/App/SessionWidget/Info.plist');
	const plugin = read('ios/App/App/SessionNoticePlugin.swift');
	const shared = read('ios/App/Shared/SessionActivityAttributes.swift');
	const js = read('src/lib/sessionNotice.ts');

	it('is switched on in the app, and the extension is a widget extension', () => {
		expect(info).toMatch(/<key>NSSupportsLiveActivities<\/key>\s*<true\/>/);
		expect(widgetInfo).toContain('com.apple.widgetkit-extension');
		expect(widgetInfo).toContain('$(MARKETING_VERSION)');
		expect(widgetInfo).toContain('$(CURRENT_PROJECT_VERSION)');
	});

	it('is part of the project: built, and put inside the app so it is uploaded with it', () => {
		expect(project).toContain('productType = "com.apple.product-type.app-extension"');
		expect(project).toContain('name = "Embed Foundation Extensions"');
		expect(project).toContain('SessionWidget.appex in Embed Foundation Extensions');
		expect(project).toContain('PBXTargetDependency');
		// Live Activities need iOS 16.2; the app itself still runs on iOS 15
		expect(project).toContain('IPHONEOS_DEPLOYMENT_TARGET = 16.2;');
		expect(project).toContain('IPHONEOS_DEPLOYMENT_TARGET = 15.0;');
	});

	it('shares one description of the activity between the app and the extension', () => {
		// one "build file" line per target that compiles it
		const inSources = (file: string) =>
			[...project.matchAll(new RegExp(`${file} in Sources \\*/ = \\{isa = PBXBuildFile`, 'g'))]
				.length;
		expect(inSources('SessionActivityAttributes.swift')).toBe(2); // app and extension
		expect(inSources('SessionNoticePlugin.swift')).toBe(1);
		expect(inSources('SessionLiveActivity.swift')).toBe(1);
		expect(shared).toContain('ActivityAttributes');
	});

	it('uses the same plugin name, methods and fields as the JavaScript (and the Android plugin)', () => {
		expect(js).toContain("registerPlugin<SessionNoticePlugin>('SessionNotice')");
		expect(plugin).toContain('public let jsName = "SessionNotice"');
		for (const m of ['show', 'hide']) {
			expect(plugin).toContain(`CAPPluginMethod(name: "${m}"`);
			expect(plugin).toContain(`@objc func ${m}(_ call: CAPPluginCall)`);
		}
		for (const field of [
			'title',
			'text',
			'clock',
			'at',
			'afterTitle',
			'afterText',
			'expiresInMs'
		]) {
			expect(plugin, field).toContain(`"${field}"`);
			expect(shared + plugin, field).toContain(field);
		}
	});

	it('is readable on any wallpaper: white writing on a deep rose card, with room for the title', () => {
		const card = read('ios/App/SessionWidget/SessionLiveActivity.swift');
		expect(card).toContain('.activityBackgroundTint(rose)');
		expect(card).toContain('private let rose = Color(red: 0.72, green: 0.13, blue: 0.37)');
		const lock = card.slice(
			card.indexOf('struct LockScreenView'),
			card.indexOf('struct ClockText')
		);
		expect(lock).toContain('.foregroundStyle(.white)');
		expect(lock).toContain('color: .white');
		// no pink or dark writing on the card itself (that was hard to read)
		expect(lock).not.toContain('foregroundStyle(pink)');
		expect(lock).not.toContain('ink');
		// the title may wrap, and the clock cannot stretch across the row and squeeze it
		expect(lock).toContain('.lineLimit(2)');
		expect(lock).toContain('.frame(maxWidth: 104, alignment: .trailing)');
	});

	it('shows the bunny or kitty you picked, drawn natively, with optional fields so older activities still open', () => {
		const card = read('ios/App/SessionWidget/SessionLiveActivity.swift');
		const mascot = read('ios/App/SessionWidget/SessionMascot.swift');
		// the same shapes and numbers as the app's own Mascot.svelte
		const svelte = read('src/lib/Mascot.svelte');
		for (const piece of [
			'cx="40" cy="34" rx="13" ry="30"',
			'M22 64 L26 18 L64 48 Z',
			'cx="60" cy="80" rx="42" ry="33"'
		]) {
			expect(svelte).toContain(piece);
		}
		expect(mascot).toContain('ellipse(40, 34, 13, 30)');
		expect(mascot).toContain('triangle((22, 64), (26, 18), (64, 48))');
		expect(mascot).toContain('ellipse(60, 80, 42, 33)');
		for (const mood of ['alert', 'done']) expect(mascot).toContain(`"${mood}"`);
		// on the card and in the Dynamic Island
		expect((card.match(/SessionMascot\(/g) ?? []).length).toBeGreaterThanOrEqual(4);
		// a Live Activity started by an older build has no such fields: they must be optional to decode
		const shared = read('ios/App/Shared/SessionActivityAttributes.swift');
		for (const field of ['mascot', 'mood', 'afterMood'])
			expect(shared).toContain(`var ${field}: String?`);
		const plugin = read('ios/App/App/SessionNoticePlugin.swift');
		for (const field of ['mascot', 'mood', 'afterMood'])
			expect(plugin).toContain(`call.getString("${field}")`);
		expect([
			...project.matchAll(/SessionMascot\.swift in Sources \*\/ = \{isa = PBXBuildFile/g)
		]).toHaveLength(1);
	});

	it('is registered in the view controller and does nothing on older iPhones', () => {
		expect(read('ios/App/App/MyViewController.swift')).toContain(
			'registerPluginInstance(SessionNoticePlugin())'
		);
		expect(plugin).toContain('#available(iOS 16.2, *)');
	});
});
