import { describe, expect, it } from 'vitest';
import {
	confirmSwitch,
	estimatedFinish,
	getReady,
	ready,
	sessionOverview,
	startSession,
	tick
} from './session';
import type { SessionStep } from './types';

const MIN = 60_000;
const steps: SessionStep[] = [
	{ label: 'A', minutes: 10, color: '#111' },
	{ label: 'B', minutes: 20, color: '#222' },
	{ label: 'C', minutes: 30, color: '#333' }
];
const T0 = 1_000_000_000_000;
const WINDOW = MIN; // the gentle switch window

describe('sessionOverview', () => {
	it('lays the dilators out back to back from now, with the switch window between them', () => {
		const s = startSession(steps, 'morning', '2026-01-01', T0);
		const o = sessionOverview(s, T0 + 2 * MIN, WINDOW);
		expect(o.rows.map((r) => r.status)).toEqual(['now', 'later', 'later']);
		expect(o.rows[0]).toMatchObject({ startAt: T0, endAt: T0 + 10 * MIN, minutes: 10 });
		expect(o.rows[1]).toMatchObject({ startAt: T0 + 11 * MIN, endAt: T0 + 31 * MIN });
		expect(o.rows[2]).toMatchObject({ startAt: T0 + 32 * MIN, endAt: T0 + 62 * MIN });
		expect(o.finishAt).toBe(T0 + 62 * MIN);
		expect(o.plannedMinutes).toBe(60);
	});

	it('agrees with the finish time shown at the top of the timer', () => {
		const s = startSession(steps, 'morning', '2026-01-01', T0);
		for (const at of [T0 + MIN, T0 + 9 * MIN]) {
			expect(sessionOverview(s, at, WINDOW).finishAt).toBe(estimatedFinish(s, at, WINDOW));
		}
	});

	it('shows finished dilators with the times they really ran', () => {
		let s = startSession(steps, 'morning', '2026-01-01', T0);
		s = tick(s, T0 + 10 * MIN); // A ends: time to switch
		s = confirmSwitch(s, T0 + 12 * MIN); // switched two minutes late
		const o = sessionOverview(s, T0 + 15 * MIN, WINDOW);
		// A ran until its timer ended; the two minutes of swapping belong to B
		expect(o.rows[0]).toMatchObject({ status: 'done', startAt: T0, endAt: T0 + 10 * MIN });
		expect(o.rows[1]).toMatchObject({ status: 'now', startAt: T0 + 12 * MIN, swapSeconds: 120 });
		expect(o.rows[1].endAt).toBe(T0 + 32 * MIN);
		expect(o.rows[2].startAt).toBe(T0 + 33 * MIN);
	});

	it('notes how long you took to be Ready and each swap', () => {
		let s = ready(getReady(startSession(steps, 'morning', '2026-01-01', T0)), T0 + 75_000);
		s = tick(s, T0 + 75_000 + 10 * MIN);
		s = confirmSwitch(s, T0 + 75_000 + 10 * MIN + 150_000);
		const o = sessionOverview(s, T0 + 20 * MIN, WINDOW);
		expect(o.rows[0]).toMatchObject({ status: 'done', readySeconds: 75, startAt: T0 + 75_000 });
		expect(o.rows[0].swapSeconds).toBeUndefined();
		expect(o.rows[1]).toMatchObject({ status: 'now', swapSeconds: 150 });
		expect(o.rows[1].readySeconds).toBeUndefined();
		expect(o.rows[2].swapSeconds).toBeUndefined(); // not swapped to yet
	});

	it('while waiting to switch, the next dilator starts when the switch window ends', () => {
		let s = startSession(steps, 'morning', '2026-01-01', T0);
		s = tick(s, T0 + 10 * MIN);
		const o = sessionOverview(s, T0 + 10 * MIN + 20_000, WINDOW);
		expect(o.rows.map((r) => r.status)).toEqual(['done', 'later', 'later']);
		expect(o.rows[1].startAt).toBe(T0 + 11 * MIN); // 40 seconds of the window left
		expect(o.finishAt).toBe(estimatedFinish(s, T0 + 10 * MIN + 20_000, WINDOW));
	});

	it('counts minutes added to the dilator being timed', () => {
		const s = { ...startSession(steps, 'morning', '2026-01-01', T0), adjustMs: 3 * MIN };
		const o = sessionOverview(s, T0, WINDOW);
		expect(o.rows[0].minutes).toBe(13);
		expect(o.plannedMinutes).toBe(63);
	});

	it('has no finish time once everything is done', () => {
		let s = startSession([steps[0]], 'morning', '2026-01-01', T0);
		s = tick(s, T0 + 10 * MIN);
		const o = sessionOverview(s, T0 + 11 * MIN, WINDOW);
		expect(o.finishAt).toBeNull();
		expect(o.rows[0]).toMatchObject({ status: 'done', endAt: T0 + 10 * MIN });
	});
});
