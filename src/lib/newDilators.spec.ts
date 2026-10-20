import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { WIH_PHASES, WIH_SIZE5_PHASES, defaultSettings } from './defaults';
import { INTRO_FOR_DAYS, introKey, newDilatorIds, pendingIntro, timesPerDay } from './newDilators';
import { wihDilators } from './dilators';
import type { Settings } from './types';

const START = '2026-01-01';

function settings(phases = WIH_PHASES): Settings {
	return {
		...defaultSettings(),
		startDate: START,
		setup: 'done',
		dilators: wihDilators(),
		phases: structuredClone(phases)
	};
}

/** The calendar date of schedule day `n`. */
const onDay = (n: number) => addDays(START, n - 1);
const byId = (id: string) => WIH_SIZE5_PHASES.find((p) => p.id === id)!;

describe('newDilatorIds', () => {
	it('finds the dilator a phase brings in for the first time', () => {
		expect(
			newDilatorIds(
				WIH_PHASES,
				WIH_PHASES.find((p) => p.id === 'wih-week-2')!
			)
		).toEqual(['d1']);
		expect(
			newDilatorIds(
				WIH_PHASES,
				WIH_PHASES.find((p) => p.id === 'wih-week-3')!
			)
		).toEqual(['d2']);
	});

	it('counts the first dilation phase, where the first dilator appears', () => {
		expect(
			newDilatorIds(
				WIH_PHASES,
				WIH_PHASES.find((p) => p.id === 'wih-week-1-day-1')!
			)
		).toEqual(['d0']);
	});

	it('says nothing for a phase that only changes the routine', () => {
		for (const id of ['wih-week-1-day-2', 'wih-week-1-day-4-7', 'wih-week-4', 'wih-week-6']) {
			expect(
				newDilatorIds(
					WIH_PHASES,
					WIH_PHASES.find((p) => p.id === id)!
				),
				id
			).toEqual([]);
		}
	});

	it('says nothing for a rest week', () => {
		expect(
			newDilatorIds(
				WIH_PHASES,
				WIH_PHASES.find((p) => p.id === 'wih-week-0')!
			)
		).toEqual([]);
	});

	it('finds dilator 5 in the program that uses it, and in no other phase of that program', () => {
		expect(newDilatorIds(WIH_SIZE5_PHASES, byId('wih-week-25-52'))).toEqual(['d5']);
		const others = WIH_SIZE5_PHASES.filter((p) => p.id !== 'wih-week-25-52');
		expect(others.flatMap((p) => newDilatorIds(WIH_SIZE5_PHASES, p))).not.toContain('d5');
	});

	it('introduces every dilator exactly once across the whole schedule', () => {
		const all = WIH_PHASES.flatMap((p) => newDilatorIds(WIH_PHASES, p));
		expect(all).toEqual(['d0', 'd1', 'd2', 'd3', 'd4']);
	});

	it('does not count a dilator that only returned after a pause as new', () => {
		const phases = structuredClone(WIH_PHASES);
		const rest = { id: 'pause', label: 'Pause', fromDay: 9999, toDay: 9999, slots: [], steps: [] };
		const week3 = structuredClone(phases.find((p) => p.id === 'wih-week-3')!);
		const back = { ...week3, id: 'again', fromDay: 10_000, toDay: null };
		expect(newDilatorIds([...phases, rest, back], back)).toEqual([]);
	});

	it('only looks at phases that come earlier in the schedule, however they are ordered in the list', () => {
		const reversed = structuredClone(WIH_PHASES).reverse();
		const all = reversed.flatMap((p) => newDilatorIds(reversed, p));
		expect(all.sort()).toEqual(['d0', 'd1', 'd2', 'd3', 'd4']);
	});
});

describe('pendingIntro', () => {
	it('shows the new dilator on the day its phase starts, with what the screen needs', () => {
		const intro = pendingIntro(settings(), onDay(15))!;
		expect(intro.phase.id).toBe('wih-week-2');
		expect(intro.sessionsPerDay).toBe(2);
		expect(intro.dilators).toHaveLength(1);
		expect(intro.dilators[0].dilator).toMatchObject({ id: 'd1', diameterMm: 23 });
		expect(intro.dilators[0].minutes).toBe(50);
	});

	it('is quiet on a phase change that brings in no new dilator', () => {
		expect(pendingIntro(settings(), onDay(10))).toBeNull(); // week 1 day 3
		expect(pendingIntro(settings(), onDay(29))).toBeNull(); // week 4
		expect(pendingIntro(settings(), onDay(43))).toBeNull(); // week 6
	});

	it('is quiet on rest days, before the surgery and with no phase', () => {
		expect(pendingIntro(settings(), onDay(3))).toBeNull();
		expect(pendingIntro(settings(), onDay(-4))).toBeNull();
		expect(pendingIntro({ ...settings(), phases: [] }, onDay(15))).toBeNull();
	});

	it('keeps offering it for a few days if it was not answered, then stops', () => {
		expect(pendingIntro(settings(), onDay(15 + INTRO_FOR_DAYS))).not.toBeNull();
		expect(pendingIntro(settings(), onDay(15 + INTRO_FOR_DAYS + 1))).toBeNull();
	});

	it('is gone once answered, and an answer for another dilator or another surgery date does not count', () => {
		const answered = [introKey(START, 'd1')];
		expect(pendingIntro(settings(), onDay(15), answered)).toBeNull();
		expect(pendingIntro(settings(), onDay(15), [introKey(START, 'd2')])).not.toBeNull();
		expect(pendingIntro(settings(), onDay(15), [introKey('2025-06-01', 'd1')])).not.toBeNull();
	});

	it('does not ask again later in the same phase after it was answered', () => {
		const answered = [introKey(START, 'd1')];
		for (let n = 15; n <= 21; n++) expect(pendingIntro(settings(), onDay(n), answered)).toBeNull();
	});

	it('shows several new dilators together', () => {
		const s = settings();
		s.phases = [
			{ id: 'a', label: 'Start', fromDay: 1, toDay: 4, slots: ['daily'], steps: s.phases[1].steps },
			{
				id: 'b',
				label: 'Bigger',
				fromDay: 5,
				toDay: null,
				slots: ['morning', 'evening'],
				steps: [
					{ dilatorId: 'd0', minutes: 10 },
					{ dilatorId: 'd2', minutes: 20 },
					{ dilatorId: 'd3', minutes: 30 }
				]
			}
		];
		const intro = pendingIntro(s, onDay(5))!;
		expect(intro.dilators.map((d) => d.dilator.id)).toEqual(['d2', 'd3']);
	});

	it('skips a dilator that no longer exists in the kit', () => {
		const s = settings();
		s.dilators = s.dilators.filter((d) => d.id !== 'd1');
		expect(pendingIntro(s, onDay(15))).toBeNull();
	});

	it('shows dilator 5 in the program that has it', () => {
		const s = settings(WIH_SIZE5_PHASES);
		const start = byId('wih-week-25-52').fromDay;
		expect(pendingIntro(s, onDay(start))?.dilators[0].dilator.id).toBe('d5');
		expect(pendingIntro(settings(WIH_PHASES), onDay(start))).toBeNull();
	});
});

describe('timesPerDay', () => {
	it('reads naturally', () => {
		expect(timesPerDay(1)).toBe('once a day');
		expect(timesPerDay(2)).toBe('twice a day');
		expect(timesPerDay(3)).toBe('3 times a day');
	});
});
