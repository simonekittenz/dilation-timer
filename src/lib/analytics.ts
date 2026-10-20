/**
 * Vercel Web Analytics: anonymous page-view counts for the website (no cookies, no accounts).
 *
 * It runs on the website only. The Android and iPhone apps and the Google Play build never load it,
 * so what the privacy page says about them stays true. A browser that sends "Do Not Track" or Global
 * Privacy Control is respected too.
 */

export interface TrackingContext {
	/** Inside the iOS/Android app wrapper. */
	native: boolean;
	/** `npm run dev`. */
	dev: boolean;
	doNotTrack: boolean;
}

export function shouldTrack(c: TrackingContext): boolean {
	return !c.native && !c.dev && !c.doNotTrack;
}

/** The browser asks not to be tracked (Do Not Track, or Global Privacy Control). */
export function readDoNotTrack(
	nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean } | undefined
): boolean {
	if (!nav) return false;
	return nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || nav.globalPrivacyControl === true;
}

/** Only the page, never a query string or a #fragment, goes to the analytics. */
export function pageOnly(url: string): string {
	try {
		const u = new URL(url, 'https://x.invalid');
		const origin = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? u.origin : '';
		return `${origin}${u.pathname}`;
	} catch {
		return url.split(/[?#]/)[0];
	}
}

let started = false;

/** Starts the analytics once, if this visit is one that may be counted. */
export async function startAnalytics(): Promise<void> {
	if (started || typeof window === 'undefined') return;
	const native =
		import.meta.env.VITE_NATIVE === '1' ||
		!!(
			window as { Capacitor?: { isNativePlatform?: () => boolean } }
		).Capacitor?.isNativePlatform?.();
	if (
		!shouldTrack({
			native,
			dev: import.meta.env.DEV,
			doNotTrack: readDoNotTrack(navigator as never)
		})
	)
		return;
	started = true;
	try {
		const { injectAnalytics } = await import('@vercel/analytics/sveltekit');
		injectAnalytics({
			mode: 'production',
			beforeSend: (event) => ({ ...event, url: pageOnly(event.url) })
		});
	} catch {
		// analytics is never worth breaking the app for
	}
}
