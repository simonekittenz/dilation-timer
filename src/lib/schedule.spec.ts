import { describe, expect, it } from 'vitest';
import { dayNumber } from './dates';
import { defaultSettings } from './defaults';
import { nextOpenSlot, phaseForDate, slotsForDate } from './schedule';
import type { LogEntry } from './types';

const settings = defaultSettings(new Date(2026, 0, 1));

describe('schedule', () => {
	it('numbers days from the start date', () => {
		expect(dayNumber('2026-01-01', '2026-01-01')).toBe(1);
		expect(dayNumber('2026-01-01', '2026-03-30')).toBe(89);
	});

	it('picks the phase for a date', () => {
		expect(phaseForDate(settings, '2026-01-14')?.id).toBe('phase-1');
		expect(phaseForDate(settings, '2026-01-15')?.id).toBe('phase-2');
		expect(phaseForDate(settings, '2025-12-31')).toBeUndefined();
	});

	it('marks slots done, overdue and upcoming', () => {
		const log: LogEntry[] = [
			{ id: 'a', date: '2026-01-02', slot: '08:00', startedAt: 0, finishedAt: 1, steps: [] }
		];
		const slots = slotsForDate(settings, '2026-01-02', '13:00', log);
		expect(slots.map((s) => s.status)).toEqual(['done', 'overdue', 'upcoming', 'upcoming']);
		expect(nextOpenSlot(slots)?.time).toBe('12:00');
	});
});
