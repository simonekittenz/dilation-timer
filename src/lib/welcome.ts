export type Platform = 'android' | 'ios' | 'desktop';

/** Which kind of device this is, from the browser's own description of itself. */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
	if (/android/i.test(userAgent)) return 'android';
	if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
	// iPadOS pretends to be a Mac; a "Mac" with a touch screen is an iPad
	if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
	return 'desktop';
}

export interface WelcomeContext {
	/** Running inside the iOS/Android app. */
	native: boolean;
	/** Running as a web app installed to the home screen. */
	standalone: boolean;
	/** There is already saved history or settings on this device. */
	hasData: boolean;
	/** They have already picked an option on the start page. */
	seen: boolean;
}

/**
 * The start page is for brand-new visitors on the website. Anyone who already uses the app, has
 * installed it, or has made a choice once is never sent there again.
 */
export function shouldShowWelcome(c: WelcomeContext): boolean {
	return !c.native && !c.standalone && !c.hasData && !c.seen;
}

const KEY = 'dilation-timer:welcome';

export function hasSeenWelcome(): boolean {
	try {
		return localStorage.getItem(KEY) !== null;
	} catch {
		return false;
	}
}

export function markWelcomeSeen(choice: 'web' | 'android') {
	try {
		localStorage.setItem(KEY, choice);
	} catch {
		// private mode: they'll just see the page again
	}
}

/** Installed to the home screen (Android/desktop `display-mode`, or iOS's older `navigator.standalone`). */
export function isStandalonePwa(): boolean {
	if (typeof window === 'undefined') return false;
	const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
	return iosStandalone || !!window.matchMedia?.('(display-mode: standalone)').matches;
}

export interface AndroidRelease {
	file: string;
	version: string;
	sizeBytes: number;
	sha256: string;
	builtAt: string;
}

/** "5.7 MB · v1.0 · 18 Oct 2026" */
/** This app's page on Google Play, once it has been published. */
export const PLAY_STORE_URL =
	'https://play.google.com/store/apps/details?id=com.simonekittenz.dilationtimer';

/**
 * The Play Store address to offer, or null while the app isn't there yet. It is set by adding
 * `"playUrl"` to the android entry of appRelease.json; anything but this app's own Play page is
 * ignored, so a typo can't send people somewhere else.
 */
export function playStoreUrl(release: object): string | null {
	const url = (release as { playUrl?: unknown }).playUrl;
	return typeof url === 'string' && url.startsWith(PLAY_STORE_URL) ? url : null;
}

export function describeDownload(r: AndroidRelease, locale?: string): string {
	const mb = `${(r.sizeBytes / 1e6).toFixed(1)} MB`;
	const date = new Date(r.builtAt).toLocaleDateString(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
	return `${mb} · v${r.version} · ${date}`;
}
