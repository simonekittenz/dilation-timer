import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const here = new URL('./', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, here), 'utf8');

function svelteFiles(dir: URL): URL[] {
	return readdirSync(dir).flatMap((name) => {
		const url = new URL(name + (statSync(new URL(name, dir)).isDirectory() ? '/' : ''), dir);
		return name.endsWith('.svelte') ? [url] : url.pathname.endsWith('/') ? svelteFiles(url) : [];
	});
}

describe('every page with a way back has the same round back button', () => {
	it('is the round ‹ button on Settings, Statistics and Custom session', () => {
		for (const file of [
			'../routes/settings/+layout.svelte',
			'../routes/history/stats/+page.svelte',
			'../routes/custom/+page.svelte'
		]) {
			const source = read(file);
			expect(source, file).toContain('back-btn');
			expect(source, file).toContain('‹');
		}
		// the look is the one from the Settings pages
		const settings = read('../routes/settings/settings.css');
		for (const file of ['../routes/history/stats/+page.svelte', '../routes/custom/+page.svelte']) {
			for (const rule of [
				'width: 2.7rem;',
				'border: 2px solid var(--accent);',
				'font-size: 2rem;'
			]) {
				expect(settings).toContain(rule);
				expect(read(file), file).toContain(rule);
			}
		}
	});

	it('has no text arrows as back links any more', () => {
		for (const file of svelteFiles(new URL('../', here))) {
			expect(readFileSync(file, 'utf8'), file.pathname).not.toMatch(/>\s*←/);
		}
	});
});
