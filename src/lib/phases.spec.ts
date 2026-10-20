import { describe, expect, it } from 'vitest';
import { WIH_PHASES } from './defaults';
import { chainPhases, findPhaseProblems, phaseLength, pushBackPhase, resizePhase } from './phases';
import { phaseForDay } from './schedule';
import type { Phase } from './types';

const wih = () => structuredClone(WIH_PHASES);
const byId = (phases: Phase[], id: string) => phases.find((p) => p.id === id)!;

describe('resizePhase', () => {
	it('pushes every later phase back when a day is added (extra stitches, one day delay)', () => {
		const before = wih();
		const after = resizePhase(before, 'wih-week-0', 8);

		expect(byId(after, 'wih-week-0')).toMatchObject({ fromDay: 1, toDay: 8 });
		// the first dilation day moves from day 8 to day 9...
		expect(byId(after, 'wih-week-1-day-1')).toMatchObject({ fromDay: 9, toDay: 9 });
		expect(phaseForDay(after, 8)?.id).toBe('wih-week-0');
		expect(phaseForDay(after, 9)?.id).toBe('wih-week-1-day-1');
		// ...and so does everything after it, by exactly one day
		for (const old of before.slice(1)) {
			const moved = byId(after, old.id);
			expect(moved.fromDay).toBe(old.fromDay + 1);
			expect(moved.toDay).toBe(old.toDay === null ? null : old.toDay + 1);
		}
		expect(findPhaseProblems(after)).toEqual([]);
	});

	it('does not touch the phases before the one you changed, or the original list', () => {
		const before = wih();
		const snapshot = structuredClone(before);
		const oldEnd = byId(before, 'wih-week-4').toDay!;
		const after = resizePhase(before, 'wih-week-4', oldEnd + 3);
		expect(before).toEqual(snapshot);
		expect(byId(after, 'wih-week-3')).toEqual(byId(before, 'wih-week-3'));
		expect(byId(after, 'wih-week-4').toDay).toBe(oldEnd + 3);
		expect(byId(after, 'wih-week-5').fromDay).toBe(byId(before, 'wih-week-5').fromDay + 3);
	});

	it('pulls the schedule forward when a phase gets shorter', () => {
		const after = resizePhase(wih(), 'wih-week-0', 6);
		expect(byId(after, 'wih-week-1-day-1').fromDay).toBe(7);
		expect(findPhaseProblems(after)).toEqual([]);
	});

	it('never lets a phase end before it starts', () => {
		const after = resizePhase(wih(), 'wih-week-2', 1);
		const week2 = byId(after, 'wih-week-2');
		expect(week2.toDay).toBe(week2.fromDay);
		expect(phaseLength(week2)).toBe(1);
		expect(findPhaseProblems(after)).toEqual([]);
	});

	it('leaves open-ended phases and bad input alone', () => {
		const phases = wih();
		expect(resizePhase(phases, 'wih-year-3-plus', 900)).toBe(phases);
		expect(resizePhase(phases, 'nope', 9)).toBe(phases);
		expect(resizePhase(phases, 'wih-week-2', NaN)).toBe(phases);
		expect(resizePhase(phases, 'wih-week-2', byId(phases, 'wih-week-2').toDay!)).toBe(phases);
	});

	it('keeps the whole program contiguous after many edits', () => {
		let p = wih();
		p = resizePhase(p, 'wih-week-0', 9);
		p = resizePhase(p, 'wih-week-3', byId(p, 'wih-week-3').toDay! + 2);
		p = resizePhase(p, 'wih-week-0', 7);
		expect(findPhaseProblems(p)).toEqual([]);
		expect(byId(p, 'wih-week-3').toDay! - byId(wih(), 'wih-week-3').toDay!).toBe(2);
	});
});

