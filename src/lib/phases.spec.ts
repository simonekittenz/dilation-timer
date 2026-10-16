import { describe, expect, it } from 'vitest';
import { WIH_PHASES } from './defaults';
import { chainPhases, findPhaseProblems, phaseLength, resizePhase } from './phases';
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
