/** Where the published app lives; the installed Android app asks it whether a newer one exists. */
export const SITE = 'https://dilation-timer.vercel.app';
export const RELEASE_URL = `${SITE}/release.json`;

export interface LatestRelease {
	version: string;
	versionCode: number;
	downloadUrl: string;
}

/** Only ever links to an app file on our own site, whatever the answer says. */
const APK_PATH = /^\/downloads\/[A-Za-z0-9._-]+\.apk$/;

/** Reads the published release info, or returns null if it isn't what we expect. */
export function parseRelease(data: unknown): LatestRelease | null {
	const android = (data as { android?: Record<string, unknown> } | null)?.android;
	if (!android || typeof android !== 'object') return null;
	const { version, versionCode, file } = android;
	if (typeof version !== 'string' || !/^\d+\.\d+/.test(version)) return null;
	if (typeof versionCode !== 'number' || !Number.isInteger(versionCode) || versionCode < 1)
		return null;
	if (typeof file !== 'string' || !APK_PATH.test(file)) return null;
	return { version, versionCode, downloadUrl: SITE + file };
}

export function isNewer(installedCode: number, latestCode: number): boolean {
	return latestCode > installedCode;
}

/** Asks the website for the latest release. Resolves to null when offline or the answer is odd. */
export async function fetchLatest(
	fetchFn: typeof fetch = fetch,
	timeoutMs = 8000
): Promise<LatestRelease | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchFn(`${RELEASE_URL}?t=${Date.now()}`, {
			cache: 'no-store',
			signal: controller.signal
		});
		if (!response.ok) return null;
		return parseRelease(await response.json());
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}
