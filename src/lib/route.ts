/**
 * The page path as the app's screens know it: "/" for Today, and no slash at the end for the others.
 *
 * Needed because the iPhone app starts at `capacitor://localhost` (no slash), and for an address like that
 * the browser reports an empty path, not "/". Until the first tap inside the app, "am I on Today?" would
 * be wrong, and the bottom menu showed up during a session. (Android's address is https://localhost, which
 * has the slash.)
 */
export function routePath(pathname: string): string {
	const trimmed = pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '');
	return trimmed === '' ? '/' : trimmed;
}