describe('findPhaseProblems / chainPhases', () => {
	const mk = (id: string, fromDay: number, toDay: number | null): Phase => ({
		id,
		label: id,
		fromDay,
		toDay,
		slots: [],
		steps: []
	});

	it('spots the overlap you get from only editing "To day" (the original bug)', () => {
		const phases = wih();
		byId(phases, 'wih-week-0').toDay = 8; // what editing just that field used to do
		expect(findPhaseProblems(phases)).toEqual([
			{ id: 'wih-week-1-day-1', kind: 'overlap', after: 'wih-week-0' }
		]);
	});

	it('spots gaps', () => {
		expect(findPhaseProblems([mk('a', 1, 7), mk('b', 10, 14)])).toEqual([
			{ id: 'b', kind: 'gap', after: 'a' }
		]);
		expect(findPhaseProblems([mk('a', 1, 7), mk('b', 8, null)])).toEqual([]);
	});

	it('closes gaps and overlaps, keeping each phase length and order', () => {
		const messy = [mk('a', 1, 8), mk('b', 8, 14), mk('c', 20, 22), mk('d', 23, null)];
		const fixed = chainPhases(messy);
		expect(fixed.map((p) => [p.id, p.fromDay, p.toDay])).toEqual([
			['a', 1, 8],
			['b', 9, 15],
			['c', 16, 18],
			['d', 19, null]
		]);
		expect(findPhaseProblems(fixed)).toEqual([]);
	});

	it('leaves an already tidy program untouched', () => {
		expect(chainPhases(wih())).toEqual(wih());
	});
});

describe('pushBackPhase', () => {
	it('starts the phase later, moves everything after it, and the phase before carries on', () => {
		const before = wih();
		const after = pushBackPhase(before, 'wih-week-2', 7);
		const week2 = byId(before, 'wih-week-2');

		expect(byId(after, 'wih-week-2').fromDay).toBe(week2.fromDay + 7);
		expect(byId(after, 'wih-week-1-day-4-7').toDay).toBe(week2.fromDay + 6);
		for (const p of before.filter((x) => x.fromDay >= week2.fromDay)) {
			const moved = byId(after, p.id);
			expect(moved.fromDay).toBe(p.fromDay + 7);
			expect(moved.toDay).toBe(p.toDay === null ? null : p.toDay + 7);
		}
		// the earlier phases are untouched, apart from the one that now runs longer
		for (const p of before.filter((x) => x.toDay !== null && x.toDay < week2.fromDay - 1)) {
			expect(byId(after, p.id)).toEqual(p);
		}
		expect(findPhaseProblems(after)).toEqual([]);
	});

	it('leaves every day with a routine: the days you stay on the old one, then the new phase', () => {
		const week2 = byId(wih(), 'wih-week-2');
		const after = pushBackPhase(wih(), 'wih-week-2', 1);
		expect(phaseForDay(after, week2.fromDay)?.id).toBe('wih-week-1-day-4-7');
		expect(phaseForDay(after, week2.fromDay + 1)?.id).toBe('wih-week-2');
	});

	it('works for one day, and keeps the length of every phase', () => {
		const before = wih();
		const after = pushBackPhase(before, 'wih-week-5', 1);
		expect(byId(after, 'wih-week-5').fromDay).toBe(byId(before, 'wih-week-5').fromDay + 1);
		expect(phaseLength(byId(after, 'wih-week-5'))).toBe(phaseLength(byId(before, 'wih-week-5')));
		expect(phaseLength(byId(after, 'wih-week-4'))).toBe(
			phaseLength(byId(before, 'wih-week-4'))! + 1
		);
		expect(byId(after, 'wih-year-3-plus').toDay).toBeNull();
		expect(findPhaseProblems(after)).toEqual([]);
	});

	it('can be undone by pushing the phase before it back to its old length', () => {
		const before = wih();
		const after = pushBackPhase(before, 'wih-week-6', 7);
		expect(resizePhase(after, 'wih-week-5', byId(before, 'wih-week-5').toDay!)).toEqual(before);
	});

	it('fills the days with a rest phase when nothing comes before', () => {
		const first = wih().filter((p) => p.id !== 'wih-week-0');
		const after = pushBackPhase(first, 'wih-week-1-day-1', 3);
		const rest = after.find((p) => !first.some((q) => q.id === p.id))!;
		expect(rest).toMatchObject({ fromDay: 8, toDay: 10, slots: [], steps: [] });
		expect(after.indexOf(rest)).toBe(0);
		expect(byId(after, 'wih-week-1-day-1').fromDay).toBe(11);
		expect(findPhaseProblems(after)).toEqual([]);
	});

	it('does not change anything for an unknown phase or a pointless amount', () => {
		const before = wih();
		expect(pushBackPhase(before, 'nope', 7)).toBe(before);
		expect(pushBackPhase(before, 'wih-week-2', 0)).toBe(before);
		expect(pushBackPhase(before, 'wih-week-2', -3)).toBe(before);
		expect(pushBackPhase(before, 'wih-week-2', Number.NaN)).toBe(before);
	});

	it('does not change the list it was given', () => {
		const before = wih();
		const snapshot = structuredClone(before);
		pushBackPhase(before, 'wih-week-3', 7);
		expect(before).toEqual(snapshot);
	});
});
