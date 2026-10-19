import { describe, expect, it } from 'vitest';
import {
	baseSteps,
	defaultTotal,
	formatDuration,
	inferCustomSteps,
	roundToBlock,
	scaleSteps,
	totalMinutes
} from './customSession';
import { WIH_PHASES, WIH_SIZE5_PHASES } from './defaults';
import type { Step } from './types';

const steps = (...pairs: [number, number][]): Step[] =>
	pairs.map(([size, minutes]) => ({ dilatorId: `d${size}`, minutes }));
const minutesOf = (s: Step[]) => s.map((x) => x.minutes);
const idsOf = (s: Step[]) => s.map((x) => x.dilatorId);

describe('scaleSteps: stretching and squeezing a routine in blocks of 5 minutes', () => {
	it('keeps dilators that are already at 5 minutes at 5, and the big one takes the change', () => {
		const week10 = steps([1, 5], [2, 5], [3, 5], [4, 60]); // 75
		expect(minutesOf(scaleSteps(week10, 60).steps)).toEqual([5, 5, 5, 45]);
		expect(minutesOf(scaleSteps(week10, 120).steps)).toEqual([5, 5, 5, 105]);
		expect(minutesOf(scaleSteps(week10, 30).steps)).toEqual([5, 5, 5, 15]);
	});

	it('shares the change in proportion when nothing is at 5 minutes', () => {
		const week2 = steps([0, 25], [1, 50]); // 75
		expect(minutesOf(scaleSteps(week2, 120).steps)).toEqual([40, 80]);
		expect(minutesOf(scaleSteps(week2, 60).steps)).toEqual([20, 40]);
	});

	it('mixed routines: the 5-minute ones stay, the rest scale', () => {
		const r = steps([0, 5], [1, 10], [2, 10], [3, 50]); // week 6: 75
		const out = scaleSteps(r, 120).steps;
		expect(out[0].minutes).toBe(5);
		expect(totalMinutes(out)).toBe(120);
		expect(out[3].minutes).toBeGreaterThan(out[1].minutes);
	});

	it('always adds up to exactly the target and uses only multiples of 5', () => {
		const routines = [
			steps([0, 25], [1, 50]),
			steps([0, 25], [1, 25], [2, 25]),
			steps([0, 10], [1, 15], [2, 50]),
			steps([0, 10], [1, 10], [2, 30], [3, 25]),
			steps([1, 10], [2, 10], [3, 40], [4, 15]),
			steps([1, 5], [2, 5], [3, 15], [4, 50]),
			steps([1, 5], [2, 5], [3, 5], [4, 50], [5, 10]),
			steps([3, 5], [4, 55]),
			steps([0, 120]),
			steps([2, 7], [3, 33]) // odd minutes
		];
		for (const r of routines)
			for (let target = 10; target <= 180; target += 5) {
				const out = scaleSteps(r, target);
				const kept = out.steps;
				expect(totalMinutes(kept)).toBe(target);
				for (const s of kept) {
					expect(s.minutes % 5).toBe(0);
					expect(s.minutes).toBeGreaterThanOrEqual(5);
				}
				expect(kept.length + out.dropped.length).toBe(r.length);
			}
	});

	it('does not change a routine when asked for its own length', () => {
		for (const phase of [...WIH_PHASES, ...WIH_SIZE5_PHASES].filter((p) => p.steps.length)) {
			expect(scaleSteps(phase.steps, totalMinutes(phase.steps)).steps).toEqual(phase.steps);
		}
	});

	it('keeps the order and the dilators', () => {
		const r = steps([1, 5], [2, 5], [3, 15], [4, 50]);
		expect(idsOf(scaleSteps(r, 120).steps)).toEqual(['d1', 'd2', 'd3', 'd4']);
	});

	it('when everything is already at 5 minutes, extra time goes to the last dilator', () => {
		expect(minutesOf(scaleSteps(steps([1, 5], [2, 5], [3, 5]), 60).steps)).toEqual([5, 5, 50]);
		expect(minutesOf(scaleSteps(steps([1, 5], [2, 5], [3, 5]), 15).steps)).toEqual([5, 5, 5]);
	});

	it('leaves the smallest dilators out when there is not 5 minutes for each', () => {
		const r = steps([1, 5], [2, 5], [3, 5], [4, 60]);
		const out = scaleSteps(r, 10);
		expect(idsOf(out.steps)).toEqual(['d3', 'd4']);
		expect(out.dropped).toEqual(['d1', 'd2']);
		expect(minutesOf(out.steps)).toEqual([5, 5]);
		expect(scaleSteps(r, 5).steps.map((s) => s.dilatorId)).toEqual(['d4']);
	});

	it('nothing is left out when everything fits', () => {
		expect(scaleSteps(steps([1, 5], [2, 5], [3, 5], [4, 60]), 20).dropped).toEqual([]);
	});

	it('handles an empty routine and a single dilator', () => {
		expect(scaleSteps([], 60)).toEqual({ steps: [], dropped: [] });
		expect(minutesOf(scaleSteps(steps([0, 30]), 90).steps)).toEqual([90]);
		expect(minutesOf(scaleSteps(steps([0, 30]), 5).steps)).toEqual([5]);
	});

	it('does not touch the routine it is given', () => {
		const r = steps([1, 5], [4, 60]);
		const copy = structuredClone(r);
		scaleSteps(r, 120);
		expect(r).toEqual(copy);
	});

	it('is deterministic, with the quick buttons landing on sensible numbers', () => {
		const week5 = steps([0, 10], [1, 10], [2, 30], [3, 25]);
		expect(minutesOf(scaleSteps(week5, 60).steps)).toEqual([5, 10, 25, 20]);
		expect(minutesOf(scaleSteps(week5, 120).steps)).toEqual([15, 15, 50, 40]);
		expect(minutesOf(scaleSteps(week5, 60).steps)).toEqual(minutesOf(scaleSteps(week5, 60).steps));
	});
});

