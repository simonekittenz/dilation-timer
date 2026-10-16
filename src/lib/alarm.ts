let ctx: AudioContext | null = null;
let loop: ReturnType<typeof setInterval> | null = null;
let wakeLock: WakeLockSentinel | null = null;
const baseTitle = 'Dilation timer';
let titleFlash: ReturnType<typeof setInterval> | null = null;

/** Must be called from a user gesture at least once so the browser allows sound. */
export function unlock() {
	if (typeof window === 'undefined') return;
	ctx ??= new AudioContext();
	if (ctx.state === 'suspended') void ctx.resume();
}

function beep(freq: number, start: number, length: number, gain: number) {
	if (!ctx) return;
	const osc = ctx.createOscillator();
	const amp = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.value = freq;
	amp.gain.setValueAtTime(0, start);
	amp.gain.linearRampToValueAtTime(gain, start + 0.02);
	amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
	osc.connect(amp).connect(ctx.destination);
	osc.start(start);
	osc.stop(start + length + 0.05);
}

/** Soft single chime, e.g. "10 seconds left". */
export function chime() {
	if (!ctx) return;
	if (ctx.state === 'suspended') void ctx.resume();
	beep(660, ctx.currentTime, 0.5, 0.15);
	navigator.vibrate?.(80);
}

function arpeggio() {
	if (!ctx) return;
	if (ctx.state === 'suspended') void ctx.resume();
	const t = ctx.currentTime;
	beep(523, t, 0.25, 0.3);
	beep(659, t + 0.28, 0.25, 0.3);
	beep(784, t + 0.56, 0.4, 0.3);
	navigator.vibrate?.([200, 100, 200, 100, 300]);
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
