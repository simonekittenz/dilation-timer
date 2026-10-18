import { describe, expect, it } from 'vitest';
import {
	ADJUST_MS,
	ADD_WINDOW_MS,
	adjust,
	alertStart,
	chillOut,
	confirmSwitch,
	escalateAt,
	extendSwitchWindow,
	MIN_CHILL_MS,
	finish,
	isEscalated,
	isPaused,
	switchWindowLeftMs,
	remainingMs,
	overtimeMs,
	skipStep,
	resume,
	pause,
	startSession,
	tick
} from './session';

const steps = [
	{ label: 'A', minutes: 1, color: '#fff' },
	{ label: 'B', minutes: 2, color: '#000' }
];

describe('session', () => {
	it('waits for the user before starting the next step', () => {
		let s = startSession(steps, 'morning', '2026-01-01', 0, 'x');
		s = tick(s, 59_000);
		expect(s.phase).toBe('running');
		expect(s.warned).toBe(true);
		s = tick(s, 61_000);
		expect(s.phase).toBe('switch');
		// timer for B has not started yet
		s = confirmSwitch(s, 90_000);
		expect(s.phase).toBe('running');
		expect(s.stepIndex).toBe(1);
		expect(remainingMs(s, 90_000)).toBe(120_000);
	});

	it('finishes after the last step and logs real durations', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = confirmSwitch(tick(s, 60_000), 90_000);
		s = tick(s, 90_000 + 120_000);
		expect(s.phase).toBe('finished');
		const entry = finish(s, 90_000 + 130_000);
		expect(entry.steps.map((x) => x.actualSeconds)).toEqual([90, 130]);
	});

	it('ignores confirmSwitch outside the switch phase', () => {
		const s = startSession(steps, null, '2026-01-01', 0, 'x');
		expect(confirmSwitch(s, 1000)).toBe(s);
	});

	it('stays quiet during the switch window, then escalates', () => {
		const switchWindow = 120_000;
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		expect(isEscalated(s, 30_000, switchWindow)).toBe(false);
		s = tick(s, 61_000);
		expect(s.phase).toBe('switch');
		expect(isEscalated(s, 61_000, switchWindow)).toBe(false);
		expect(switchWindowLeftMs(s, 90_000, switchWindow)).toBe(90_000);
		expect(isEscalated(s, 60_000 + 119_000, switchWindow)).toBe(false);
		expect(isEscalated(s, 60_000 + 120_000, switchWindow)).toBe(true);
	});

	it('pauses and resumes without losing time', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = pause(s, 20_000);
		expect(isPaused(s)).toBe(true);
		expect(remainingMs(s, 20_000)).toBe(40_000);
		// time passes while paused: nothing changes, nothing fires
		expect(remainingMs(s, 500_000)).toBe(40_000);
		expect(tick(s, 500_000)).toBe(s);
		s = resume(s, 500_000);
		expect(isPaused(s)).toBe(false);
		expect(remainingMs(s, 500_000)).toBe(40_000);
		expect(tick(s, 539_000).phase).toBe('running');
		expect(tick(s, 541_000).phase).toBe('switch');
	});

	it('does not count paused time in the logged duration', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = resume(pause(s, 20_000), 320_000);
		s = confirmSwitch(tick(s, 360_000), 360_000);
		s = tick(s, 360_000 + 120_000);
		const entry = finish(s, 360_000 + 120_000);
		// first dilator: 60s of timer, 300s paused (not counted)
		expect(entry.steps[0].actualSeconds).toBe(60);
	});

	it('adds and removes minutes, but never cuts the timer to nothing', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = adjust(s, ADJUST_MS, 0);
		expect(remainingMs(s, 0)).toBe(120_000);
		s = adjust(s, -ADJUST_MS, 0);
		expect(remainingMs(s, 0)).toBe(60_000);
		// only 30s left: removing a minute is refused
		const late = adjust(s, -ADJUST_MS, 30_000);
		expect(late).toBe(s);
		// adding time after the 10s warning re-arms it
		let warned = tick(s, 55_000);
		expect(warned.warned).toBe(true);
		warned = adjust(warned, ADJUST_MS, 55_000);
		expect(warned.warned).toBe(false);
	});

	it('resets adjustments for the next dilator', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = adjust(s, ADJUST_MS, 0);
		s = confirmSwitch(skipStep(s, 10_000), 12_000);
		expect(remainingMs(s, 12_000)).toBe(120_000);
	});

	it('skips ahead to the switch prompt, with the switch window starting from the skip', () => {
		const switchWindow = 60_000;
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = skipStep(s, 15_000);
		expect(s.phase).toBe('switch');
		expect(overtimeMs(s, 20_000)).toBe(5_000);
		expect(switchWindowLeftMs(s, 20_000, switchWindow)).toBe(55_000);
		expect(isEscalated(s, 20_000, switchWindow)).toBe(false);
		expect(isEscalated(s, 15_000 + switchWindow, switchWindow)).toBe(true);
	});

	it('skipping the last dilator finishes the session', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = confirmSwitch(skipStep(s, 5_000), 6_000);
		s = skipStep(s, 7_000);
		expect(s.phase).toBe('finished');
		expect(finish(s, 8_000).steps).toHaveLength(2);
	});

	it('copes with sessions saved before pause/skip existed', () => {
		const old = startSession(steps, null, '2026-01-01', 0, 'x');
		const legacy = { ...old } as Partial<typeof old>;
		delete legacy.pausedAt;
		delete legacy.adjustMs;
		delete legacy.alertSince;
		const s = legacy as typeof old;
		expect(remainingMs(s, 10_000)).toBe(50_000);
		expect(tick(s, 61_000).phase).toBe('switch');
		expect(overtimeMs(tick(s, 61_000), 70_000)).toBe(10_000);
	});

	it('finishing the last dilator never escalates into a nagging alarm', () => {
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		s = confirmSwitch(tick(s, 60_000), 60_000);
		s = tick(s, 60_000 + 120_000);
		expect(s.phase).toBe('finished');
		expect(isEscalated(s, 60_000 + 120_000 + 3_600_000, 60_000)).toBe(false);
		// ...and it is logged as ending when the timer ended, however late the app noticed
		expect(finish(s, alertStart(s)).steps[1].actualSeconds).toBe(120);
	});
});

