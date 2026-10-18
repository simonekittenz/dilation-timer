import { describe, expect, it } from 'vitest';
import { ALERT_ID, MAX_NUDGES, NUDGE_EVERY_MS, planBackgroundAlerts } from './backgroundAlerts';
import { adjust, confirmSwitch, pause, skipStep, startSession, tick } from './session';

const steps = [
	{ label: 'Dilator 1', minutes: 5, color: '#fff' },
	{ label: 'Dilator 2', minutes: 10, color: '#000', nickname: 'Sunny' }
];
const MIN = 60_000;
const W = 2 * MIN; // switch window

describe('planBackgroundAlerts', () => {
	it('while a dilator is running: an alert exactly when it ends, then reminders after the switch window', () => {
		const s = startSession(steps, null, '2026-01-01', 0, 'x');
		const plan = planBackgroundAlerts(s, 60_000, W);
		expect(plan[0]).toMatchObject({ id: ALERT_ID, kind: 'switch', at: 5 * MIN });
		expect(plan[0].body).toContain('Dilator 2 “Sunny”');
		const nudges = plan.slice(1);
		expect(nudges).toHaveLength(MAX_NUDGES);
		expect(nudges[0].at).toBe(5 * MIN + W);
		expect(nudges.map((n) => n.at - nudges[0].at)).toEqual(
			Array.from({ length: MAX_NUDGES }, (_, k) => k * NUDGE_EVERY_MS)
		);
		expect(new Set(plan.map((a) => a.id)).size).toBe(plan.length); // every alert has its own id
		expect(plan.every((a) => a.id >= ALERT_ID && a.id <= ALERT_ID + MAX_NUDGES)).toBe(true);
	});

	it('the last dilator gets a single "all done" alert and no reminders', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = confirmSwitch(tick(s, 5 * MIN), 5 * MIN);
		const plan = planBackgroundAlerts(s, 6 * MIN, W);
		expect(plan).toHaveLength(1);
		expect(plan[0]).toMatchObject({ kind: 'done', at: 15 * MIN, title: 'All done! 🎉' });
	});

	it('follows pauses, added minutes and the real start time', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = adjust(s, MIN, MIN); // +1 minute
		expect(planBackgroundAlerts(s, MIN, W)[0].at).toBe(6 * MIN);
		// resumed later: the end moves back by the time spent paused
		const paused = pause(s, 2 * MIN);
		expect(planBackgroundAlerts(paused, 3 * MIN, W)).toEqual([]); // paused: nothing is coming
	});

	it('once the timer has ended it only reminds, starting after the switch window', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = tick(s, 5 * MIN + 1000); // ended at 5:00
		const plan = planBackgroundAlerts(s, 5 * MIN + 30_000, W);
		expect(plan.every((a) => a.kind === 'nudge')).toBe(true);
		expect(plan[0].at).toBe(5 * MIN + W); // 7:00
		expect(plan).toHaveLength(MAX_NUDGES);
	});

	it('already past the switch window: the first reminder comes almost straight away', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = tick(s, 5 * MIN + 1000);
		const now = 20 * MIN;
		const plan = planBackgroundAlerts(s, now, W);
		expect(plan[0].at).toBe(now + 2000);
		expect(plan[1].at - plan[0].at).toBe(NUDGE_EVERY_MS);
	});

	it('skipping to the next dilator starts the reminders from the skip', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = skipStep(s, 3 * MIN);
		expect(planBackgroundAlerts(s, 3 * MIN + 1000, W)[0].at).toBe(3 * MIN + W);
	});

	it('plans nothing when there is nothing to alert about', () => {
		expect(planBackgroundAlerts(null, 0, W)).toEqual([]);
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = confirmSwitch(tick(s, 5 * MIN), 5 * MIN);
		const finished = tick(s, 15 * MIN + 1);
		expect(finished.phase).toBe('finished');
		expect(planBackgroundAlerts(finished, 15 * MIN + 2, W)).toEqual([]);
		// a timer that "ended" a moment ago is the app's job, not the alarm clock's
		const justEnded = startSession(steps, null, '2026-01-01', 0, 'x');
		expect(planBackgroundAlerts(justEnded, 5 * MIN, W)).toEqual([]);
	});

	it('never schedules anything in the past', () => {
		const s = tick(startSession(steps, null, '2026-01-01', 0, 'x'), 5 * MIN);
		const now = 5 * MIN + 3 * NUDGE_EVERY_MS;
		for (const a of planBackgroundAlerts(s, now, 0)) expect(a.at).toBeGreaterThan(now);
	});
});
