import type { Phase } from './types';

/** Number of days a phase covers, or null if it has no end ("from day N onwards"). */
export function phaseLength(p: Phase): number | null {
	return p.toDay === null ? null : p.toDay - p.fromDay + 1;
}

/**
 * Changes the last day of a phase and moves every phase that comes after it by the same
 * amount, so lengthening Week 0 by a day pushes the whole dilation schedule back a day.
 * A phase can't end before it starts, and an open-ended phase has nothing to push.
 */
export function resizePhase(phases: Phase[], id: string, newToDay: number): Phase[] {
	const target = phases.find((p) => p.id === id);
	if (!target || target.toDay === null || !Number.isFinite(newToDay)) return phases;
	const oldTo = target.toDay;
	const newTo = Math.max(target.fromDay, Math.round(newToDay));
	const delta = newTo - oldTo;
	if (delta === 0) return phases;
	return phases.map((p) => {
		if (p.id === id) return { ...p, toDay: newTo };
		if (p.fromDay <= oldTo) return p;
		return { ...p, fromDay: p.fromDay + delta, toDay: p.toDay === null ? null : p.toDay + delta };
	});
}

/**
 * Starts a phase `days` later. It and every phase after it move back by that much, and the phase
 * before it carries on through the days that open up (a rest phase fills them if nothing comes
 * before), so no day is left without a routine.
 */
export function pushBackPhase(phases: Phase[], id: string, days: number): Phase[] {
	const shift = Math.round(days);
	const ordered = inDayOrder(phases);
	const at = ordered.findIndex((p) => p.id === id);
	if (at < 0 || !Number.isFinite(shift) || shift < 1) return phases;
	const target = ordered[at];
	const moving = new Set(ordered.slice(at).map((p) => p.id));
	const lastFreedDay = target.fromDay + shift - 1;
	const before = ordered[at - 1];
	const moved = phases.map((p) => {
		if (moving.has(p.id)) {
			return { ...p, fromDay: p.fromDay + shift, toDay: p.toDay === null ? null : p.toDay + shift };
		}
		return p.id === before?.id ? { ...p, toDay: lastFreedDay } : p;
	});
	if (before) return moved;
	const rest: Phase = {
		id: `rest-${crypto.randomUUID().slice(0, 8)}`,
		label: 'Rest',
		fromDay: target.fromDay,
		toDay: lastFreedDay,
		slots: [],
		steps: []
	};
	const index = phases.findIndex((p) => p.id === id);
	return [...moved.slice(0, index), rest, ...moved.slice(index)];
}

export interface PhaseProblem {
	id: string;
	kind: 'overlap' | 'gap';
	/** The phase before this one, in day order. */
	after: string;
}

function inDayOrder(phases: Phase[]): Phase[] {
	return phases
		.map((p, i) => ({ p, i }))
		.sort((a, b) => a.p.fromDay - b.p.fromDay || a.i - b.i)
		.map((x) => x.p);
}

/** Phases that overlap the one before them, or leave days uncovered after it. */
export function findPhaseProblems(phases: Phase[]): PhaseProblem[] {
	const ordered = inDayOrder(phases);
	const problems: PhaseProblem[] = [];
	for (let i = 1; i < ordered.length; i++) {
		const prev = ordered[i - 1];
		const cur = ordered[i];
		if (prev.toDay === null || cur.fromDay <= prev.toDay) {
			problems.push({ id: cur.id, kind: 'overlap', after: prev.id });
		} else if (cur.fromDay > prev.toDay + 1) {
			problems.push({ id: cur.id, kind: 'gap', after: prev.id });
		}
	}
	return problems;
}

/** Lines the phases up one after another again, keeping each phase's length. */
export function chainPhases(phases: Phase[]): Phase[] {
	const ordered = inDayOrder(phases);
	const chained = new Map<string, Phase>();
	let next = ordered[0]?.fromDay ?? 1;
	for (const p of ordered) {
		const length = phaseLength(p);
		chained.set(p.id, { ...p, fromDay: next, toDay: length === null ? null : next + length - 1 });
		if (length === null) next += 1;
		else next += length;
	}
	return phases.map((p) => chained.get(p.id)!);
}
