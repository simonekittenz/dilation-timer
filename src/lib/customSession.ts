import { phaseForDay } from './schedule';
import type { Phase, Step } from './types';

/** Custom sessions are planned in blocks of this many minutes. */
export const BLOCK = 5;
export const MIN_TOTAL = 10;
export const MAX_TOTAL = 180;

export const roundToBlock = (minutes: number) =>
	Math.max(BLOCK, Math.round(minutes / BLOCK) * BLOCK);

/** "45 min", "1 h", "1 h 15 min". */
export function formatDuration(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export const totalMinutes = (steps: Step[]) =>
	Math.round(steps.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0) * 10) / 10;

/**
 * Shares `units` among the items in proportion to `weights`, giving every item at least one, and
 * making the shares add up to exactly `units`. Rounding leftovers go to whoever lost the most.
 */
function apportion(units: number, weights: number[]): number[] {
	const n = weights.length;
	if (n === 0) return [];
	const w = weights.some((x) => x > 0) ? weights : weights.map(() => 1);
	const sum = w.reduce((a, b) => a + b, 0);
	const ideal = w.map((x) => (x / sum) * units);
	const shares = ideal.map((x) => Math.max(1, Math.floor(x)));
	let diff = units - shares.reduce((a, b) => a + b, 0);
	// ties go to the bigger weight, then the later item
	const ranked = (cmp: (i: number, j: number) => number) =>
		[...shares.keys()].sort((i, j) => cmp(i, j) || w[j] - w[i] || j - i);
	while (diff > 0) {
		shares[ranked((i, j) => ideal[j] - shares[j] - (ideal[i] - shares[i]))[0]]++;
		diff--;
	}
	while (diff < 0) {
		const pick = ranked((i, j) => shares[j] - ideal[j] - (shares[i] - ideal[i])).find(
			(i) => shares[i] > 1
		);
		if (pick === undefined) break;
		shares[pick]--;
		diff++;
	}
	return shares;
}

export interface Scaled {
	steps: Step[];
	/** Dilators that no longer fit and were left out (the smallest first). */
	dropped: string[];
}

/**
 * Stretches or squeezes a routine to `targetMinutes`, in blocks of 5 minutes, adding up exactly.
 *  - A dilator already at 5 minutes stays at 5 for as long as possible; the others take the change,
 *    in proportion to their time.
 *  - If every dilator is at 5 minutes and there is more time, the last (largest) one gets it.
 *  - If there isn't even 5 minutes for each dilator, the smallest ones are left out.
 */
export function scaleSteps(steps: Step[], targetMinutes: number): Scaled {
	const n = steps.length;
	const units = Math.max(1, Math.round(targetMinutes / BLOCK));
	if (n === 0) return { steps: [], dropped: [] };

	if (units < n) {
		const keep = steps.slice(n - units);
		return {
			steps: keep.map((s) => ({ ...s, minutes: BLOCK })),
			dropped: steps.slice(0, n - units).map((s) => s.dilatorId)
		};
	}

	const pinned = steps.map((s) => s.minutes <= BLOCK);
	const flex = steps.map((_, i) => i).filter((i) => !pinned[i]);
	const shares = steps.map(() => 1);
	if (flex.length === 0) {
		shares[n - 1] += units - n;
	} else {
		const pinnedCount = n - flex.length;
		const split = apportion(
			units - pinnedCount,
			flex.map((i) => steps[i].minutes)
		);
		flex.forEach((stepIndex, k) => (shares[stepIndex] = split[k]));
	}
	return { steps: steps.map((s, i) => ({ ...s, minutes: shares[i] * BLOCK })), dropped: [] };
}

/**
 * The routine to start from: today's, or on a rest day the next one that has dilators (or, after
 * the last one, the latest).
 */
export function baseSteps(phases: Phase[], day: number): Step[] {
	const today = phaseForDay(phases, day);
	if (today && today.steps.length > 0) return today.steps;
	const withSteps = phases.filter((p) => p.steps.length > 0).sort((a, b) => a.fromDay - b.fromDay);
	return (withSteps.find((p) => p.fromDay > day) ?? withSteps.at(-1))?.steps ?? [];
}

/** How long the slider starts at: the routine's own length, kept within the slider's range. */
export function defaultTotal(steps: Step[]): number {
	return Math.min(MAX_TOTAL, Math.max(MIN_TOTAL, roundToBlock(totalMinutes(steps))));
}

/**
 * The first plan for a custom session: the chosen dilators (in kit order), with the minutes they have
 * in the base routine (5 for ones it doesn't use), stretched or squeezed to `targetMinutes`.
 */
export function inferCustomSteps(
	base: Step[],
	selectedIds: string[],
	kitOrder: string[],
	targetMinutes: number
): Scaled {
	const minutesById = new Map<string, number>();
	for (const s of base)
		minutesById.set(s.dilatorId, (minutesById.get(s.dilatorId) ?? 0) + s.minutes);
	const rank = (id: string) => {
		const i = kitOrder.indexOf(id);
		return i === -1 ? kitOrder.length : i;
	};
	const chosen = [...new Set(selectedIds)].sort((a, b) => rank(a) - rank(b));
	return scaleSteps(
		chosen.map((id) => ({ dilatorId: id, minutes: minutesById.get(id) ?? BLOCK })),
		targetMinutes
	);
}
