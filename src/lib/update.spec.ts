import { describe, expect, it, vi } from 'vitest';
import { fetchLatest, isNewer, parseRelease, RELEASE_URL, SITE } from './update';

const good = {
	android: {
		file: '/downloads/Dilation-timer.apk',
		version: '1.4',
		versionCode: 5,
		sizeBytes: 1,
		sha256: 'x',
		builtAt: 'y'
	}
};

describe('parseRelease', () => {
	it('reads the published release and builds the download link on our own site', () => {
		expect(parseRelease(good)).toEqual({
			version: '1.4',
			versionCode: 5,
			downloadUrl: `${SITE}/downloads/Dilation-timer.apk`
		});
	});

	it('rejects anything that is not what we publish', () => {
		const bad = [
			null,
			undefined,
			'text',
			{},
			{ android: null },
			{ android: { ...good.android, versionCode: '5' } },
			{ android: { ...good.android, versionCode: 0 } },
			{ android: { ...good.android, versionCode: 2.5 } },
			{ android: { ...good.android, version: 4 } },
			{ android: { ...good.android, version: 'latest' } },
			{ android: { ...good.android, file: undefined } }
		];
		for (const b of bad) expect(parseRelease(b)).toBeNull();
	});

	it('never links anywhere but an app file in our downloads folder', () => {
		for (const file of [
			'https://evil.example/app.apk',
			'//evil.example/app.apk',
			'/downloads/../secret.apk',
			'/downloads/app.html',
			'/other/app.apk',
			'/downloads/a b.apk',
			'javascript:alert(1)'
		])
			expect(parseRelease({ android: { ...good.android, file } })).toBeNull();
	});
});

describe('isNewer', () => {
	it('is only true for a higher version', () => {
		expect(isNewer(1, 2)).toBe(true);
		expect(isNewer(2, 2)).toBe(false);
		expect(isNewer(3, 2)).toBe(false);
	});
});

describe('fetchLatest', () => {
	const respond = (body: unknown, ok = true) =>
		vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response);

	it('asks the website without using a cached answer', async () => {
		const f = respond(good);
		const latest = await fetchLatest(f as unknown as typeof fetch);
		expect(latest?.versionCode).toBe(5);
		const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
		expect(url.startsWith(RELEASE_URL)).toBe(true);
		expect(init.cache).toBe('no-store');
	});

	it('gives null instead of failing when offline, on an error page, or on nonsense', async () => {
		expect(await fetchLatest(vi.fn().mockRejectedValue(new Error('offline')) as never)).toBeNull();
		expect(await fetchLatest(respond(good, false) as never)).toBeNull();
		expect(await fetchLatest(respond({ nope: 1 }) as never)).toBeNull();
		const notJson = vi.fn(async () => ({
			ok: true,
			json: async () => {
				throw new Error('bad json');
			}
		}));
		expect(await fetchLatest(notJson as never)).toBeNull();
	});

	it('gives up on a request that never answers', async () => {
		const hang = vi.fn(
			(_u: string, init: RequestInit) =>
				new Promise((_, reject) =>
					init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
				)
		);
		expect(await fetchLatest(hang as never, 20)).toBeNull();
	});
});
