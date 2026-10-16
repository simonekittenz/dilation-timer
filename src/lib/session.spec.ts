import { describe, expect, it } from 'vitest';
import {
	confirmSwitch,
	finish,
	isEscalated,
	leewayLeftMs,
	remainingMs,
	startSession,
	tick
} from './session';

const steps = [
	{ label: 'A', minutes: 1 },
	{ label: 'B', minutes: 2 }
];

describe('session', () => {
	it('waits for the user before starting the next step', () => {
		let s = startSession(steps, '08:00', '2026-01-01', 0, 'x');
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

	it('stays calm during the leeway window, then escalates', () => {
		const leeway = 120_000;
		let s = startSession(steps, null, '2026-01-01', 0, 'x');
		expect(isEscalated(s, 30_000, leeway)).toBe(false);
		s = tick(s, 61_000);
		expect(s.phase).toBe('switch');
		expect(isEscalated(s, 61_000, leeway)).toBe(false);
		expect(leewayLeftMs(s, 90_000, leeway)).toBe(90_000);
		expect(isEscalated(s, 60_000 + 119_000, leeway)).toBe(false);
		expect(isEscalated(s, 60_000 + 120_000, leeway)).toBe(true);
	});
});
