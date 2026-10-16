import { describe, expect, it } from 'vitest';
import {
	ADJUST_MS,
	adjust,
	confirmSwitch,
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
});
