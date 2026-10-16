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

/** Short bright two-note ping: "your timer just ended". */
export function ping() {
	if (!ready()) return;
	const t = ctx!.currentTime;
	beep(988, t, 0.18, 0.6);
	beep(1319, t + 0.16, 0.3, 0.6);
	navigator.vibrate?.([120, 60, 120]);
}

function arpeggio() {
	if (!ready()) return;
	const t = ctx!.currentTime;
	beep(523, t, 0.25, 0.8);
	beep(659, t + 0.28, 0.25, 0.8);
	beep(784, t + 0.56, 0.4, 0.8);
	navigator.vibrate?.([200, 100, 200, 100, 300]);
}

/** A few seconds of happy fanfare for the end of a session. */
export function celebrate() {
	if (!ready()) return;
	const t = ctx!.currentTime;
	[523, 659, 784, 1047].forEach((f, i) => beep(f, t + i * 0.18, i === 3 ? 0.7 : 0.25, 0.7));
	[784, 1047, 1319].forEach((f, i) => beep(f, t + 1.5 + i * 0.2, i === 2 ? 1.2 : 0.3, 0.7));
	navigator.vibrate?.([150, 80, 150, 80, 400]);
}

/** For the Settings "Test sound" button. */
export function testSound() {
	unlock();
	ping();
	setTimeout(arpeggio, 700);
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
