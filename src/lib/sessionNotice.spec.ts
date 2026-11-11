import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adjust, confirmSwitch, getReady, pause, ready, startSession, tick } from './session';
import {
	NOTICE_LINGER_MS,
	hideSessionNotice,
	planSessionNotice,
	sessionNoticeAvailable,
	setSessionNoticeForTests,
	showSessionNotice,
	type SessionNotice,
	type SessionNoticePlugin
} from './sessionNotice';
import type { SessionStep } from './types';

const MIN = 60_000;
const steps: SessionStep[] = [
	{ label: '#2', minutes: 10, color: '#111' },
	{ label: '#3', minutes: 20, color: '#222', nickname: 'Bun' },
	{ label: '#4', minutes: 30, color: '#333' }
];
const begin = () => startSession(steps, 'morning', '2026-01-01', 0);

describe('what the lock screen timer says', () => {
	it('counts down to the end of the running timer, and goes by itself just after it', () => {
		const s = begin();
		const n = planSessionNotice(s, 2 * MIN)!;
		expect(n).toMatchObject({
			title: '#2 · 1 of 3',
			text: 'Then #3 “Bun”',
			clock: 'down',
			at: 10 * MIN
		});
		// when the timer ends the alert for it takes over: this one must not stay behind it
		expect(n.expiresInMs).toBe(8 * MIN + 500);
	});

	it('follows added and removed minutes', () => {
		const s = adjust(begin(), 3 * MIN, 0);
		expect(planSessionNotice(s, 0)!.at).toBe(13 * MIN);
	});

	it('names the last one as the last one', () => {
		let s = begin();
		s = confirmSwitch(tick(s, 10 * MIN), 10 * MIN);
		s = confirmSwitch(tick(s, 30 * MIN), 30 * MIN);
		expect(planSessionNotice(s, 31 * MIN)).toMatchObject({
			title: '#4 · 3 of 3',
			text: 'The last one'
		});
	});

	it('shows how much is left, without a ticking clock, while paused', () => {
		const s = pause(begin(), 4 * MIN);
		const n = planSessionNotice(s, 5 * MIN)!;
		expect(n).toMatchObject({ title: 'Paused · #2', text: '06:00 left · 1 of 3', clock: 'none' });
		expect(n.expiresInMs).toBe(NOTICE_LINGER_MS);
	});

	it('counts up while waiting to switch, with the swap to do', () => {
		const s = tick(begin(), 10 * MIN);
		expect(planSessionNotice(s, 12 * MIN)).toMatchObject({
			title: 'Time to switch ♡',
			text: 'Swap to #3 “Bun”',
			clock: 'up',
			at: 10 * MIN,
			expiresInMs: NOTICE_LINGER_MS
		});
	});

	it('counts up from the start while waiting for Ready', () => {
		const s = getReady(begin());
		expect(planSessionNotice(s, MIN)).toMatchObject({
			title: "Let's begin ♡",
			text: 'Bring in #2',
			clock: 'up',
			at: 0
		});
		expect(planSessionNotice(ready(s, MIN), 2 * MIN)!.clock).toBe('down');
	});

	it('is nothing when there is no session, it is over, or the timer already ended', () => {
		expect(planSessionNotice(null, 0)).toBeNull();
		const last = startSession([steps[0]], 'morning', '2026-01-01', 0);
		expect(planSessionNotice(tick(last, 10 * MIN), 11 * MIN)).toBeNull(); // finished
		expect(planSessionNotice(begin(), 10 * MIN + 1)).toBeNull(); // about to move on
	});
});

function fake() {
	const calls: string[] = [];
	const plugin: SessionNoticePlugin = {
		show: vi.fn(async (n: SessionNotice) => void calls.push('show:' + n.title)),
		hide: vi.fn(async () => void calls.push('hide'))
	};
	return { plugin, calls };
}

afterEach(() => setSessionNoticeForTests(undefined));

describe('talking to the native plugin', () => {
	it('is not there in a browser, and does nothing', async () => {
		expect(sessionNoticeAvailable()).toBe(false);
		await showSessionNotice(planSessionNotice(begin(), 0));
		await hideSessionNotice();
	});

	it('shows a notice, and takes it down for null', async () => {
		const { plugin, calls } = fake();
		setSessionNoticeForTests(plugin);
		await showSessionNotice(planSessionNotice(begin(), 0));
		await showSessionNotice(null);
		expect(calls).toEqual(['show:#2 · 1 of 3', 'hide']);
	});

	it('keeps things in order and carries on after a failure', async () => {
		const calls: string[] = [];
		const slow: SessionNoticePlugin = {
			show: async () => {
				await new Promise((r) => setTimeout(r, 20));
				calls.push('show');
			},
			hide: vi
				.fn()
				.mockRejectedValueOnce(new Error('boom'))
				.mockImplementation(async () => void calls.push('hide'))
		};
		setSessionNoticeForTests(slow);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		void showSessionNotice(planSessionNotice(begin(), 0));
		void hideSessionNotice(); // fails
		await hideSessionNotice();
		expect(calls).toEqual(['show', 'hide']); // the hide came after the show, and the failure did not stop it
	});
});

describe('JavaScript, Java and the manifest agree', () => {
	const root = new URL('../../', import.meta.url);
	const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
	const java = read(
		'android/app/src/main/java/com/simonekittenz/dilationtimer/SessionNoticePlugin.java'
	);
	const js = read('src/lib/sessionNotice.ts');

	it('use the same plugin name and methods', () => {
		expect(js).toContain("registerPlugin<SessionNoticePlugin>('SessionNotice')");
		expect(java).toContain('@CapacitorPlugin(name = "SessionNotice")');
		for (const m of ['show', 'hide']) {
			expect(java).toMatch(new RegExp(`@PluginMethod\\s+public void ${m}\\(PluginCall call\\)`));
		}
	});

	it('read the same fields the JavaScript sends', () => {
		for (const field of ['title', 'text', 'clock', 'at', 'expiresInMs']) {
			expect(java, field).toContain(`call.get`);
			expect(java, field).toContain(`"${field}"`);
		}
	});

	it('is registered, with its permission and out of the way of the alert ids', () => {
		expect(
			read('android/app/src/main/java/com/simonekittenz/dilationtimer/MainActivity.java')
		).toContain('registerPlugin(SessionNoticePlugin.class)');
		expect(read('android/app/src/main/AndroidManifest.xml')).toContain(
			'android.permission.POST_PROMOTED_NOTIFICATIONS'
		);
		expect(java).toContain('NOTICE_ID = 40_900');
	});

	it('is quiet, ongoing and counts with the system clock', () => {
		expect(java).toContain('IMPORTANCE_LOW');
		expect(java).toContain('.setOngoing(true)');
		expect(java).toContain('.setUsesChronometer(true)');
		expect(java).toContain('.setChronometerCountDown(');
		expect(java).toContain('setTimeoutAfter');
		expect(java).toContain('android.requestPromotedOngoing');
	});
});
