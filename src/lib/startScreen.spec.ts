import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planBackgroundAlerts } from './backgroundAlerts';
import {
	adjust,
	isWaitPaused,
	newSession,
	confirmSwitch,
	estimatedFinish,
	finish,
	getReady,
	pause,
	resume,
	restartWait,
	waitedMs,
	plannedEnd,
	ready,
	sessionOverview,
	skipStep,
	startSession,
	tick
} from './session';
import { planSessionNotice } from './sessionNotice';
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

	it('can not be adjusted, skipped or switched before Ready', () => {
		const s = begin(0);
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

	describe('the clock on the start screen', () => {
		it('counts from when the session was started', () => {
			expect(waitedMs(begin(1_000), 61_000)).toBe(60_000);
		});

		it('stops when paused and carries on from there when continued', () => {
			let s = pause(begin(0), 30_000);
			expect(isWaitPaused(s)).toBe(true);
			expect(waitedMs(s, 10 * MIN)).toBe(30_000); // frozen
			s = resume(s, 5 * MIN);
			expect(isWaitPaused(s)).toBe(false);
			expect(waitedMs(s, 5 * MIN)).toBe(30_000);
			expect(waitedMs(s, 5 * MIN + 20_000)).toBe(50_000);
			expect(s.startedAt).toBe(0); // the session itself still began at the start
		});

		it('goes back to zero on Reset, paused or not', () => {
			let s = restartWait(begin(0), 90_000);
			expect(waitedMs(s, 90_000)).toBe(0);
			expect(waitedMs(s, 100_000)).toBe(10_000);
			s = pause(s, 100_000);
			s = restartWait(s, 400_000);
			expect(waitedMs(s, 400_000)).toBe(0); // reset while paused: zero, still paused
			expect(isWaitPaused(s)).toBe(true);
			expect(waitedMs(resume(s, 500_000), 530_000)).toBe(30_000);
		});

		it('is what is saved as the time it took, without the pauses and before a Reset', () => {
			let s = begin(0);
			s = pause(s, 60_000); // a break after a minute
			s = resume(s, 10 * MIN);
			s = restartWait(s, 10 * MIN + 5_000); // start over
			s = ready(s, 10 * MIN + 65_000);
			expect(s.records[0].readyAfterMs).toBe(60_000);
		});

		it('uses the frozen value when Ready is pressed while paused', () => {
			const s = pause(begin(0), 45_000);
			expect(ready(s, 20 * MIN).records[0].readyAfterMs).toBe(45_000);
			expect(ready(s, 20 * MIN).pausedAt).toBeNull();
		});

		it('does nothing outside the start screen', () => {
			const running = ready(begin(0), 1_000);
			expect(restartWait(running, 5_000)).toBe(running);
			expect(isWaitPaused(running)).toBe(false);
		});

		it('is shown on the lock screen as paused, or counting up from where it is', () => {
			const s = begin(0);
			expect(planSessionNotice(s, 40_000)).toMatchObject({ clock: 'up', at: 0 });
			const reset = restartWait(s, 30_000);
			expect(planSessionNotice(reset, 40_000)).toMatchObject({ clock: 'up', at: 30_000 });
			const paused = pause(reset, 50_000);
			expect(planSessionNotice(paused, 90_000)).toMatchObject({
				clock: 'none',
				text: 'Bring in A · paused'
			});
		});
	});
});

describe('the clock on the start screen can be switched off in Settings', () => {
	const timer = readFileSync(new URL('./Timer.svelte', import.meta.url), 'utf8');
	const alerts = readFileSync(
		new URL('../routes/settings/alerts/+page.svelte', import.meta.url),
		'utf8'
	);

	it('hides the clock and its buttons together, while the time is still noted', () => {
		const start = timer.slice(timer.indexOf("s.phase === 'start'}"));
		const shown = start.indexOf('store.settings.showStartTimer !== false');
		expect(shown).toBeGreaterThan(-1);
		for (const id of ['start-clock', 'wait-reset', 'wait-pause', 'wait-resume']) {
			expect(start.indexOf(id), id).toBeGreaterThan(shown);
		}
		// Ready still notes the wait, whether or not the clock is on screen
		expect(timer).toContain('store.confirm()');
	});

	it('has a switch in Settings, and the clock is big again', () => {
		expect(alerts).toContain('draft.showStartTimer');
		expect(timer).toContain('class="countdown"');
		expect(timer).not.toContain('class="waited"');
	});
});

describe('the words on the start screen', () => {
	const timer = readFileSync(new URL('./Timer.svelte', import.meta.url), 'utf8');
	const start = timer.slice(
		timer.indexOf("s.phase === 'start'}"),
		timer.indexOf("s.phase === 'switch'}")
	);

	it('greet with "Let\'s get started" on the screen and on the lock screen', () => {
		expect(start).toContain("Let's get started ♡");
		expect(start).not.toContain("Let's begin");
		const notice = readFileSync(new URL('./sessionNotice.ts', import.meta.url), 'utf8');
		expect(notice).toContain("Let's get started ♡");
		expect(notice).not.toContain("Let's begin");
	});

	it('say the session starts when you press Go, and the button says Go!', () => {
		expect(start).toContain('The session starts when you press Go.');
		expect(start).toMatch(/>\s*Go!\s*</);
		expect(start).not.toContain('Ready ✓');
		expect(start).not.toContain('press Ready');
	});
});

describe('the start screen clock', () => {
	const timer = readFileSync(new URL('./Timer.svelte', import.meta.url), 'utf8');

	it('is big but grey, not the pink of the running countdown', () => {
		expect(timer).toMatch(/\.startstage \.countdown \{[^}]*color: var\(--muted\)/);
	});
});

describe('starting a session with or without the start screen', () => {
	it('waits for Go on the start screen, by default', () => {
		const s = newSession(steps, 'morning', '2026-01-01', 1_000, true);
		expect(s.phase).toBe('start');
		expect(tick(s, 60 * MIN)).toBe(s); // no timer yet
	});

	it('starts the first timer straight away when the start screen is off, as it used to', () => {
		const s = newSession(steps, 'morning', '2026-01-01', 1_000, false);
		expect(s.phase).toBe('running');
		expect(plannedEnd(s)).toBe(1_000 + 10 * MIN);
		expect(s.records[0].startedAt).toBe(1_000);
		// and no wait is noted for that session
		expect(finish(s, 40 * MIN).steps[0].readySeconds).toBeUndefined();
		expect(planBackgroundAlerts(s, 2_000, 60_000)).not.toEqual([]); // alerts as before
	});

	it('is a switch in Settings, which also hides the clock row while it is off', () => {
		const alerts = readFileSync(
			new URL('../routes/settings/alerts/+page.svelte', import.meta.url),
			'utf8'
		);
		expect(alerts).toContain('draft.startScreen');
		const clockRow = alerts.indexOf('draft.showStartTimer');
		const guard = alerts.indexOf('draft.startScreen !== false}');
		expect(guard).toBeGreaterThan(-1);
		expect(clockRow).toBeGreaterThan(guard);
	});
});