describe('+1 min and "Chill out" on the switch screen', () => {
	const W = 120_000; // a 2 minute gentle window
	const ended = () => tick(startSession(steps, null, '2026-01-01', 0, 'x'), 60_000); // switch at 1:00

	it('+1 min pushes the louder nudge back one minute, for the gentle window only', () => {
		let s = ended();
		expect(escalateAt(s, W)).toBe(180_000);
		s = extendSwitchWindow(s, 70_000, W);
		expect(escalateAt(s, W)).toBe(180_000 + ADD_WINDOW_MS);
		expect(switchWindowLeftMs(s, 70_000, W)).toBe(170_000);
		s = extendSwitchWindow(s, 71_000, W);
		expect(escalateAt(s, W)).toBe(180_000 + 2 * ADD_WINDOW_MS);
		expect(isEscalated(s, 200_000, W)).toBe(false);
		expect(isEscalated(s, 300_001, W)).toBe(true);
	});

	it('+1 min does nothing once the alarm is already going, or when not on the switch screen', () => {
		const s = ended();
		expect(extendSwitchWindow(s, 200_000, W)).toBe(s);
		const running = startSession(steps, null, '2026-01-01', 0, 'x');
		expect(extendSwitchWindow(running, 1000, W)).toBe(running);
	});

	it('does not touch the real timer or the overtime clock', () => {
		const s = extendSwitchWindow(ended(), 70_000, W);
		expect(alertStart(s)).toBe(60_000);
		expect(overtimeMs(s, 100_000)).toBe(40_000);
	});

	it('"Chill out" stops the alarm and waits a whole new window before nudging again', () => {
		let s = ended();
		const now = 200_000; // 80s past the window, so escalated
		expect(isEscalated(s, now, W)).toBe(true);
		s = chillOut(s, now, W);
		expect(isEscalated(s, now, W)).toBe(false);
		expect(switchWindowLeftMs(s, now, W)).toBe(W);
		expect(isEscalated(s, now + W - 1, W)).toBe(false);
		expect(isEscalated(s, now + W, W)).toBe(true);
	});

	it('"Chill out" can be pressed again and again', () => {
		let s = chillOut(ended(), 200_000, W);
		const later = 200_000 + W + 5_000;
		expect(isEscalated(s, later, W)).toBe(true);
		s = chillOut(s, later, W);
		expect(isEscalated(s, later, W)).toBe(false);
		expect(escalateAt(s, W)).toBe(later + W);
	});

	it('"Chill out" does nothing before the alarm has escalated', () => {
		const s = ended();
		expect(chillOut(s, 70_000, W)).toBe(s);
	});

	it('with a 0 minute window it still gives a minute of peace', () => {
		const s = chillOut(ended(), 100_000, 0);
		expect(escalateAt(s, 0)).toBe(100_000 + MIN_CHILL_MS);
	});

	it('both reset for the next switch', () => {
		let s = extendSwitchWindow(ended(), 70_000, W);
		s = confirmSwitch(s, 80_000);
		expect(s.windowExtraMs).toBe(0);
		expect(s.quietUntil).toBeNull();
		let t = chillOut(ended(), 200_000, W);
		t = confirmSwitch(t, 210_000);
		expect(t.quietUntil).toBeNull();
	});

	it('an older saved session without these fields behaves as before', () => {
		const s = ended();
		expect(s.windowExtraMs).toBeUndefined();
		expect(escalateAt(s, W)).toBe(60_000 + W);
	});
});
