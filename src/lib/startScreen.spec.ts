import { describe, expect, it } from 'vitest';
import { planBackgroundAlerts } from './backgroundAlerts';
import {
	adjust,
	confirmSwitch,
	estimatedFinish,
	finish,
	getReady,
	pause,
	plannedEnd,
	ready,
	sessionOverview,
	skipStep,
	startSession,
	tick
} from './session';
import { learnSwitches, usualSwitchMs } from './switchHistory';
import type { SessionStep } from './types';

const MIN = 60_000;
const steps: SessionStep[] = [
	{ label: 'A', minutes: 10, color: '#111' },
	{ label: 'B', minutes: 20, color: '#222' }
];
const begin = (now = 0) => getReady(startSession(steps, 'morning', '2026-01-01', now));

describe('the start screen: the first timer waits for "Ready"', () => {
	it('begins in the start phase on the first dilator, without running a timer', () => {
		const s = begin(1_000);
		expect(s.phase).toBe('start');
		expect(s.stepIndex).toBe(0);
		// time passing does nothing: no chime, no switch
		expect(tick(s, 60 * MIN)).toBe(s);
	});

	it('starts the first timer when you press Ready, counting from then', () => {
		const s = ready(begin(0), 90_000);
		expect(s.phase).toBe('running');
		expect(plannedEnd(s)).toBe(90_000 + 10 * MIN);
		expect(s.records[0].startedAt).toBe(90_000);
		expect(s.startedAt).toBe(0); // the session itself began when it was started
	});

	it('notes how long it took to press Ready', () => {
		const s = ready(begin(0), 130_000);
		expect(s.records[0].readyAfterMs).toBe(130_000);
		const log = finish(s, 40 * MIN);
		expect(log.steps[0].readySeconds).toBe(130);
		expect(log.steps[1]?.readySeconds).toBeUndefined();
	});

	it('does nothing when pressed outside the start screen', () => {
		const running = ready(begin(0), 1_000);
		expect(ready(running, 5_000)).toBe(running);
	});

	it('can not be paused, adjusted or skipped before Ready, and is not a swap', () => {
		const s = begin(0);
		expect(pause(s, 1_000)).toBe(s);
		expect(adjust(s, MIN, 1_000)).toBe(s);
		expect(skipStep(s, 1_000)).toBe(s);
		expect(confirmSwitch(s, 1_000)).toBe(s);
	});

	it('does not count towards the swap times the nudge learns from', () => {
		const s = ready(begin(0), 400_000);
		const log = finish(s, 40 * MIN);
		expect(log.steps[0].switchSeconds).toBeUndefined();
		const history = learnSwitches([log, log, log, log]);
		expect(usualSwitchMs(history, 'A')).toBe(0);
	});

	it('has no locked-screen alerts: nothing rings before the timer runs', () => {
		expect(planBackgroundAlerts(begin(0), 10_000, 60_000)).toEqual([]);
		expect(planBackgroundAlerts(ready(begin(0), 10_000), 20_000, 60_000)).not.toEqual([]);
	});

	it('plans the whole session from now while waiting', () => {
		const s = begin(0);
		expect(estimatedFinish(s, 5 * MIN, 0)).toBe(5 * MIN + 30 * MIN);
		expect(estimatedFinish(s, 5 * MIN, () => MIN)).toBe(5 * MIN + 30 * MIN + MIN);
		const o = sessionOverview(s, 5 * MIN);
		expect(o.rows.map((r) => r.status)).toEqual(['now', 'later']);
		expect(o.rows[0].startAt).toBe(5 * MIN);
		expect(o.rows[0].endAt).toBe(15 * MIN);
		expect(o.rows[1].endAt).toBe(35 * MIN);
	});
});
