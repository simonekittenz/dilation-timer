/** Where the published app lives. */
export const SITE = 'https://dilation-timer.vercel.app';
/** The newest GitHub release: the first place the installed Android app asks about a new version. */
export const GITHUB_LATEST_URL =
	'https://api.github.com/repos/simonekittenz/dilation-timer/releases/latest';
/** The same information, published with the website. Used when GitHub can't be asked. */
export const RELEASE_URL = `${SITE}/release.json`;

export interface LatestRelease {
	version: string;
	downloadUrl: string;
}

/** Only ever links to the app file of a release of this project, whatever the answer says. */
const GITHUB_APK =
	/^https:\/\/github\.com\/simonekittenz\/dilation-timer\/releases\/download\/v\d+(\.\d+)+\/Dilation-timer\.apk$/;
/** Or, from the website's list, an app file in its downloads folder (that address forwards to GitHub). */
const SITE_APK = /^\/downloads\/[A-Za-z0-9._-]+\.apk$/;
const VERSION = /^\d+(\.\d+)+$/;

/** Reads GitHub's "latest release" answer, or returns null if it isn't what we expect. */
export function parseGithubRelease(data: unknown): LatestRelease | null {
	const release = data as {
		tag_name?: unknown;
		draft?: unknown;
		prerelease?: unknown;
		assets?: unknown;
	} | null;
	if (!release || typeof release !== 'object') return null;
	if (release.draft === true || release.prerelease === true) return null;
	const version = typeof release.tag_name === 'string' ? release.tag_name.replace(/^v/, '') : '';
	if (!VERSION.test(version) || !Array.isArray(release.assets)) return null;
	for (const asset of release.assets) {
		const { name, browser_download_url: url } = (asset ?? {}) as Record<string, unknown>;
		if (name === 'Dilation-timer.apk' && typeof url === 'string' && GITHUB_APK.test(url)) {
			return { version, downloadUrl: url };
		}
	}
	return null;
}

/** Reads the release info published with the website, or returns null if it isn't what we expect. */
export function parseRelease(data: unknown): LatestRelease | null {
	const android = (data as { android?: Record<string, unknown> } | null)?.android;
	if (!android || typeof android !== 'object') return null;
	const { version, versionCode, file } = android;
	if (typeof version !== 'string' || !/^\d+\.\d+/.test(version)) return null;
	if (typeof versionCode !== 'number' || !Number.isInteger(versionCode) || versionCode < 1)
		return null;
	if (typeof file !== 'string' || !SITE_APK.test(file)) return null;
	return { version, downloadUrl: SITE + file };
}

/** Negative, zero or positive as version `a` is older than, the same as, or newer than `b`. */
export function compareVersions(a: string, b: string): number {
	const x = a.split('.').map(Number);
	const y = b.split('.').map(Number);
	for (let i = 0; i < Math.max(x.length, y.length); i++) {
		const d = (x[i] ?? 0) - (y[i] ?? 0);
		if (d !== 0) return d;
	}
	return 0;
}

export function isNewer(installed: string, latest: string): boolean {
	return compareVersions(latest, installed) > 0;
}

async function getJson(url: string, fetchFn: typeof fetch, timeoutMs: number): Promise<unknown> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchFn(url, { cache: 'no-store', signal: controller.signal });
		return response.ok ? await response.json() : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Asks GitHub for the latest release and, if that doesn't work (offline, rate limited, odd answer),
 * the website's copy of the same information. Resolves to null when neither gives a usable answer.
 */
export async function fetchLatest(
	fetchFn: typeof fetch = fetch,
	timeoutMs = 8000
): Promise<LatestRelease | null> {
	const fromGithub = parseGithubRelease(await getJson(GITHUB_LATEST_URL, fetchFn, timeoutMs));
	if (fromGithub) return fromGithub;
	return parseRelease(await getJson(`${RELEASE_URL}?t=${Date.now()}`, fetchFn, timeoutMs));
}
