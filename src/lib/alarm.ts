import { loopNative, nativeAudioAvailable, playNative, stopNative } from './nativeAudio';
import {
	ALARM_INTERVAL_MS,
	CELEBRATE_TIMES,
	FANFARE_GAP,
	FANFARE_LENGTH,
	NOTES,
	PING_GAP,
	arpeggioScore,
	buildChain,
	chimeScore,
	fanfareScore,
	pingScore,
	playScore,
	type Note,
	type SoundName
} from './sounds';

// these used to live here; other code and tests still import them from this module
export { CELEBRATE_TIMES, FANFARE_GAP, NOTES, PING_GAP };

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

let ctx: AudioContext | null = null;
/** Everything plays into `bus`: lowpass -> limiter -> master volume -> speakers. */
let bus: AudioNode | null = null;
let master: GainNode | null = null;
let volume = 1;
let loop: ReturnType<typeof setInterval> | null = null;
/** True while the app wrapper's native alarm loop is running. */
let nativeLooping = false;
let wakeLock: WakeLockSentinel | null = null;
const baseTitle = 'Dilation timer';
let titleFlash: ReturnType<typeof setInterval> | null = null;

/**
 * Must run inside a real tap/click so the browser allows sound.
 * On iPhone, Web Audio is muted by the silent switch unless the page declares a "playback"
 * audio session (iOS 17+), so we set that here too.
 */
export function unlock() {
	if (typeof window === 'undefined') return;
	// In the app, sound comes from the native plugin. Touching Web Audio here could make the web
	// view claim the audio session and pause the user's music for nothing.
	if (nativeAudioAvailable()) return;
	try {
		const session = (navigator as AudioSessionNavigator).audioSession;
		if (session && session.type !== 'playback') session.type = 'playback';
	} catch {
		// older browsers don't have it
	}
	if (!ctx) {
		try {
			ctx = new AudioContext();
		} catch {
			return;
		}
		buildGraph(ctx);
	}
	if (ctx.state === 'running') return;
	void ctx.resume();
	// A silent one-sample blip inside the gesture is what finally unlocks iOS.
	const blip = ctx.createBufferSource();
	blip.buffer = ctx.createBuffer(1, 1, 22050);
	blip.connect(ctx.destination);
	blip.start(0);
}

function buildGraph(c: AudioContext) {
	const chain = buildChain(c, volume);
	bus = chain.bus;
	master = chain.master;
}

/** 0 (silent) to 1 (full), from the Settings volume slider. */
export function setVolume(v: number) {
	volume = Math.min(1, Math.max(0, v));
	if (master) master.gain.value = volume;
}

/** True once sound is allowed to play (false before the first tap, or if the phone interrupted it). */
export function soundReady(): boolean {
	return nativeAudioAvailable() || (!!ctx && ctx.state === 'running');
}

function schedule(notes: Note[], startAt: number) {
	if (ctx && bus) playScore(ctx, bus, notes, startAt);
}

function ready(): boolean {
	if (!ctx) return false;
	if (ctx.state !== 'running') void ctx.resume();
	return true;
}

/**
 * Plays a named sound: through the native plugin when running inside the app, otherwise (or if
 * the plugin isn't there) with Web Audio via `web`.
 */
function sound(name: SoundName, web: () => void) {
	if (nativeAudioAvailable()) {
		void playNative(name, volume).then((played) => {
			if (!played) web();
		});
		return;
	}
	web();
}

function webPlay(notes: Note[]) {
	if (ready()) schedule(notes, ctx!.currentTime);
}

/** Single clear note, e.g. "10 seconds left". */
export function chime() {
	navigator.vibrate?.(80);
	sound('chime', () => webPlay(chimeScore()));
}

/** Short bright two-note ping, repeated: "your timer just ended, time to switch". */
export function ping(times = 3) {
	// buzz-buzz, pause, buzz-buzz, ... in step with the sound
	const buzz = Array.from({ length: times }, () => [120, 60, 120, PING_GAP * 1000 - 300]).flat();
	navigator.vibrate?.(buzz.slice(0, -1));
	sound(times === 1 ? 'ping-single' : 'ping', () => webPlay(pingScore(times)));
}

function webArpeggio() {
	if (!ready()) return;
	navigator.vibrate?.([200, 100, 200, 100, 300]);
	webPlay(arpeggioScore());
}

/** How long the "all done" screen stays up: the whole fanfare plus a moment to enjoy it. */
export const CELEBRATE_MS = Math.round(
	((CELEBRATE_TIMES - 1) * FANFARE_GAP + FANFARE_LENGTH + 1) * 1000
);

/** Happy fanfare for the end of a session, played three times. */
export function celebrate(times = CELEBRATE_TIMES) {
	const unit = [150, 80, 150, 80, 400, FANFARE_GAP * 1000 - 860];
	navigator.vibrate?.(
		Array.from({ length: times }, () => unit)
			.flat()
			.slice(0, -1)
	);
	const web = () => webPlay(fanfareScore(times));
	// the bundled fanfare file is the standard three plays
	if (times === CELEBRATE_TIMES) sound('fanfare', web);
	else web();
}

/** One ping, so moving the volume slider lets you hear the new level. */
export function previewSound() {
	unlock();
	ping(1);
}

/** For the Settings "Test sound" button. */
export function testSound() {
	unlock();
	ping();
	setTimeout(() => sound('arpeggio', webArpeggio), 3 * PING_GAP * 1000 + 300);
}

/** Repeats until stopAlarm(). Idempotent. */
export function startAlarm(message: string) {
	if (!loop && !nativeLooping) {
		if (nativeAudioAvailable()) {
			nativeLooping = true;
			void loopNative('arpeggio', volume, ALARM_INTERVAL_MS).then((started) => {
				if (started || !nativeLooping) return;
				nativeLooping = false; // the plugin wasn't usable after all: use Web Audio
				startWebLoop();
			});
		} else {
			startWebLoop();
		}
	}
	if (!titleFlash) {
		let on = false;
		titleFlash = setInterval(() => {
			on = !on;
			document.title = on ? `⏰ ${message}` : baseTitle;
		}, 800);
	}
}

function startWebLoop() {
	webArpeggio();
	loop = setInterval(webArpeggio, ALARM_INTERVAL_MS);
}

export function stopAlarm() {
	if (nativeLooping) {
		nativeLooping = false;
		void stopNative();
	}
	if (loop) clearInterval(loop);
	if (titleFlash) clearInterval(titleFlash);
	loop = titleFlash = null;
	if (typeof document !== 'undefined') document.title = baseTitle;
}

export async function keepAwake(on: boolean) {
	try {
		if (on && !wakeLock && 'wakeLock' in navigator) {
			wakeLock = await navigator.wakeLock.request('screen');
			wakeLock.addEventListener('release', () => (wakeLock = null));
		} else if (!on && wakeLock) {
			await wakeLock.release();
			wakeLock = null;
		}
	} catch {
		// wake lock is best-effort
	}
}
