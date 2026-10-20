const pad = (n: number) => String(n).padStart(2, '0');

export function toDateString(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeString(d: Date): string {
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Whole days from `startDate` to `date` (both YYYY-MM-DD), +1 so the start date is day 1. */
export function dayNumber(startDate: string, date: string): number {
	const parse = (s: string) => {
		const [y, m, d] = s.split('-').map(Number);
		return Date.UTC(y, m - 1, d);
	};
	return Math.round((parse(date) - parse(startDate)) / 86_400_000) + 1;
}

export function formatClock(ms: number): string {
	const total = Math.max(0, Math.ceil(ms / 1000));
	return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Calendar date `n` days after `date` (YYYY-MM-DD). Works in UTC so DST can't skew it. */
export function addDays(date: string, n: number): string {
	const [y, m, d] = date.split('-').map(Number);
	const t = new Date(Date.UTC(y, m - 1, d + n));
	return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/**
 * The same day of the month, `n` months after `date`. A day that the month doesn't have (the 31st in
 * a 30-day month, 29 February in a normal year) becomes the month's last day.
 */
export function addMonths(date: string, n: number): string {
	const [y, m, d] = date.split('-').map(Number);
	const index = y * 12 + (m - 1) + n;
	const year = Math.floor(index / 12);
	const month = index % 12; // 0-based
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	return `${year}-${pad(month + 1)}-${pad(Math.min(d, daysInMonth))}`;
}

/** "Oct 9" style label for a YYYY-MM-DD string, in the user's locale. */
export function formatShortDate(date: string, withYear = false): string {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		...(withYear ? { year: 'numeric' } : {})
	});
}

const yearOf = (date: string) => Number(date.slice(0, 4));

/**
 * A date for the schedule: "Oct 24", or "Oct 24, 2027" when it isn't in `refYear` (the surgery
 * year), so a date far ahead can't be mistaken for one this year.
 */
export function formatScheduleDate(date: string, refYear: number): string {
	return formatShortDate(date, yearOf(date) !== refYear);
}

/**
 * "Oct 24 – Oct 30", with the year on both ends when the range runs into another calendar year or
 * outside `refYear` (the surgery year); "Oct 24 →" when it has no end. `end` null means open-ended.
 */
export function formatDateRange(start: string, end: string | null, refYear: number): string {
	if (end === null) return `${formatScheduleDate(start, refYear)} →`;
	if (end === start) return formatScheduleDate(start, refYear);
	const years = yearOf(start) !== yearOf(end) || yearOf(start) !== refYear;
	return `${formatShortDate(start, years)} – ${formatShortDate(end, years)}`;
}

/** "10:42" (or "10:42 AM"), the way this phone shows the time. */
export function formatClockTime(timestamp: number, locale?: string): string {
	return new Date(timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** "Tue 20 Oct": a short date for tight spaces. */
export function formatCompactDate(timestamp: number, locale?: string): string {
	return new Date(timestamp).toLocaleDateString(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
}

/** "Monday, 12 October 2026" for a YYYY-MM-DD string, in the user's locale. */
export function formatLongDate(date: string): string {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}
