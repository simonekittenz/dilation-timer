import { toDateString } from './dates';
import { wihDilators } from './dilators';
import type { Phase, Settings, SlotId, Step } from './types';

const TWICE_DAILY: SlotId[] = ['morning', 'evening'];
const ONCE_DAILY: SlotId[] = ['daily'];

const d = (size: number, minutes: number): Step => ({ dilatorId: `d${size}`, minutes });

function phase(
	id: string,
	label: string,
	fromDay: number,
	toDay: number | null,
	slots: SlotId[],
	steps: Step[]
): Phase {
	return { id, label, fromDay, toDay, slots, steps };
}

/** A regular week N covers days 7(N-1)+1 .. 7N. */
function week(n: number, steps: Step[]): Phase {
	return phase(`wih-week-${n}`, `Week ${n}`, 7 * (n - 1) + 1, 7 * n, TWICE_DAILY, steps);
}

/** WIH International Hospital — vaginal dilation standard program (dilators 0–4). */
export const WIH_PHASES: Phase[] = [
	phase('wih-week-1-day-1', 'Week 1 · Day 1 (off packing)', 1, 1, ONCE_DAILY, [d(0, 30)]),
	phase('wih-week-1-day-2', 'Week 1 · Day 2', 2, 2, ONCE_DAILY, [d(0, 60)]),
	phase('wih-week-1-day-3', 'Week 1 · Day 3', 3, 3, ONCE_DAILY, [d(0, 90)]),
	phase('wih-week-1-day-4-7', 'Week 1 · Day 4–7', 4, 7, ONCE_DAILY, [d(0, 120)]),
	week(2, [d(0, 25), d(1, 50)]),
	week(3, [d(0, 25), d(1, 25), d(2, 25)]),
	week(4, [d(0, 10), d(1, 15), d(2, 50)]),
	week(5, [d(0, 10), d(1, 10), d(2, 30), d(3, 25)]),
	week(6, [d(0, 5), d(1, 10), d(2, 10), d(3, 50)]),
	week(7, [d(1, 10), d(2, 10), d(3, 40), d(4, 15)]),
	week(8, [d(1, 10), d(2, 10), d(3, 25), d(4, 30)]),
	week(9, [d(1, 5), d(2, 5), d(3, 15), d(4, 50)]),
	week(10, [d(1, 5), d(2, 5), d(3, 5), d(4, 60)]),
	phase('wih-week-11-52', 'Week 11–52 (rest of year 1)', 71, 364, TWICE_DAILY, [
		d(1, 5),
		d(2, 5),
		d(3, 5),
		d(4, 60)
	]),
	phase('wih-year-2', 'Year 2', 365, 730, TWICE_DAILY, [d(3, 5), d(4, 55)]),
	phase('wih-year-3-plus', 'Year 3 and beyond', 731, null, ONCE_DAILY, [d(3, 5), d(4, 55)])
];

export function wihPhases(): Phase[] {
	return structuredClone(WIH_PHASES);
}

/** Day 1 defaults to today; set the real date in Settings. */
export function defaultSettings(today = new Date()): Settings {
	return {
		startDate: toDateString(today),
		leewayMinutes: 2,
		dilators: wihDilators(),
		phases: wihPhases()
	};
}
