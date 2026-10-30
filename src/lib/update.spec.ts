import { describe, expect, it, vi } from 'vitest';
import {
	GITHUB_LATEST_URL,
	RELEASE_URL,
	SITE,
	compareVersions,
	fetchLatest,
	isNewer,
	parseGithubRelease,
	parseRelease
} from './update';

const APK =
	'https://github.com/simonekittenz/dilation-timer/releases/download/v1.4/Dilation-timer.apk';
const github = {
	tag_name: 'v1.4',
	draft: false,
	prerelease: false,
	assets: [{ name: 'Dilation-timer.apk', browser_download_url: APK }]
};
const site = {
	android: {
		file: '/downloads/Dilation-timer.apk',
		version: '1.3',
		versionCode: 4,
		sizeBytes: 1,
		sha256: 'x',
		builtAt: 'y'
	}
};

describe('parseGithubRelease', () => {
	it('reads the latest release and links to its app file', () => {
		expect(parseGithubRelease(github)).toEqual({ version: '1.4', downloadUrl: APK });
	});

	it('finds the app among other files', () => {
		const assets = [
			{ name: 'notes.txt', browser_download_url: 'https://github.com/x/y/notes.txt' },
			...github.assets
		];
		expect(parseGithubRelease({ ...github, assets })?.downloadUrl).toBe(APK);
	});

	it('rejects anything that is not a normal release of ours', () => {
		const bad = [
			null,
			undefined,
			'text',
			{},
			{ ...github, tag_name: 'latest' },
			{ ...github, tag_name: 4 },
			{ ...github, draft: true },
			{ ...github, prerelease: true },
			{ ...github, assets: [] },
			{ ...github, assets: 'none' },
			{ ...github, assets: [{ name: 'other.apk', browser_download_url: APK }] }
		];
		for (const b of bad) expect(parseGithubRelease(b)).toBeNull();
	});

	it('never links anywhere but the app file of a release of this project', () => {
		for (const url of [
			'https://evil.example/Dilation-timer.apk',
			'https://github.com/someone-else/dilation-timer/releases/download/v1.4/Dilation-timer.apk',
			'https://github.com/simonekittenz/dilation-timer/releases/download/v1.4/other.apk',
			'https://github.com.evil.example/simonekittenz/dilation-timer/releases/download/v1.4/Dilation-timer.apk',
			'http://github.com/simonekittenz/dilation-timer/releases/download/v1.4/Dilation-timer.apk',
			'javascript:alert(1)'
		]) {
			const assets = [{ name: 'Dilation-timer.apk', browser_download_url: url }];
			expect(parseGithubRelease({ ...github, assets })).toBeNull();
		}
	});
});

describe("parseRelease (the website's copy)", () => {
	it('reads the published release and builds the download link on our own site', () => {
		expect(parseRelease(site)).toEqual({
			version: '1.3',
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
			{ android: { ...site.android, versionCode: '5' } },
			{ android: { ...site.android, versionCode: 0 } },
			{ android: { ...site.android, version: 4 } },
			{ android: { ...site.android, version: 'latest' } },
			{ android: { ...site.android, file: undefined } }
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
			expect(parseRelease({ android: { ...site.android, file } })).toBeNull();
	});
});

describe('versions', () => {
	it('compares number by number, not as text', () => {
		expect(compareVersions('1.10', '1.9')).toBeGreaterThan(0);
		expect(compareVersions('1.9', '1.10')).toBeLessThan(0);
		expect(compareVersions('2.0', '1.99')).toBeGreaterThan(0);
		expect(compareVersions('1.8', '1.8')).toBe(0);
		expect(compareVersions('1.8', '1.8.0')).toBe(0);
		expect(compareVersions('1.8.1', '1.8')).toBeGreaterThan(0);
	});

	it('only a higher version is newer', () => {
		expect(isNewer('1.8', '1.9')).toBe(true);
		expect(isNewer('1.8', '1.8')).toBe(false);
		expect(isNewer('1.8', '1.7')).toBe(false);
		expect(isNewer('1.9', '1.10')).toBe(true);
	});
});

describe('fetchLatest', () => {
	/** Answers by address; anything not listed fails like an error page. */
	function answers(map: Record<string, unknown>) {
		return vi.fn(async (url: string) => {
			const key = Object.keys(map).find((k) => url.startsWith(k));
			return {
				ok: key !== undefined,
				json: async () => (key === undefined ? null : map[key])
			} as unknown as Response;
		});
	}

	it('asks GitHub first, without using a cached answer', async () => {
		const f = answers({ [GITHUB_LATEST_URL]: github, [RELEASE_URL]: site });
		const latest = await fetchLatest(f as unknown as typeof fetch);
		expect(latest).toEqual({ version: '1.4', downloadUrl: APK });
		expect(f).toHaveBeenCalledTimes(1);
		const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(GITHUB_LATEST_URL);
		expect(init.cache).toBe('no-store');
	});

	it("falls back to the website's copy when GitHub can't be used", async () => {
		const f = answers({ [RELEASE_URL]: site });
		expect(await fetchLatest(f as unknown as typeof fetch)).toEqual({
			version: '1.3',
			downloadUrl: `${SITE}/downloads/Dilation-timer.apk`
		});
		expect(f).toHaveBeenCalledTimes(2);
		const odd = answers({ [GITHUB_LATEST_URL]: { nope: 1 }, [RELEASE_URL]: site });
		expect((await fetchLatest(odd as never))?.version).toBe('1.3');
	});

	it('gives null instead of failing when offline, on an error page, or on nonsense', async () => {
		expect(await fetchLatest(vi.fn().mockRejectedValue(new Error('offline')) as never)).toBeNull();
		expect(await fetchLatest(answers({}) as never)).toBeNull();
		expect(
			await fetchLatest(answers({ [GITHUB_LATEST_URL]: {}, [RELEASE_URL]: { nope: 1 } }) as never)
		).toBeNull();
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
