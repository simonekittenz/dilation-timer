import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../routes/history/stats/+page.svelte');

describe('the statistics page', () => {
	it('leads with the time with each dilator, then the days, then the streak, and swaps further down', () => {
		const at = (id: string) => page.indexOf(`data-testid="${id}"`);
		const order = [
			'stats-holds',
			'stats-days',
			'stats-streak',
			'stats-total',
			'stats-swaps',
			'stats-ready'
		];
		for (const id of order) expect(at(id), id).toBeGreaterThan(-1);
		expect(order.map(at)).toEqual([...order.map(at)].sort((a, b) => a - b));
	});

	it('shows the current and the longest streak, only for people who have the streak switched on', () => {
		expect(page).toContain('store.settings.streak !== false');
		expect(page).toContain('streak.current');
		expect(page).toContain('streak.best');
	});

	it('has the same title row as the Settings pages: a round back button, then the title', () => {
		expect(page).toContain('class="back-btn" href="/history"');
		expect(page).toContain('>‹</a>');
		expect(page).not.toContain('← History');
		// the look is copied from the Settings pages, so check the two have not drifted apart
		const settings = read('../routes/settings/settings.css');
		for (const rule of ['width: 2.7rem;', 'border: 2px solid var(--accent);', 'font-size: 2rem;']) {
			expect(settings).toContain(rule);
			expect(page).toContain(rule);
		}
	});

	it('has no chart emoji anywhere in the app', () => {
		for (const file of [
			'../routes/history/stats/+page.svelte',
			'../routes/history/+page.svelte',
			'./Timer.svelte'
		]) {
			expect(read(file), file).not.toContain('📊');
		}
	});
});

describe('the history page', () => {
	const history = read('../routes/history/+page.svelte');

	it('shows the swap time next to each dilator after the first, which is the swap to it', () => {
		expect(history).toContain('i > 0 && st.switchSeconds !== undefined');
		expect(history).toContain('(Swap time: {describeSwitch(st.switchSeconds * 1000)})');
	});

	it('keeps the time with the dilator itself free of the swap', () => {
		expect(history).toContain('{mins(holdSeconds(e.steps, i))}');
	});
});
