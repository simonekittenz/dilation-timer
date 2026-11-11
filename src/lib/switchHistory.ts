import type { LogEntry } from './types';

/** Only the most recent swaps count, so the typical time follows how you do it now. */
export const MAX_SAMPLES = 10;
/** One very long swap (a phone call, falling asleep) must not drag the typical time up. */
export const MAX_SAMPLE_MS = 10 * 60_000;
/** A dilator needs this many swaps before its own typical time is trusted. */
export const MIN_SAMPLES = 3;
/** The most the typical swap time can ever be, so the nudge can never run away. */
export const MAX_LEARNED_MS = 10 * 60_000;
/** The typical time goes up by at most this much per swap (it can come down at once). */
export const MAX_RISE_MS = 60_000;
/** Nudging late is worse than nudging early, so aim above the middle: three out of four swaps are quicker. */
const PERCENTILE = 0.75;
/** A swap this much slower than the middle one is a flyer (you forgot, something came up). */
const FLYER_FACTOR = 2;
const FLYER_EXTRA_MS = 2 * 60_000;
/** Only this many of the latest swaps are replayed, which is plenty and keeps it quick. */
const REPLAYED_SAMPLES = 30;

export interface SwitchHistory {
	/** Your typical swap time (ms) to each dilator, once it has enough swaps to say. */
	typical: Map<string, number>;
	/** The same for all dilators together, once there are enough swaps. */
	typicalAll: number | null;
	/** Every dilator that has been done in a session before. */
	seen: Set<string>;
}

/** Linear spot between the neighbours; `sorted` is not empty. */
function percentile(sorted: number[], p: number): number {
	const at = (sorted.length - 1) * p;
	const below = Math.floor(at);
	const above = Math.ceil(at);
	return sorted[below] + (sorted[above] - sorted[below]) * (at - below);
}

/** Leaves out the flyers, then takes the swap that three out of four were quicker than. */
function typicalOf(samples: number[]): number {
	const sorted = [...samples].sort((a, b) => a - b);
	const middle = percentile(sorted, 0.5);
	const kept = sorted.filter((x) => x <= Math.max(middle * FLYER_FACTOR, middle + FLYER_EXTRA_MS));
	return percentile(kept, PERCENTILE);
}

/**
 * The typical time after replaying swaps oldest first, or null with too few. It follows the recent swaps
 * but only creeps up a little per swap, so a bad patch cannot push the nudge back by a lot.
 */
function replay(samples: number[]): number | null {
	const recent = samples.slice(-REPLAYED_SAMPLES);
	let typical: number | null = null;
	for (let n = MIN_SAMPLES; n <= recent.length; n++) {
		const target = Math.min(
			typicalOf(recent.slice(Math.max(0, n - MAX_SAMPLES), n)),
			MAX_LEARNED_MS
		);
		typical = typical === null ? target : Math.min(target, typical + MAX_RISE_MS);
	}
	return typical === null ? null : Math.round(typical);
}

/**
 * Reads your typical swap times out of the history. The log is newest first, and skipped sessions have
 * none. Left out of what is learned:
 * - the first swap to a dilator: it is slow on purpose and says little about the usual swap;
 * - swaps you only made after the nudge without asking for time (no "+1 min", no "Chill out"): that is
 *   most likely forgetting, not swapping. If you asked for time you were busy swapping, so it counts.
 */
export function learnSwitches(log: LogEntry[]): SwitchHistory {
	const all: number[] = [];
	const perLabel = new Map<string, number[]>();
	const seen = new Set<string>();
	// oldest first, so the first time with a dilator is found before the later ones
	for (let i = log.length - 1; i >= 0; i--) {
		const entry = log[i];
		if (entry.skipped) continue;
		for (const step of entry.steps) {
			const first = !seen.has(step.label);
			seen.add(step.label);
			const seconds = step.switchSeconds;
			if (first || typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0)
				continue;
			if (step.switchNudged && !step.switchAskedMore) continue;
			const ms = Math.min(seconds * 1000, MAX_SAMPLE_MS);
			all.push(ms);
			const mine = perLabel.get(step.label) ?? [];
			mine.push(ms);
			perLabel.set(step.label, mine);
		}
	}
	const typical = new Map<string, number>();
	for (const [label, xs] of perLabel) {
		const t = replay(xs);
		if (t !== null) typical.set(label, t);
	}
	return { typical, typicalAll: replay(all), seen };
}

/**
 * How long you usually take to switch to this dilator, in ms. A dilator without enough swaps yet uses
 * all your swaps together; with none of those either it is 0 (only the Settings window applies).
 */
export function usualSwitchMs(history: SwitchHistory, label: string): number {
	return history.typical.get(label) ?? history.typicalAll ?? 0;
}

/** "45 s", "2 min", "1 min 20 s". */
export function describeSwitch(ms: number): string {
	const total = Math.round(ms / 1000);
	if (total < 60) return `${total} s`;
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

/** True the first time a dilator is used: nothing in your history has it yet. */
export const isFirstTime = (history: SwitchHistory, label: string) => !history.seen.has(label);

/**
 * How long to wait before nudging about the swap to `label`: your usual swap time to that dilator, but
 * never less than the Settings window (that time is already quiet time, so it is not added on top), plus
 * some extra time the very first time you use it.
 */
export function switchWindowFor(
	history: SwitchHistory,
	label: string | undefined,
	windowMs: number,
	firstTimeExtraMs: number
): number {
	if (!label) return windowMs;
	return (
		Math.max(windowMs, usualSwitchMs(history, label)) +
		(isFirstTime(history, label) ? firstTimeExtraMs : 0)
	);
}
