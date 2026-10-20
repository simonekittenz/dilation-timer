import { watchAppState } from './notifications';
import { nativePlatform } from './platform';
import { fetchLatest, isNewer, type LatestRelease } from './update';
import { APP_VERSION_CODE } from './version';

const DISMISSED_KEY = 'dilation-timer:update-dismissed';
/** Don't ask the website more often than this when the app is merely switched back to. */
const MIN_GAP_MS = 30 * 60_000;

/** The Android app noticing that a newer version has been published. The web version updates itself. */
class Updates {
	latest = $state<LatestRelease | null>(null);
	dismissedCode = $state(0);
	private lastChecked = 0;
	private started = false;

	/** There is a newer app, and it is the kind of app that can be updated by downloading. */
	get available(): LatestRelease | null {
		return this.latest && isNewer(APP_VERSION_CODE, this.latest.versionCode) ? this.latest : null;
	}

	/** Available and not yet put off with "Later". */
	get showBanner(): boolean {
		const a = this.available;
		return !!a && a.versionCode > this.dismissedCode;
	}

	start() {
		// The Google Play build (npm run aab) is updated by Play itself: no notice, and no asking the website.
		if (import.meta.env.VITE_PLAY === '1') return;
		if (this.started || nativePlatform() !== 'android') return;
		this.started = true;
		try {
			this.dismissedCode = Number(localStorage.getItem(DISMISSED_KEY)) || 0;
		} catch {
			// private mode: banner just comes back next time
		}
		void this.check();
		void watchAppState((isActive) => {
			if (isActive && Date.now() - this.lastChecked >= MIN_GAP_MS) void this.check();
		});
	}

	async check() {
		this.lastChecked = Date.now();
		const latest = await fetchLatest();
		if (latest) this.latest = latest;
	}

	dismiss() {
		const a = this.available;
		if (!a) return;
		this.dismissedCode = a.versionCode;
		try {
			localStorage.setItem(DISMISSED_KEY, String(a.versionCode));
		} catch {
			// ignore
		}
	}
}

export const updates = new Updates();
