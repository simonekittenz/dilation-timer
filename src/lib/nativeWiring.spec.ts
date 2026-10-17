import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOUND_NAMES } from './sounds';

// The iOS and Android code can't be compiled on every machine (it needs Xcode / Android Studio),
// so these tests check that all the places that must agree about names and paths still agree.
const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

const swift = read('ios/App/App/AudioDuckingPlugin.swift');
const java = read(
	'android/app/src/main/java/com/simonekittenz/dilationtimer/AudioDuckingPlugin.java'
);
const js = read('src/lib/nativeAudio.ts');

const METHODS = ['play', 'loop', 'stop'];

describe('native audio plugin wiring', () => {
	it('JavaScript, Swift and Java agree on the plugin name', () => {
		expect(js).toContain("registerPlugin<AudioDuckingPlugin>('AudioDucking')");
		expect(swift).toContain('public let jsName = "AudioDucking"');
		expect(java).toContain('@CapacitorPlugin(name = "AudioDucking")');
	});

	it('every method the JavaScript calls exists on both platforms', () => {
		for (const m of METHODS) {
			expect(js, `JS calls ${m}`).toMatch(new RegExp(`p\\.${m}\\(`));
			expect(swift, `Swift lists ${m}`).toContain(`CAPPluginMethod(name: "${m}"`);
			expect(swift, `Swift implements ${m}`).toContain(`@objc func ${m}(_ call: CAPPluginCall)`);
			expect(java, `Java implements ${m}`).toMatch(
				new RegExp(`@PluginMethod\\s+public void ${m}\\(PluginCall call\\)`)
			);
		}
	});

	it('both platforms read the sound files from where the web build puts them', () => {
		expect(swift).toContain('subdirectory: "public/sounds"');
		expect(swift).toContain('withExtension: "wav"');
		expect(java).toContain('"public/sounds/" + sound + ".wav"');
	});

	it('both platforms only accept simple sound names, and all our names qualify', () => {
		expect(swift).toContain('"^[a-z0-9-]+$"');
		expect(java).toContain('"^[a-z0-9-]+$"');
		for (const name of SOUND_NAMES) expect(name).toMatch(/^[a-z0-9-]+$/);
	});

	it('both platforms duck other audio and hand it back', () => {
		expect(swift).toContain('.duckOthers');
		expect(swift).toContain('.notifyOthersOnDeactivation');
		expect(java).toContain('AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK');
		expect(java).toContain('abandonAudioFocus');
	});
});

describe('the plugin is registered in the app shells', () => {
	it('iOS: the view controller registers it and the app uses that view controller', () => {
		expect(read('ios/App/App/MyViewController.swift')).toContain(
			'registerPluginInstance(AudioDuckingPlugin())'
		);
		expect(read('ios/App/App/SceneDelegate.swift')).toContain('MyViewController()');
		expect(read('ios/App/App/Base.lproj/Main.storyboard')).toContain(
			'customClass="MyViewController"'
		);
	});

	it('iOS: the Xcode project compiles both new Swift files', () => {
		const project = read('ios/App/App.xcodeproj/project.pbxproj');
		for (const file of ['MyViewController.swift', 'AudioDuckingPlugin.swift']) {
			const lines = project.split('\n').filter((l) => l.includes(file));
			// file reference, build file, group listing, and the compile step
			expect(lines, file).toHaveLength(4);
			expect(lines.some((l) => l.includes('PBXFileReference'))).toBe(true);
			expect(lines.some((l) => l.includes('PBXBuildFile'))).toBe(true);
			expect(lines.some((l) => l.includes('in Sources */,'))).toBe(true);
		}
	});

	it('Android: MainActivity registers it before the bridge starts', () => {
		const activity = read(
			'android/app/src/main/java/com/simonekittenz/dilationtimer/MainActivity.java'
		);
		const register = activity.indexOf('registerPlugin(AudioDuckingPlugin.class)');
		expect(register).toBeGreaterThan(-1);
		expect(register).toBeLessThan(activity.indexOf('super.onCreate'));
	});
});

describe('app identity', () => {
	it('the same app id is used by Capacitor, iOS and Android', () => {
		const id = /appId: '([^']+)'/.exec(read('capacitor.config.ts'))![1];
		expect(read('ios/App/App.xcodeproj/project.pbxproj')).toContain(
			`PRODUCT_BUNDLE_IDENTIFIER = ${id};`
		);
		expect(read('android/app/build.gradle')).toContain(`applicationId "${id}"`);
		expect(read('android/app/build.gradle')).toContain(`namespace = "${id}"`);
	});

	it('the native apps load the native web build and ship the pink icon', () => {
		expect(read('capacitor.config.ts')).toContain("webDir: 'build'");
		expect(
			existsSync(new URL('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', root))
		).toBe(true);
		expect(
			existsSync(new URL('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', root))
		).toBe(true);
	});
});
