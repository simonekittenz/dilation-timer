import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { routePath } from './route';

describe('routePath', () => {
	it('is "/" for Today, however the address spells it', () => {
		expect(routePath('/')).toBe('/');
		expect(routePath('')).toBe('/'); // the iPhone app starts at capacitor://localhost, with no slash
		expect(routePath('/index.html')).toBe('/');
	});

	it('has no slash at the end for the other pages', () => {
		expect(routePath('/settings')).toBe('/settings');
		expect(routePath('/settings/')).toBe('/settings');
		expect(routePath('/history/stats')).toBe('/history/stats');
		expect(routePath('/welcome/')).toBe('/welcome');
	});

	it('is what the browser really reports for the addresses the apps use', () => {
		// the cause of the menu showing during a session on iPhone
		expect(new URL('capacitor://localhost').pathname).toBe('');
		expect(routePath(new URL('capacitor://localhost').pathname)).toBe('/');
		expect(routePath(new URL('https://localhost').pathname)).toBe('/');
	});
});

describe('screens that care which page they are on', () => {
	const routes = new URL('../routes/', import.meta.url);
	const files = (dir: URL): URL[] =>
		readdirSync(dir).flatMap((name) => {
			const url = new URL(name, dir);
			return statSync(url).isDirectory() ? files(new URL(`${name}/`, dir)) : [url];
		});

	it('never compare the raw path, only routePath(...)', () => {
		for (const file of files(routes).filter((f) => f.pathname.endsWith('.svelte'))) {
			const source = readFileSync(file, 'utf8');
			const raw = [...source.matchAll(/page\.url\.pathname/g)].length;
			const wrapped = [...source.matchAll(/routePath\(page\.url\.pathname\)/g)].length;
			expect(raw, file.pathname).toBe(wrapped);
		}
	});

	it('hide the menu on Today during a session', () => {
		const layout = readFileSync(new URL('+layout.svelte', routes), 'utf8');
		expect(layout).toContain("const focus = $derived(path === '/' && !!store.active)");
	});
});
