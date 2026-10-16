type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

let ctx: AudioContext | null = null;
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
	}
	if (ctx.state === 'running') return;
	void ctx.resume();
	// A silent one-sample blip inside the gesture is what finally unlocks iOS.
	const blip = ctx.createBufferSource();
	blip.buffer = ctx.createBuffer(1, 1, 22050);
	blip.connect(ctx.destination);
	blip.start(0);
}

/** True once sound is allowed to play (false before the first tap, or if the phone interrupted it). */
export function soundReady(): boolean {
	return !!ctx && ctx.state === 'running';
}

function beep(freq: number, start: number, length: number, gain: number) {
	if (!ctx) return;
	const osc = ctx.createOscillator();
	const amp = ctx.createGain();
	osc.type = 'triangle';
	osc.frequency.value = freq;
	amp.gain.setValueAtTime(0, start);
	amp.gain.linearRampToValueAtTime(gain, start + 0.02);
	amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
	osc.connect(amp).connect(ctx.destination);
	osc.start(start);
	osc.stop(start + length + 0.05);
}

function ready(): boolean {
	if (!ctx) return false;
	if (ctx.state !== 'running') void ctx.resume();
	return true;
}

/** Soft single chime, e.g. "10 seconds left". */
export function chime() {
	if (!ready()) return;
	beep(660, ctx!.currentTime, 0.5, 0.35);
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
		beep(988, at, 0.18, 0.6);
		beep(1319, at + 0.16, 0.3, 0.6);
	}
	// buzz-buzz, pause, buzz-buzz, ... in step with the sound
	const buzz = Array.from({ length: times }, () => [120, 60, 120, PING_GAP * 1000 - 300]).flat();
	navigator.vibrate?.(buzz.slice(0, -1));
}

function arpeggio() {
	if (!ready()) return;
	const t = ctx!.currentTime;
	beep(523, t, 0.25, 0.8);
	beep(659, t + 0.28, 0.25, 0.8);
	beep(784, t + 0.56, 0.4, 0.8);
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
		[523, 659, 784, 1047].forEach((f, k) => beep(f, t + k * 0.18, k === 3 ? 0.5 : 0.25, 0.7));
		[784, 1047, 1319].forEach((f, k) => beep(f, t + 1.0 + k * 0.2, k === 2 ? 0.6 : 0.3, 0.7));
	}
	const unit = [150, 80, 150, 80, 400, FANFARE_GAP * 1000 - 860];
	navigator.vibrate?.(
		Array.from({ length: times }, () => unit)
			.flat()
			.slice(0, -1)
	);
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
