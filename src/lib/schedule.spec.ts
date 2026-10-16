import { describe, expect, it } from 'vitest';
import { dayNumber } from './dates';
import { WIH_PHASES, defaultSettings } from './defaults';
import { nextOpenSlot, phaseForDate, slotsForDate } from './schedule';
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
		expect(phaseForDate(settings, '2026-01-01')?.id).toBe('wih-week-1-day-1');
		expect(phaseForDate(settings, '2026-01-07')?.id).toBe('wih-week-1-day-4-7');
		expect(phaseForDate(settings, '2026-01-08')?.id).toBe('wih-week-2');
		expect(phaseForDate(settings, '2026-03-11')?.id).toBe('wih-week-10');
		expect(phaseForDate(settings, '2026-03-12')?.id).toBe('wih-week-11-52');
		expect(phaseForDate(settings, '2025-12-31')).toBeUndefined();
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

	it('marks slots done, overdue and upcoming', () => {
		const log: LogEntry[] = [
			{ id: 'a', date: '2026-01-09', slot: '08:00', startedAt: 0, finishedAt: 1, steps: [] }
		];
		const slots = slotsForDate(settings, '2026-01-09', '13:00', log);
		expect(slots.map((s) => s.status)).toEqual(['done', 'upcoming']);
		const late = slotsForDate(settings, '2026-01-09', '21:00', []);
		expect(late.map((s) => s.status)).toEqual(['overdue', 'overdue']);
		expect(nextOpenSlot(slots)?.time).toBe('20:00');
	});
});
