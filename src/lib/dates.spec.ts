import { describe, expect, it } from 'vitest';
import { addDays, dayNumber } from './dates';

describe('dates', () => {
	it('adds days across month, year and DST boundaries', () => {
		expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
		expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('round-trips with dayNumber', () => {
		for (const n of [0, 6, 7, 71, 364, 400]) {
			expect(dayNumber('2026-01-01', addDays('2026-01-01', n))).toBe(n + 1);
		}
	});
});
