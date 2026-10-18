import { describe, expect, it } from 'vitest';
import { defaultSettings } from './defaults';
import { migrateSettings } from './migrate';
import { buildSettings, messagesToText } from './settingsDraft';
import { summarizeWeek } from './setup';

const settingsFor = (surgery: string) => ({ ...defaultSettings(), startDate: surgery });

describe('a brand-new install does not assume a surgery date', () => {
	it('starts in the "ask for the date" stage', () => {
		expect(defaultSettings().setup).toBe('ask-date');
	});

	it('but anything saved before setup existed counts as already set up', () => {
		expect(migrateSettings({ startDate: '2026-01-01' }).setup).toBe('done');
		expect(migrateSettings({ startDate: '2026-01-01', setup: 'done' }).setup).toBe('done');
		expect(migrateSettings({ startDate: '2026-01-01', setup: 'bogus' } as never).setup).toBe(
			'done'
		);
	});

	it('keeps an unfinished setup unfinished across saves and reloads', () => {
		expect(migrateSettings({ startDate: '2026-01-01', setup: 'confirm' }).setup).toBe('confirm');
		expect(migrateSettings({ startDate: '2026-01-01', setup: 'ask-date' }).setup).toBe('ask-date');
		expect(migrateSettings(undefined).setup).toBe('ask-date');
	});

	it('survives the Settings form (autosave must not lose or finish it)', () => {
		for (const stage of ['ask-date', 'confirm', 'done'] as const) {
			const s = { ...defaultSettings(), setup: stage };
			expect(buildSettings(structuredClone(s), messagesToText(s.messages))!.setup).toBe(stage);
		}
	});
});

describe('summarizeWeek: "where are you today?"', () => {
	it('on a rest day, says when dilation starts', () => {
		const w = summarizeWeek(settingsFor('2026-10-10'), '2026-10-12'); // day 3
		expect(w).toMatchObject({
			state: 'rest',
			day: 3,
			phaseStart: '2026-10-10',
			phaseEnd: '2026-10-16',
			daysUntilDilation: 5,
			firstDilationDate: '2026-10-17'
		});
		expect(w.phase?.id).toBe('wih-week-0');
	});

	it('on a dilation day, says how many sessions and how long', () => {
		const w = summarizeWeek(settingsFor('2026-09-25'), '2026-10-18'); // day 24: Week 3
		expect(w.state).toBe('dilation');
		expect(w.phase?.id).toBe('wih-week-3');
		expect(w).toMatchObject({ sessionsPerDay: 2, minutesPerSession: 75 });
		expect(w.phaseStart).toBe('2026-10-16');
		expect(w.phaseEnd).toBe('2026-10-22');
	});

	it("the first week is once a day, with that day's length", () => {
		const w = summarizeWeek(settingsFor('2026-10-10'), '2026-10-18'); // day 9 = week 1 day 2
		expect(w).toMatchObject({ state: 'dilation', sessionsPerDay: 1, minutesPerSession: 60 });
	});

	it('before the surgery, counts down instead of pretending', () => {
		const w = summarizeWeek(settingsFor('2026-10-22'), '2026-10-18');
		expect(w).toMatchObject({ state: 'before-surgery', daysUntilSurgery: 4 });
		expect(w.phase).toBeUndefined();
	});

	it('on the day itself it is Day 1', () => {
		expect(summarizeWeek(settingsFor('2026-10-18'), '2026-10-18')).toMatchObject({
			state: 'rest',
			day: 1
		});
	});

	it('copes with an open-ended phase and with a date so old nothing is planned', () => {
		const late = summarizeWeek(settingsFor('2024-01-01'), '2026-10-18');
		expect(late.state).toBe('dilation');
		expect(late.phaseEnd).toBeNull(); // "Year 3 and beyond" keeps going
		const none = { ...settingsFor('2026-10-10'), phases: [] };
		expect(summarizeWeek(none, '2026-10-12').state).toBe('beyond');
	});
});
