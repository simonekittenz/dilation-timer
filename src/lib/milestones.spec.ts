import { describe, expect, it } from 'vitest';
import { addMonths } from './dates';
import {
	SHOW_FOR_DAYS,
	currentMilestone,
	milestoneLine,
	milestoneTitle,
	milestoneWhen
} from './milestones';

describe('addMonths', () => {
	it('keeps the day of the month', () => {
		expect(addMonths('2026-10-18', 1)).toBe('2026-11-18');
		expect(addMonths('2026-10-18', 3)).toBe('2027-01-18');
		expect(addMonths('2026-10-18', 12)).toBe('2027-10-18');
		expect(addMonths('2026-01-05', 0)).toBe('2026-01-05');
	});

	it('uses the last day when the month is shorter', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonths('2026-01-31', 3)).toBe('2026-04-30');
		expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
		expect(addMonths('2027-12-31', 2)).toBe('2028-02-29'); // a leap year
	});

	it('handles 29 February and year changes', () => {
		expect(addMonths('2028-02-29', 12)).toBe('2029-02-28');
		expect(addMonths('2028-02-29', 48)).toBe('2032-02-29');
		expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
		expect(addMonths('2026-11-30', 14)).toBe('2028-01-30');
	});
});

describe('currentMilestone', () => {
	const surgery = '2026-03-10';

	it('is nothing on an ordinary day', () => {
		expect(currentMilestone(surgery, '2026-03-11')).toBeNull();
		expect(currentMilestone(surgery, '2026-03-20')).toBeNull();
		expect(currentMilestone(surgery, '2026-07-02')).toBeNull();
	});

	it('is nothing on the surgery day itself, or before it', () => {
		expect(currentMilestone(surgery, '2026-03-10')).toBeNull();
		expect(currentMilestone(surgery, '2026-03-01')).toBeNull();
		expect(currentMilestone('', '2026-03-01')).toBeNull();
		expect(currentMilestone('not a date', '2026-03-01')).toBeNull();
	});

	it('celebrates each month on the same date, for the first year', () => {
		const first = currentMilestone(surgery, '2026-04-10')!;
		expect(first).toMatchObject({ kind: 'month', count: 1, date: '2026-04-10', daysAgo: 0 });
		for (let n = 1; n <= 11; n++) {
			const m = currentMilestone(surgery, addMonths(surgery, n))!;
			expect(m.kind).toBe('month');
			expect(m.count).toBe(n);
		}
	});

	it('the 12th month is the first anniversary, then one every year', () => {
		expect(currentMilestone(surgery, '2027-03-10')).toMatchObject({ kind: 'year', count: 1 });
		expect(currentMilestone(surgery, '2028-03-10')).toMatchObject({ kind: 'year', count: 2 });
		expect(currentMilestone(surgery, '2036-03-10')).toMatchObject({ kind: 'year', count: 10 });
	});

	it('after the first year there are no monthly ones', () => {
		expect(currentMilestone(surgery, '2027-04-10')).toBeNull();
		expect(currentMilestone(surgery, '2027-09-10')).toBeNull();
	});

	it('is still shown for a few days if the app was not opened on the day', () => {
		expect(currentMilestone(surgery, '2026-04-11')).toMatchObject({ count: 1, daysAgo: 1 });
		expect(currentMilestone(surgery, `2026-04-${10 + SHOW_FOR_DAYS}`)).toMatchObject({
			daysAgo: SHOW_FOR_DAYS
		});
		expect(currentMilestone(surgery, `2026-04-${11 + SHOW_FOR_DAYS}`)).toBeNull();
	});

	it('does not look back over a long gap, only at the most recent milestone', () => {
		expect(currentMilestone(surgery, '2026-09-30')).toBeNull();
	});

	it('is gone once dismissed, and only that one', () => {
		const m = currentMilestone(surgery, '2026-04-10')!;
		expect(currentMilestone(surgery, '2026-04-10', [m.id])).toBeNull();
		expect(currentMilestone(surgery, '2026-04-12', [m.id])).toBeNull();
		const next = currentMilestone(surgery, '2026-05-10', [m.id]);
		expect(next).toMatchObject({ count: 2 });
	});

	it('dismissing belongs to the surgery date: changing the date does not hide new ones', () => {
		const old = currentMilestone('2026-03-10', '2026-04-10')!;
		const moved = currentMilestone('2026-03-12', '2026-04-12', [old.id])!;
		expect(moved.id).not.toBe(old.id);
		expect(moved).toBeTruthy();
	});

	it('works for a surgery on the 31st and on 29 February', () => {
		expect(currentMilestone('2026-01-31', '2026-02-28')).toMatchObject({
			count: 1,
			date: '2026-02-28'
		});
		expect(currentMilestone('2026-01-31', '2026-03-31')).toMatchObject({ count: 2 });
		expect(currentMilestone('2028-02-29', '2029-02-28')).toMatchObject({ kind: 'year', count: 1 });
	});

	it('every id is unique', () => {
		const ids = new Set<string>();
		for (let n = 1; n <= 48; n++) {
			const m = currentMilestone(surgery, addMonths(surgery, n));
			if (m) ids.add(m.id);
		}
		expect(ids.size).toBe(11 + 4);
	});
});

describe('the words', () => {
	it('names the milestone in plain words', () => {
		expect(milestoneTitle({ kind: 'month', count: 1 })).toBe('One month since your surgery');
		expect(milestoneTitle({ kind: 'month', count: 3 })).toBe('Three months since your surgery');
		expect(milestoneTitle({ kind: 'month', count: 11 })).toBe('Eleven months since your surgery');
		expect(milestoneTitle({ kind: 'year', count: 1 })).toBe('One year since your surgery');
		expect(milestoneTitle({ kind: 'year', count: 2 })).toBe('Two years since your surgery');
		expect(milestoneTitle({ kind: 'year', count: 15 })).toBe('15 years since your surgery');
	});

	it('says when', () => {
		expect(milestoneWhen(0)).toBe('Today');
		expect(milestoneWhen(1)).toBe('Yesterday');
		expect(milestoneWhen(3)).toBe('3 days ago');
	});

	it('gives the same kind line every time for the same milestone', () => {
		const m = { id: '2026-03-10:month-4', kind: 'month' as const };
		expect(milestoneLine(m)).toBe(milestoneLine(m));
		expect(milestoneLine(m).length).toBeGreaterThan(10);
		expect(milestoneLine({ id: 'x:year-1', kind: 'year' })).toMatch(/year|journey|celebrate|far/i);
	});
});
