type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

let ctx: AudioContext | null = null;
/** Everything plays into `bus`: lowpass -> limiter -> master volume -> speakers. */
let bus: AudioNode | null = null;
let master: GainNode | null = null;
let volume = 1;
let loop: ReturnType<typeof setInterval> | null = null;
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
	// Phone speakers are weak, so notes are loud sustained squares; the lowpass keeps them
	// from sounding harsh and the limiter stops overlapping notes from distorting.
	const lowpass = c.createBiquadFilter();
	lowpass.type = 'lowpass';
	lowpass.frequency.value = 4000;
	const limiter = c.createDynamicsCompressor();
	limiter.threshold.value = -8;
	limiter.knee.value = 0;
	limiter.ratio.value = 20;
	limiter.attack.value = 0.002;
	limiter.release.value = 0.1;
	master = c.createGain();
	master.gain.value = volume;
	lowpass.connect(limiter);
	limiter.connect(master);
	master.connect(c.destination);
	bus = lowpass;
}

/** 0 (silent) to 1 (full), from the Settings volume slider. */
export function setVolume(v: number) {
	volume = Math.min(1, Math.max(0, v));
	if (master) master.gain.value = volume;
}

/** True once sound is allowed to play (false before the first tap, or if the phone interrupted it). */
export function soundReady(): boolean {
	return !!ctx && ctx.state === 'running';
}

/** A note that holds its level and then drops away, so it stays loud for its whole length. */
function beep(freq: number, start: number, length: number, gain: number) {
	if (!ctx || !bus) return;
	const osc = ctx.createOscillator();
	const amp = ctx.createGain();
	osc.type = 'square';
	osc.frequency.value = freq;
	const release = Math.min(0.08, length / 2);
	amp.gain.setValueAtTime(0, start);
	amp.gain.linearRampToValueAtTime(gain, start + 0.008);
	amp.gain.setValueAtTime(gain, start + length - release);
	amp.gain.linearRampToValueAtTime(0, start + length);
	osc.connect(amp).connect(bus);
	osc.start(start);
	osc.stop(start + length + 0.02);
}

function ready(): boolean {
	if (!ctx) return false;
	if (ctx.state !== 'running') void ctx.resume();
	return true;
}

/** Single clear note, e.g. "10 seconds left". */
export function chime() {
	if (!ready()) return;
	beep(880, ctx!.currentTime, 0.4, 0.6);
	navigator.vibrate?.(80);
}

/** Seconds between repeats of the switch ping; three fit inside the bunny-ears cue. */
export const PING_GAP = 1.1;

/** Short bright two-note ping, repeated: "your timer just ended, time to switch". */
export function ping(times = 3) {
	if (!ready()) return;
	const t = ctx!.currentTime;
	for (let i = 0; i < times; i++) {
		const at = t + i * PING_GAP;
		beep(988, at, 0.18, 0.9);
		beep(1319, at + 0.16, 0.3, 0.9);
	}
	// buzz-buzz, pause, buzz-buzz, ... in step with the sound
	const buzz = Array.from({ length: times }, () => [120, 60, 120, PING_GAP * 1000 - 300]).flat();
	navigator.vibrate?.(buzz.slice(0, -1));
}

function arpeggio() {
	if (!ready()) return;
	const t = ctx!.currentTime;
	beep(1047, t, 0.25, 0.9);
	beep(1319, t + 0.28, 0.25, 0.9);
	beep(1568, t + 0.56, 0.4, 0.9);
	navigator.vibrate?.([200, 100, 200, 100, 300]);
}

/** One fanfare is about 2s long; the gap leaves a beat of silence before it repeats. */
const FANFARE_LENGTH = 2.0;
export const FANFARE_GAP = 2.3;
export const CELEBRATE_TIMES = 3;

/** How long the "all done" screen stays up: the whole fanfare plus a moment to enjoy it. */
export const CELEBRATE_MS = Math.round(
	((CELEBRATE_TIMES - 1) * FANFARE_GAP + FANFARE_LENGTH + 1) * 1000
);

/** Happy fanfare for the end of a session, played three times. */
export function celebrate(times = CELEBRATE_TIMES) {
	if (!ready()) return;
	const t0 = ctx!.currentTime;
	for (let i = 0; i < times; i++) {
		const t = t0 + i * FANFARE_GAP;
		[1047, 1319, 1568, 2093].forEach((f, k) => beep(f, t + k * 0.18, k === 3 ? 0.5 : 0.25, 0.9));
		[1568, 2093, 2637].forEach((f, k) => beep(f, t + 1.0 + k * 0.2, k === 2 ? 0.6 : 0.3, 0.9));
	}
	const unit = [150, 80, 150, 80, 400, FANFARE_GAP * 1000 - 860];
	navigator.vibrate?.(
		Array.from({ length: times }, () => unit)
			.flat()
			.slice(0, -1)
	);
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
	setTimeout(arpeggio, 3 * PING_GAP * 1000 + 300);
}

/** Repeats until stopAlarm(). Idempotent. */
export function startAlarm(message: string) {
	if (!loop) {
		arpeggio();
		loop = setInterval(arpeggio, 2500);
	}
	if (!titleFlash) {
		let on = false;
		titleFlash = setInterval(() => {
			on = !on;
			document.title = on ? `⏰ ${message}` : baseTitle;
		}, 800);
	}
}

export function stopAlarm() {
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
