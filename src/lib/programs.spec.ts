import { describe, expect, it } from 'vitest';
import { PROGRAMS, WIH_PHASES, WIH_SIZE5_PHASES, defaultSettings, wihPhases } from './defaults';
import { WIH_DILATORS } from './dilators';
import { summarizeWeek } from './setup';
import { phaseForDay } from './schedule';
import type { Phase } from './types';

const minutes = (p: Phase) => p.steps.reduce((sum, s) => sum + s.minutes, 0);
const byId = (phases: Phase[], id: string) => phases.find((p) => p.id === id)!;
const sizes = (p: Phase) => p.steps.map((s) => s.dilatorId.replace('d', '')).join(',');
const WEEK_24_END = 7 + 7 * 24;

describe('the two WIH programs', () => {
	it('offers exactly the standard program and the one with size 5', () => {
		expect(PROGRAMS.map((p) => p.id)).toEqual(['standard', 'size5']);
		expect(PROGRAMS.map((p) => p.label)).toEqual(['WIH standard', 'WIH with size 5']);
	});

	it('are identical from the surgery until the end of week 24', () => {
		const early = (phases: Phase[]) => phases.filter((p) => (p.toDay ?? Infinity) <= WEEK_24_END);
		const standard = early(WIH_PHASES);
		const size5 = early(WIH_SIZE5_PHASES);
		// everything up to week 10 is the very same phase; weeks 11-24 are one phase in the size 5 one
		const upTo10 = (phases: Phase[]) => phases.filter((p) => p.toDay! <= 7 + 70);
		expect(upTo10(size5)).toEqual(upTo10(standard));
		const week11 = byId(WIH_SIZE5_PHASES, 'wih-week-11-24');
		expect(week11.fromDay).toBe(byId(WIH_PHASES, 'wih-week-11-52').fromDay);
		expect(week11.toDay).toBe(WEEK_24_END);
		expect(week11.steps).toEqual(byId(WIH_PHASES, 'wih-week-11-52').steps);
		expect(week11.slots).toEqual(byId(WIH_PHASES, 'wih-week-11-52').slots);
		expect(standard.length).toBeGreaterThan(10);
		expect(size5.length).toBe(standard.length + 1);
	});

	it('from week 25 dilator 5 joins: 5 / 5 / 5 / 50 / 10 minutes, twice a day', () => {
		const p = byId(WIH_SIZE5_PHASES, 'wih-week-25-52');
		expect(p.fromDay).toBe(WEEK_24_END + 1);
		expect(p.toDay).toBe(7 + 364);
		expect(sizes(p)).toBe('1,2,3,4,5');
		expect(p.steps.map((s) => s.minutes)).toEqual([5, 5, 5, 50, 10]);
		expect(p.slots).toEqual(['morning', 'evening']);
		expect(minutes(p)).toBe(75);
	});

	it('year 2 is 3 / 4 / 5 for 5 / 5 / 50 minutes and year 3 is 4 / 5 for 5 / 55, once a day', () => {
		const y2 = byId(WIH_SIZE5_PHASES, 'wih-year-2');
		expect(sizes(y2)).toBe('3,4,5');
		expect(y2.steps.map((s) => s.minutes)).toEqual([5, 5, 50]);
		expect(y2.slots).toEqual(['morning', 'evening']);
		const y3 = byId(WIH_SIZE5_PHASES, 'wih-year-3-plus');
		expect(sizes(y3)).toBe('4,5');
		expect(y3.steps.map((s) => s.minutes)).toEqual([5, 55]);
		expect(y3.slots).toEqual(['daily']);
		expect(y3.toDay).toBeNull();
	});

	it('the standard program never changed and never uses dilator 5', () => {
		expect(WIH_PHASES.some((p) => p.steps.some((s) => s.dilatorId === 'd5'))).toBe(false);
		expect(sizes(byId(WIH_PHASES, 'wih-year-2'))).toBe('3,4');
		expect(byId(WIH_PHASES, 'wih-year-2').steps.map((s) => s.minutes)).toEqual([5, 55]);
		expect(byId(WIH_PHASES, 'wih-week-11-52').toDay).toBe(7 + 364);
	});

	it('dilator 5 only appears from week 25', () => {
		for (const p of WIH_SIZE5_PHASES) {
			const uses5 = p.steps.some((s) => s.dilatorId === 'd5');
			expect(uses5).toBe(p.fromDay > WEEK_24_END);
		}
	});

	it('every session after week 7 adds up to the same totals as the standard one', () => {
		expect(minutes(byId(WIH_SIZE5_PHASES, 'wih-year-2'))).toBe(60);
		expect(minutes(byId(WIH_SIZE5_PHASES, 'wih-year-3-plus'))).toBe(60);
		expect(minutes(byId(WIH_PHASES, 'wih-year-2'))).toBe(60);
		expect(minutes(byId(WIH_SIZE5_PHASES, 'wih-week-11-24'))).toBe(75);
	});

	it.each([
		['standard', WIH_PHASES],
		['size5', WIH_SIZE5_PHASES]
	])('%s: days follow on without gaps or overlaps, and the last phase never ends', (_n, phases) => {
		expect(phases[0].fromDay).toBe(1);
		phases.slice(1).forEach((p, i) => expect(p.fromDay).toBe((phases[i].toDay ?? 0) + 1));
		expect(phases.at(-1)?.toDay).toBeNull();
		expect(new Set(phases.map((p) => p.id)).size).toBe(phases.length);
	});

	it.each([
		['standard', WIH_PHASES],
		['size5', WIH_SIZE5_PHASES]
	])('%s: every dilator used exists in the kit, and every day has a phase', (_n, phases) => {
		const kit = new Set(WIH_DILATORS.map((d) => d.id));
		for (const p of phases) for (const s of p.steps) expect(kit.has(s.dilatorId)).toBe(true);
		for (const day of [1, 7, 8, 14, 175, 176, 371, 372, 737, 738, 5000])
			expect(phaseForDay(phases, day)).toBeTruthy();
	});

	it('wihPhases hands out fresh copies, standard by default', () => {
		expect(wihPhases()).toEqual(WIH_PHASES);
		expect(wihPhases('size5')).toEqual(WIH_SIZE5_PHASES);
		const a = wihPhases('size5');
		a[0].label = 'changed';
		expect(wihPhases('size5')[0].label).not.toBe('changed');
	});

	it('a new install starts from the standard schedule until a program is chosen', () => {
		const s = defaultSettings();
		expect(s.setup).toBe('ask-program');
		expect(s.phases).toEqual(WIH_PHASES);
	});

	it('"does this look right?" follows the chosen program', () => {
		const settings = { ...defaultSettings(), phases: wihPhases('size5'), startDate: '2026-01-01' };
		// day 200 is in the size 5 only phase
		const week = summarizeWeek(settings, '2026-07-19');
		expect(week.day).toBe(200);
		expect(week.phase?.id).toBe('wih-week-25-52');
		expect(week.sessionsPerDay).toBe(2);
		expect(week.minutesPerSession).toBe(75);
	});
});
