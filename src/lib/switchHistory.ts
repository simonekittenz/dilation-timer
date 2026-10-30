import type { LogEntry } from './types';

/** Only the most recent swaps count, so the average follows how you do it now. */
export const MAX_SAMPLES = 10;
/** One very long swap (a phone call, falling asleep) must not drag the average up. */
export const MAX_SAMPLE_MS = 10 * 60_000;

export interface SwitchHistory {
	/** Recent swap times (ms) per dilator name: how long it took to get to it. */
	byLabel: Map<string, number[]>;
	/** The same for all dilators together. */
	all: number[];
	/** Every dilator that has been done in a session before. */
	seen: Set<string>;
}

/** Reads the swap times out of the history. The log is newest first, and skipped sessions have none. */
export function learnSwitches(log: LogEntry[]): SwitchHistory {
	const byLabel = new Map<string, number[]>();
	const all: number[] = [];
	const seen = new Set<string>();
	for (const entry of log) {
		if (entry.skipped) continue;
		for (const step of entry.steps) {
			seen.add(step.label);
			const seconds = step.switchSeconds;
			if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) continue;
			const ms = Math.min(seconds * 1000, MAX_SAMPLE_MS);
			const mine = byLabel.get(step.label) ?? [];
			if (mine.length < MAX_SAMPLES) {
				mine.push(ms);
				byLabel.set(step.label, mine);
			}
			if (all.length < MAX_SAMPLES * 3) all.push(ms);
		}
	}
	return { byLabel, all, seen };
}

const average = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

/**
 * How long you usually take to switch to this dilator, in ms. A dilator you have no swaps for yet uses
 * the average over all your swaps; with no history at all it is 0 (only the Settings window applies).
 */
export function usualSwitchMs(history: SwitchHistory, label: string): number {
	const mine = history.byLabel.get(label);
	if (mine?.length) return Math.round(average(mine));
	return history.all.length ? Math.round(average(history.all)) : 0;
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
 * How long to wait before nudging about the swap to `label`: the Settings window, plus how long you
 * usually take to get to that dilator, plus some extra time the very first time you use it.
 */
export function switchWindowFor(
	history: SwitchHistory,
	label: string | undefined,
	windowMs: number,
	firstTimeExtraMs: number
): number {
	if (!label) return windowMs;
	return (
		windowMs + usualSwitchMs(history, label) + (isFirstTime(history, label) ? firstTimeExtraMs : 0)
	);
}
