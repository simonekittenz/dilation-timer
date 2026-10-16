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
