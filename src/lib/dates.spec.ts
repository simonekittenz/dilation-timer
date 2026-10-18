import { describe, expect, it } from 'vitest';
import { addDays, dayNumber, formatDateRange, formatScheduleDate } from './dates';

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

describe('schedule date ranges', () => {
	const hasYear = (text: string, year: number) => text.includes(String(year));

	it('leaves the year out when it is obvious (inside the surgery year)', () => {
		const r = formatDateRange('2026-10-24', '2026-10-30', 2026);
		expect(r).not.toMatch(/\d{4}/);
		expect(formatScheduleDate('2026-10-24', 2026)).not.toMatch(/\d{4}/);
		expect(formatDateRange('2026-10-24', null, 2026)).not.toMatch(/\d{4}/);
		expect(formatDateRange('2026-10-24', null, 2026)).toContain('→');
	});

	it('shows the year on both ends when a range runs into another year, so it cannot read backwards', () => {
		const r = formatDateRange('2026-12-28', '2027-01-03', 2026);
		expect(hasYear(r, 2026) && hasYear(r, 2027)).toBe(true);
	});

	it('a whole year long, like "Year 2", is no longer "Oct 24 – Oct 23"', () => {
		const r = formatDateRange('2027-10-24', '2028-10-23', 2026);
		expect(hasYear(r, 2027) && hasYear(r, 2028)).toBe(true);
	});

	it('a range wholly in a later year than the surgery shows that year', () => {
		const r = formatDateRange('2027-03-01', '2027-03-07', 2026);
		expect(r.match(/2027/g)).toHaveLength(2);
	});

	it('single days and open-ended phases in a later year show their year too', () => {
		expect(hasYear(formatDateRange('2027-03-01', '2027-03-01', 2026), 2027)).toBe(true);
		expect(hasYear(formatDateRange('2028-10-24', null, 2026), 2028)).toBe(true);
	});
});
