import { toDateString } from './dates';
import { wihDilators } from './dilators';
import { defaultMessages } from './messages';
import type { Phase, ProgramId, Settings, SlotId, Step } from './types';

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

/** Day 1 is the surgery date; dilation only starts after this many rest days. */
const REST_DAYS = 7;

/** A regular week N (N >= 2) starts 7 days after week N-1; week 1 starts on day REST_DAYS + 1. */
function week(n: number, steps: Step[]): Phase {
	const from = REST_DAYS + 7 * (n - 1) + 1;
	return phase(`wih-week-${n}`, `Week ${n}`, from, from + 6, TWICE_DAILY, steps);
}

/** Day 1 to the end of week 24: the same in both WIH programs. */
function sharedStart(): Phase[] {
	return [
		phase('wih-week-0', 'Week 0 · Rest (no dilation yet)', 1, REST_DAYS, [], []),
		phase(
			'wih-week-1-day-1',
			'Week 1 · Day 1 (off packing)',
			REST_DAYS + 1,
			REST_DAYS + 1,
			ONCE_DAILY,
			[d(0, 30)]
		),
		phase('wih-week-1-day-2', 'Week 1 · Day 2', REST_DAYS + 2, REST_DAYS + 2, ONCE_DAILY, [
			d(0, 60)
		]),
		phase('wih-week-1-day-3', 'Week 1 · Day 3', REST_DAYS + 3, REST_DAYS + 3, ONCE_DAILY, [
			d(0, 90)
		]),
		phase('wih-week-1-day-4-7', 'Week 1 · Day 4–7', REST_DAYS + 4, REST_DAYS + 7, ONCE_DAILY, [
			d(0, 120)
		]),
		week(2, [d(0, 25), d(1, 50)]),
		week(3, [d(0, 25), d(1, 25), d(2, 25)]),
		week(4, [d(0, 10), d(1, 15), d(2, 50)]),
		week(5, [d(0, 10), d(1, 10), d(2, 30), d(3, 25)]),
		week(6, [d(0, 5), d(1, 10), d(2, 10), d(3, 50)]),
		week(7, [d(1, 10), d(2, 10), d(3, 40), d(4, 15)]),
		week(8, [d(1, 10), d(2, 10), d(3, 25), d(4, 30)]),
		week(9, [d(1, 5), d(2, 5), d(3, 15), d(4, 50)]),
		week(10, [d(1, 5), d(2, 5), d(3, 5), d(4, 60)])
	];
}

const WEEK_11 = REST_DAYS + 71;
const END_OF_YEAR_1 = REST_DAYS + 364;
const YEAR_2_START = REST_DAYS + 365;
const YEAR_3_START = REST_DAYS + 731;

/** WIH International Hospital standard program: dilators 0–4. */
export const WIH_PHASES: Phase[] = [
	...sharedStart(),
	phase('wih-week-11-52', 'Week 11–52 (rest of year 1)', WEEK_11, END_OF_YEAR_1, TWICE_DAILY, [
		d(1, 5),
		d(2, 5),
		d(3, 5),
		d(4, 60)
	]),
	phase('wih-year-2', 'Year 2', YEAR_2_START, REST_DAYS + 730, TWICE_DAILY, [d(3, 5), d(4, 55)]),
	phase('wih-year-3-plus', 'Year 3 and beyond', YEAR_3_START, null, ONCE_DAILY, [d(3, 5), d(4, 55)])
];

/**
 * The WIH program that also uses dilator 5. Identical to the standard one up to week 24; from week
 * 25 dilator 5 joins, and in years 2 and 3 it takes over the long session.
 */
export const WIH_SIZE5_PHASES: Phase[] = [
	...sharedStart(),
	phase('wih-week-11-24', 'Week 11–24', WEEK_11, REST_DAYS + 168, TWICE_DAILY, [
		d(1, 5),
		d(2, 5),
		d(3, 5),
		d(4, 60)
	]),
	phase(
		'wih-week-25-52',
		'Week 25–52 (rest of year 1)',
		REST_DAYS + 169,
		END_OF_YEAR_1,
		TWICE_DAILY,
		[d(1, 5), d(2, 5), d(3, 5), d(4, 50), d(5, 10)]
	),
	phase('wih-year-2', 'Year 2', YEAR_2_START, REST_DAYS + 730, TWICE_DAILY, [
		d(3, 5),
		d(4, 5),
		d(5, 50)
	]),
	phase('wih-year-3-plus', 'Year 3 and beyond', YEAR_3_START, null, ONCE_DAILY, [d(4, 5), d(5, 55)])
];

export const PROGRAMS: { id: ProgramId; label: string; blurb: string }[] = [
	{
		id: 'standard',
		label: 'WIH standard',
		blurb: 'The usual program with dilators 0 to 4.'
	},
	{
		id: 'size5',
		label: 'WIH with size 5',
		blurb:
			'The same until week 24. From week 25 dilator 5 joins in, and in years 2 and 3 it takes over the long session.'
	}
];

export function wihPhases(program: ProgramId = 'standard'): Phase[] {
	return structuredClone(program === 'size5' ? WIH_SIZE5_PHASES : WIH_PHASES);
}

/**
 * Day 1 is your surgery date. Until the user has told us, `startDate` is only a placeholder
 * (today) that nothing shows: the Today screen asks for the real one.
 */
export function defaultSettings(today = new Date()): Settings {
	return {
		startDate: toDateString(today),
		switchWindowMinutes: 1,
		// a brand-new install knows neither the program nor the surgery date: Today asks, instead of assuming
		setup: 'ask-program',
		volume: 100,
		mascot: 'bunny',
		celebrations: true,
		dilators: wihDilators(),
		messages: defaultMessages(),
		phases: wihPhases()
	};
}
