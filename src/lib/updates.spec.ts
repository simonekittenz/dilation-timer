import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// updates.svelte.ts is the Android app asking the website whether a newer version exists. The
// Google Play build of the app must never do that: Play updates it, and the notice would point
// at a downloadable file that Play users have no use for.
describe('the self-update check', () => {
	let fetchSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetModules();
		fetchSpy = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
		vi.stubGlobal('fetch', fetchSpy);
		vi.stubGlobal('window', {
			Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true }
		});
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it('asks the website in the normal Android app', async () => {
		vi.stubEnv('VITE_PLAY', '0');
		const { updates } = await import('./updates.svelte');
		updates.start();
		await Promise.resolve();
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(String(fetchSpy.mock.calls[0][0])).toContain('/release.json');
	});

	it('never asks, and never shows a notice, in the Google Play build', async () => {
		vi.stubEnv('VITE_PLAY', '1');
		const { updates } = await import('./updates.svelte');
		updates.start();
		await Promise.resolve();
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(updates.available).toBeNull();
		expect(updates.showBanner).toBe(false);
	});
});
