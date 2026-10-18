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

/** "Oct 9" style label for a YYYY-MM-DD string, in the user's locale. */
export function formatShortDate(date: string): string {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
