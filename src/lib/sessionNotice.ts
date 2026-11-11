import { who } from './backgroundAlerts';
import { formatClock } from './dates';
import { nativePlatform } from './platform';
import { alertStart, isLastStep, isWaitPaused, plannedEnd, remainingMs, waitedMs } from './session';
import type { ActiveSession } from './types';

/**
 * The running session's timer on the lock screen. Android: an ongoing notification (on Android 16 a Live
 * Update), put up when the app goes to the background and taken down when it comes back. iPhone: a Live
 * Activity (lock screen and Dynamic Island), which iOS only lets the app start while it is in front, so
 * it is kept up to date all through the session instead. Either way it only exists during a session, and
 * the phone keeps its clock ticking by itself.
 */
export interface SessionNotice {
	title: string;
	text: string;
	/** What the clock on it does: counts down to `at`, counts up from `at`, or is left out. */
	clock: 'down' | 'up' | 'none';
	/** The moment the clock counts to or from, as a timestamp. */
	at: number;
	/** Takes itself down after this long, so it can never be left behind. */
	expiresInMs: number;
	/** iPhone: what to say instead once a countdown has run out, since nothing can update it by then. */
	afterTitle?: string;
	afterText?: string;
}

/** A notice for a session that is paused or waiting is taken down by itself after this long. */
export const NOTICE_LINGER_MS = 3 * 60 * 60_000;
/** Just past the timer's end, so the alert that takes over never overlaps with it. */
const PAST_END_MS = 500;

/** What the notice should say right now, or null when there should be none. */
export function planSessionNotice(s: ActiveSession | null, now: number): SessionNotice | null {
	if (!s || s.phase === 'finished') return null;
	const current = s.steps[s.stepIndex];
	const next = isLastStep(s) ? null : s.steps[s.stepIndex + 1];

	if (s.phase === 'start') {
		const paused = isWaitPaused(s);
		return {
			title: "Let's get started ♡",
			text: paused ? `Bring in ${who(current)} · paused` : `Bring in ${who(current)}`,
			clock: paused ? 'none' : 'up',
			at: now - waitedMs(s, now),
			expiresInMs: NOTICE_LINGER_MS
		};
	}

	if (s.phase === 'switch') {
		if (!next) return null;
		return {
			title: 'Time to switch ♡',
			text: `Swap to ${who(next)}`,
			clock: 'up',
			at: alertStart(s),
			expiresInMs: NOTICE_LINGER_MS
		};
	}

	const place = `${s.stepIndex + 1} of ${s.steps.length}`;
	if (s.pausedAt != null) {
		return {
			title: `Paused · ${who(current)}`,
			text: `${formatClock(remainingMs(s, now))} left · ${place}`,
			clock: 'none',
			at: now,
			expiresInMs: NOTICE_LINGER_MS
		};
	}

	const end = plannedEnd(s);
	if (end <= now) return null; // the app is about to move on by itself
	return {
		title: `${who(current)} · ${place}`,
		text: next ? `Then ${who(next)}` : 'The last one',
		clock: 'down',
		at: end,
		// when the timer ends the alert for it takes over, so this one goes
		expiresInMs: end - now + PAST_END_MS,
		afterTitle: next ? 'Time to switch ♡' : 'All done! 🎉',
		afterText: next ? `Swap to ${who(next)}` : 'Take the last one out'
	};
}

/** The few parts of the native plugin we use (also what tests replace). */
export interface SessionNoticePlugin {
	show(options: SessionNotice): Promise<void>;
	hide(): Promise<void>;
}

let injected: SessionNoticePlugin | null | undefined;
let loaded: Promise<{ plugin: SessionNoticePlugin }> | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Tests swap in a fake (or `null` for "not available"); `undefined` resets. */
export function setSessionNoticeForTests(p: SessionNoticePlugin | null | undefined) {
	injected = p;
	loaded = null;
	queue = Promise.resolve();
}

/** The Android app (a notification) and the iPhone app (a Live Activity) have this plugin. */
export function sessionNoticeAvailable(): boolean {
	return injected === undefined ? ['android', 'ios'].includes(nativePlatform()) : injected !== null;
}

// A Capacitor plugin answers to every property name, `then` included, so it is only ever passed around
// inside a little wrapper object (see nativeAudio.ts).
function getPlugin(): Promise<{ plugin: SessionNoticePlugin }> {
	if (injected) return Promise.resolve({ plugin: injected });
	loaded ??= import('@capacitor/core').then(({ registerPlugin }) => ({
		plugin: registerPlugin<SessionNoticePlugin>('SessionNotice')
	}));
	return loaded;
}

/** One thing at a time and in order, so a "hide" never overtakes the "show" before it. Never throws. */
function run(task: (p: SessionNoticePlugin) => Promise<void>): Promise<void> {
	if (!sessionNoticeAvailable()) return Promise.resolve();
	const next = queue.then(async () => {
		try {
			const { plugin } = await getPlugin();
			await task(plugin);
		} catch (error) {
			console.warn('The lock screen timer failed.', error);
		}
	});
	queue = next;
	return next;
}

/** Puts the notice up (or replaces it). `null` takes it down. */
export function showSessionNotice(notice: SessionNotice | null): Promise<void> {
	return run((p) => (notice ? p.show(notice) : p.hide()));
}

export const hideSessionNotice = () => run((p) => p.hide());
