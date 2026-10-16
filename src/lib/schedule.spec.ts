import { describe, expect, it } from 'vitest';
import { dayNumber } from './dates';
import { WIH_PHASES, defaultSettings } from './defaults';
import { resolveSteps } from './dilators';
import {
	daysUntilDilation,
	isRestPhase,
	nextOpenSlot,
	phaseForDate,
	phaseProgress,
	slotsForDate
} from './schedule';
import type { LogEntry } from './types';

const settings = defaultSettings(new Date(2026, 0, 1));
const total = (id: string) =>
	WIH_PHASES.find((p) => p.id === id)!.steps.reduce((sum, s) => sum + s.minutes, 0);

describe('schedule', () => {
	it('numbers days from the start date', () => {
		expect(dayNumber('2026-01-01', '2026-01-01')).toBe(1);
		expect(dayNumber('2026-01-01', '2026-03-30')).toBe(89);
	});

	it('picks the phase for a date', () => {
		expect(phaseForDate(settings, '2026-01-01')?.id).toBe('wih-week-0');
		expect(phaseForDate(settings, '2026-01-07')?.id).toBe('wih-week-0');
		expect(phaseForDate(settings, '2026-01-08')?.id).toBe('wih-week-1-day-1');
		expect(phaseForDate(settings, '2026-01-14')?.id).toBe('wih-week-1-day-4-7');
		expect(phaseForDate(settings, '2026-01-15')?.id).toBe('wih-week-2');
		expect(phaseForDate(settings, '2026-03-18')?.id).toBe('wih-week-10');
		expect(phaseForDate(settings, '2026-03-19')?.id).toBe('wih-week-11-52');
		expect(phaseForDate(settings, '2025-12-31')).toBeUndefined();
	});

	it('starts with a rest week where nothing is scheduled', () => {
		const rest = WIH_PHASES[0];
		expect(rest.fromDay).toBe(1);
		expect(rest.toDay).toBe(7);
		expect(isRestPhase(rest)).toBe(true);
		expect(slotsForDate(settings, '2026-01-03', '10:00', [])).toEqual([]);
		expect(WIH_PHASES.filter(isRestPhase).map((p) => p.id)).toEqual(['wih-week-0']);
	});

	it('labels phases as past, current or upcoming', () => {
		const progress = (day: number) =>
			Object.fromEntries(
				settings.phases.map((p) => [p.id, phaseProgress(settings.phases, p, day)])
			);
		const onDay10 = progress(10);
		expect(onDay10['wih-week-0']).toBe('past');
		expect(onDay10['wih-week-1-day-1']).toBe('past');
		expect(onDay10['wih-week-1-day-3']).toBe('current');
		expect(onDay10['wih-week-2']).toBe('upcoming');
		expect(Object.values(onDay10).filter((v) => v === 'current')).toHaveLength(1);
		// before day 1 nothing has happened yet
		expect(Object.values(progress(0)).every((v) => v === 'upcoming')).toBe(true);
	});

	it('counts the days until dilation starts', () => {
		expect(daysUntilDilation(settings.phases, 1)).toBe(7);
		expect(daysUntilDilation(settings.phases, 7)).toBe(1);
		expect(daysUntilDilation(settings.phases, 8)).toBe(1);
		expect(daysUntilDilation(settings.phases, 800)).toBeNull();
	});

	it('transcribes the WIH program without gaps or overlaps', () => {
		WIH_PHASES.slice(1).forEach((p, i) => {
			expect(p.fromDay).toBe((WIH_PHASES[i].toDay ?? 0) + 1);
		});
		expect(WIH_PHASES.at(-1)?.toDay).toBeNull();
	});

	it('keeps the per-session totals from the printed chart', () => {
		expect(total('wih-week-1-day-1')).toBe(30);
		expect(total('wih-week-1-day-4-7')).toBe(120);
		for (let n = 2; n <= 10; n++) expect(total(`wih-week-${n}`)).toBe(75);
		expect(total('wih-week-11-52')).toBe(75);
		expect(total('wih-year-2')).toBe(60);
		expect(total('wih-year-3-plus')).toBe(60);
	});

	it('ships Dilator 5 in the kit but not in the standard schedule', () => {
		expect(settings.dilators.map((d) => d.id)).toContain('d5');
		const used = new Set(WIH_PHASES.flatMap((p) => p.steps.map((st) => st.dilatorId)));
		expect(used.has('d5')).toBe(false);
		expect([...used].sort()).toEqual(['d0', 'd1', 'd2', 'd3', 'd4']);
	});

	it('resolves phase steps against the dilator list', () => {
		const phase = WIH_PHASES.find((p) => p.id === 'wih-week-4')!;
		const steps = resolveSteps(settings.dilators, phase.steps);
		expect(steps.map((x) => x.label)).toEqual(['Dilator 0', 'Dilator 1', 'Dilator 2']);
		expect(steps[2]).toMatchObject({ color: '#f2c94c', diameterMm: 26, minutes: 50 });
	});

	it('only calls the morning overdue once the morning is over', () => {
		const at = (t: string) => slotsForDate(settings, '2026-01-15', t, []).map((x) => x.status);
		expect(at('09:00')).toEqual(['due', 'upcoming']);
		expect(at('13:00')).toEqual(['overdue', 'upcoming']);
		expect(at('18:00')).toEqual(['overdue', 'due']);
		expect(at('23:59')).toEqual(['overdue', 'due']);
	});

	it('never marks the evening or a daily session overdue', () => {
		const daily = slotsForDate(settings, '2026-01-09', '23:00', []);
		expect(daily.map((x) => x.status)).toEqual(['due']);
	});

	it('tracks done and skipped slots', () => {
		const entry = (slot: 'morning' | 'evening', skipped = false): LogEntry => ({
			id: slot,
			date: '2026-01-15',
			slot,
			startedAt: 0,
			finishedAt: 1,
			skipped,
			steps: []
		});
		const slots = slotsForDate(settings, '2026-01-15', '13:00', [entry('morning', true)]);
		expect(slots.map((s) => s.status)).toEqual(['skipped', 'upcoming']);
		const both = slotsForDate(settings, '2026-01-15', '21:00', [
			entry('morning'),
			entry('evening')
		]);
		expect(both.map((s) => s.status)).toEqual(['done', 'done']);
		expect(nextOpenSlot(slots)?.slot).toBe('evening');
		expect(nextOpenSlot(both)).toBeUndefined();
	});
});