describe('inferCustomSteps: the first plan for a custom session', () => {
	const kit = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'];
	const base = steps([1, 5], [2, 5], [3, 5], [4, 60]);

	it("uses today's dilators and times, scaled", () => {
		const out = inferCustomSteps(base, ['d1', 'd2', 'd3', 'd4'], kit, 60);
		expect(minutesOf(out.steps)).toEqual([5, 5, 5, 45]);
	});

	it('puts the chosen dilators in kit order whatever order they were picked in', () => {
		const out = inferCustomSteps(base, ['d4', 'd2', 'd1'], kit, 60);
		expect(idsOf(out.steps)).toEqual(['d1', 'd2', 'd4']);
	});

	it('drops the ones that were unticked and gives their time to the others', () => {
		const out = inferCustomSteps(base, ['d3', 'd4'], kit, 60);
		expect(out.steps).toEqual(steps([3, 5], [4, 55]));
	});

	it("a dilator today's routine does not use starts at 5 minutes", () => {
		const out = inferCustomSteps(base, ['d1', 'd2', 'd3', 'd4', 'd5'], kit, 60);
		expect(out.steps.find((s) => s.dilatorId === 'd5')?.minutes).toBe(5);
		expect(totalMinutes(out.steps)).toBe(60);
		expect(idsOf(out.steps).at(-1)).toBe('d5');
	});

	it('ignores doubles and picks nothing when nothing is picked', () => {
		expect(idsOf(inferCustomSteps(base, ['d4', 'd4'], kit, 30).steps)).toEqual(['d4']);
		expect(inferCustomSteps(base, [], kit, 30).steps).toEqual([]);
	});

	it('copes with a dilator the kit no longer knows', () => {
		const out = inferCustomSteps(base, ['d4', 'gone'], kit, 30);
		expect(idsOf(out.steps)).toEqual(['d4', 'gone']);
		expect(totalMinutes(out.steps)).toBe(30);
	});

	it('sums a dilator the routine uses twice', () => {
		const out = inferCustomSteps(steps([1, 10], [2, 10], [1, 10]), ['d1', 'd2'], kit, 30);
		expect(totalMinutes(out.steps)).toBe(30);
		expect(minutesOf(out.steps)).toEqual([20, 10]);
	});
});

describe('baseSteps: which routine to start from', () => {
	it("is today's routine", () => {
		expect(baseSteps(WIH_PHASES, 20)).toEqual(WIH_PHASES.find((p) => p.id === 'wih-week-2')!.steps);
	});

	it('on a rest day it is the next routine with dilators', () => {
		expect(baseSteps(WIH_PHASES, 3)).toEqual(
			WIH_PHASES.find((p) => p.id === 'wih-week-1-day-1')!.steps
		);
	});

	it('after the plan ends, or with nothing planned, it copes', () => {
		expect(baseSteps(WIH_PHASES.slice(0, 3), 500).length).toBeGreaterThan(0);
		expect(baseSteps([], 5)).toEqual([]);
	});
});

describe('small helpers', () => {
	it('rounds to 5 minutes, at least 5', () => {
		expect(roundToBlock(12)).toBe(10);
		expect(roundToBlock(13)).toBe(15);
		expect(roundToBlock(0)).toBe(5);
	});

	it('shows durations', () => {
		expect(formatDuration(45)).toBe('45 min');
		expect(formatDuration(60)).toBe('1 h');
		expect(formatDuration(75)).toBe('1 h 15 min');
		expect(formatDuration(120)).toBe('2 h');
	});

	it("starts the slider at the routine's length, kept in range", () => {
		expect(defaultTotal(steps([1, 5], [4, 60]))).toBe(65);
		expect(defaultTotal(steps([1, 500]))).toBe(180);
		expect(defaultTotal([])).toBe(10);
		expect(defaultTotal(steps([1, 2]))).toBe(10);
	});
});
