import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const timer = readFileSync(new URL('./Timer.svelte', import.meta.url), 'utf8');

describe('the all-done screen closes by itself', () => {
	it('after ten seconds, with the Yay button filling up as the wait', () => {
		expect(timer).toContain('AUTO_CLOSE_MS = 10_000');
		expect(timer).toContain('store.acknowledgeFinish()');
		expect(timer).toContain('data-testid="yay"');
		expect(timer).toContain('animation: autoclose');
	});

	it('but waits to be tapped when there is a conquered dilator to read about', () => {
		expect(timer).toContain("s.phase === 'finished' && conquered.length === 0");
	});

	it('stops when the screen is touched or the app is left, and starts over on coming back', () => {
		expect(timer).toContain('onpointerdown={() => (autoClosing = false)}');
		expect(timer).toContain("document.addEventListener('visibilitychange', onVisible)");
	});

	it('does not close when More statistics was chosen: the session is filed and the page opens', () => {
		const more = timer.slice(timer.indexOf('function moreStatistics'));
		expect(more.slice(0, 200)).toContain("goto('/history/stats')");
	});
});
