import { addMonths, dayNumber } from './dates';

export type MilestoneKind = 'month' | 'year';

export interface Milestone {
	/** Unique to the surgery date, so changing the date can't mix up what was already dismissed. */
	id: string;
	kind: MilestoneKind;
	/** Months (1 to 11) or years (1, 2, ...). */
	count: number;
	/** The calendar day it falls on. */
	date: string;
	/** 0 on the day itself. */
	daysAgo: number;
}

/** How many days after a milestone it is still shown, for someone who didn't open the app that day. */
export const SHOW_FOR_DAYS = 3;

/**
 * Every month for the first year (the 12th is the first anniversary), then every year.
 * Month `n` after surgery is the same date as the surgery.
 */
function milestoneFor(startDate: string, monthsAfter: number): Milestone | null {
	if (monthsAfter < 1) return null;
	const date = addMonths(startDate, monthsAfter);
	if (monthsAfter < 12) {
		return {
			id: `${startDate}:month-${monthsAfter}`,
			kind: 'month',
			count: monthsAfter,
			date,
			daysAgo: 0
		};
	}
	if (monthsAfter % 12 === 0) {
		const count = monthsAfter / 12;
		return { id: `${startDate}:year-${count}`, kind: 'year', count, date, daysAgo: 0 };
	}
	return null;
}

/**
 * The milestone to celebrate today: the latest one that has arrived, if it was at most
 * `SHOW_FOR_DAYS` days ago and hasn't been dismissed. Otherwise null.
 */
export function currentMilestone(
	startDate: string,
	today: string,
	dismissed: readonly string[] = []
): Milestone | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || dayNumber(startDate, today) < 2) return null;
	const [sy, sm] = startDate.split('-').map(Number);
	const [ty, tm] = today.split('-').map(Number);
	const monthsSoFar = (ty - sy) * 12 + (tm - sm);
	for (let n = monthsSoFar + 1; n >= 1; n--) {
		const m = milestoneFor(startDate, n);
		if (!m || m.date > today) continue;
		const daysAgo = dayNumber(m.date, today) - 1;
		if (daysAgo > SHOW_FOR_DAYS) return null; // older ones are not shown, however many there were
		return dismissed.includes(m.id) ? null : { ...m, daysAgo };
	}
	return null;
}

const WORDS = [
	'',
	'One',
	'Two',
	'Three',
	'Four',
	'Five',
	'Six',
	'Seven',
	'Eight',
	'Nine',
	'Ten',
	'Eleven'
];

/** "Three months since your surgery". */
export function milestoneTitle(m: Pick<Milestone, 'kind' | 'count'>): string {
	if (m.kind === 'month') {
		return `${WORDS[m.count] ?? m.count} month${m.count === 1 ? '' : 's'} since your surgery`;
	}
	const years = m.count <= 11 ? WORDS[m.count] : String(m.count);
	return `${years} year${m.count === 1 ? '' : 's'} since your surgery`;
}

/** "Today", "Yesterday", "2 days ago". */
export function milestoneWhen(daysAgo: number): string {
	if (daysAgo <= 0) return 'Today';
	if (daysAgo === 1) return 'Yesterday';
	return `${daysAgo} days ago`;
}

const MONTH_LINES = [
	"Look how far you've come.",
	"I'm so proud of you!",
	'Take a moment to yourself today.',
	'All the good and bad moments have brought you here.'
];
const YEAR_LINES = [
	"A whole year! I'm so proud of you!",
	'What a journey it has been!',
	"Look back at how far you've come, and be proud.",
	'Take a moment today to celebrate yourself.'
];

/** A short kind line; the same milestone always gets the same one. */
export function milestoneLine(m: Pick<Milestone, 'id' | 'kind'>): string {
	const pool = m.kind === 'year' ? YEAR_LINES : MONTH_LINES;
	let h = 0;
	for (const ch of m.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return pool[h % pool.length];
}
