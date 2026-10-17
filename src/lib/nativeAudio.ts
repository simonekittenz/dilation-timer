import { isNative } from './platform';
import type { SoundName } from './sounds';

/**
 * The small native plugin that plays the alarm from a sound file while *ducking* other apps'
 * audio (e.g. Spotify gets quieter, then comes back). It exists only inside the iOS/Android app;
 * everywhere else the alarm is played with Web Audio as usual.
 */
export interface AudioDuckingPlugin {
	/** Plays a bundled sound once. Resolves as soon as playback has started. */
	play(options: { sound: SoundName; volume: number }): Promise<void>;
	/** Plays a sound now and again every `intervalMs` until stop(). */
	loop(options: { sound: SoundName; volume: number; intervalMs: number }): Promise<void>;
	stop(): Promise<void>;
}

let injected: AudioDuckingPlugin | null | undefined;
let loaded: Promise<{ plugin: AudioDuckingPlugin }> | null = null;
let missing = false;

/** Tests swap in a fake plugin (or `null` to pretend there isn't one); `undefined` resets. */
export function setNativeAudioForTests(p: AudioDuckingPlugin | null | undefined) {
	injected = p;
	loaded = null;
	missing = false;
}

/** True when the app wrapper's audio plugin should be used instead of Web Audio. */
export function nativeAudioAvailable(): boolean {
	if (missing) return false;
	return injected === undefined ? isNative() : injected !== null;
}

/**
 * The plugin is always passed around inside a little wrapper object. A Capacitor plugin answers
 * to *every* property name, including `then`, so resolving a promise with the bare plugin makes
 * JavaScript call `plugin.then(...)`, which Capacitor reports as "plugin is not implemented".
 */
function getPlugin(): Promise<{ plugin: AudioDuckingPlugin }> {
	if (injected) return Promise.resolve({ plugin: injected });
	loaded ??= import('@capacitor/core').then(({ registerPlugin }) => ({
		plugin: registerPlugin<AudioDuckingPlugin>('AudioDucking')
	}));
	return loaded;
}

function isUnimplemented(error: unknown): boolean {
	const e = error as { code?: string; message?: string } | null;
	return e?.code === 'UNIMPLEMENTED' || /not implemented|not available/i.test(e?.message ?? '');
}

/** Runs a plugin call. false means "it didn't happen, play it with Web Audio instead". */
async function call(run: (p: AudioDuckingPlugin) => Promise<void>): Promise<boolean> {
	if (!nativeAudioAvailable()) return false;
	try {
		const { plugin } = await getPlugin();
		await run(plugin);
		return true;
	} catch (error) {
		// A missing plugin never fixes itself; a one-off failure (e.g. during a phone call) might.
		if (isUnimplemented(error)) missing = true;
		console.warn('Native alarm audio failed, using Web Audio instead.', error);
		return false;
	}
}

export const playNative = (sound: SoundName, volume: number) =>
	call((p) => p.play({ sound, volume }));

export const loopNative = (sound: SoundName, volume: number, intervalMs: number) =>
	call((p) => p.loop({ sound, volume, intervalMs }));

export const stopNative = () => call((p) => p.stop());
