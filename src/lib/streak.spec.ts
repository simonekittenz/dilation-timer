import { describe, expect, it } from 'vitest';
import { defaultSettings } from './defaults';
import { computeStreak } from './streak';
import type { LogEntry, SlotId } from './types';

// 2026-01-15 onwards is week 2: a morning and an evening session every day
const settings = defaultSettings(new Date(2026, 0, 1));

const entry = (date: string, slot: SlotId | null, skipped = false): LogEntry => ({
	id: `${date}-${slot}-${skipped}`,
	date,
	slot,
	startedAt: 0,
	finishedAt: 1,
	skipped,
	steps: []
});
const full = (date: string) => [entry(date, 'morning'), entry(date, 'evening')];

describe('computeStreak', () => {
	it('is nothing without any sessions', () => {
		expect(computeStreak(settings, [], '2026-01-16')).toEqual({
			current: 0,
			best: 0,
			todayPending: true
		});
	});

	it('counts days where every session was done', () => {
		const log = [...full('2026-01-15'), ...full('2026-01-16'), ...full('2026-01-17')];
		expect(computeStreak(settings, log, '2026-01-17')).toEqual({
			current: 3,
			best: 3,
			todayPending: false
		});
	});

	it('does not hold an unfinished today against you, but says it can still grow', () => {
		const log = [...full('2026-01-15'), ...full('2026-01-16'), entry('2026-01-17', 'morning')];
		expect(computeStreak(settings, log, '2026-01-17')).toEqual({
			current: 2,
			best: 2,
			todayPending: true
		});
	});

	it('is ended by a skipped session or a day with a session missing', () => {
		const skipped = [
			...full('2026-01-15'),
			entry('2026-01-16', 'morning'),
			entry('2026-01-16', 'evening', true),
			...full('2026-01-17')
		];
		expect(computeStreak(settings, skipped, '2026-01-17')).toMatchObject({ current: 1, best: 1 });
		const missed = [...full('2026-01-15'), entry('2026-01-16', 'morning'), ...full('2026-01-17')];
		expect(computeStreak(settings, missed, '2026-01-17')).toMatchObject({ current: 1, best: 1 });
	});

	it('remembers the best run after one has ended', () => {
		const log = [
			...full('2026-01-15'),
			...full('2026-01-16'),
			...full('2026-01-17'),
			...full('2026-01-19')
		]; // the 18th was missed
		expect(computeStreak(settings, log, '2026-01-19')).toMatchObject({ current: 1, best: 3 });
	});

	it('passes over rest days without counting or breaking', () => {
		// 2026-01-07 is still the rest week; the schedule starts on the 8th with one daily session
		const log = [entry('2026-01-08', 'daily'), entry('2026-01-09', 'daily')];
		expect(computeStreak(settings, log, '2026-01-09')).toMatchObject({ current: 2 });
		const rest = defaultSettings(new Date(2026, 0, 1));
		expect(computeStreak(rest, [], '2026-01-03')).toEqual({
			current: 0,
			best: 0,
			todayPending: false
		});
	});

	it('ignores extra sessions that stand for no slot', () => {
		const log = [entry('2026-01-15', null), entry('2026-01-15', 'morning')];
		expect(computeStreak(settings, log, '2026-01-16')).toMatchObject({ current: 0 });
	});

	it('gives a past day still to be finished a chance (late night)', () => {
		const log = [
			...full('2026-01-15'),
			entry('2026-01-16', 'morning') // last night's evening is still open at 1 am on the 17th
		];
		expect(computeStreak(settings, log, '2026-01-17', '2026-01-16')).toMatchObject({ current: 1 });
		expect(computeStreak(settings, log, '2026-01-17')).toMatchObject({ current: 0 });
	});

	it('counts a late-night session logged on the previous day', () => {
		const log = [...full('2026-01-15'), ...full('2026-01-16')];
		expect(computeStreak(settings, log, '2026-01-17', null)).toMatchObject({ current: 2 });
	});
});
