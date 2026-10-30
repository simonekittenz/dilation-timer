import { watchAppState } from './notifications';
import { nativePlatform } from './platform';
import { compareVersions, fetchLatest, isNewer, type LatestRelease } from './update';
import { APP_VERSION } from './version';

const DISMISSED_KEY = 'dilation-timer:update-dismissed-version';
/** Don't ask the website more often than this when the app is merely switched back to. */
const MIN_GAP_MS = 30 * 60_000;

/** The Android app noticing that a newer version has been published. The web version updates itself. */
class Updates {
	latest = $state<LatestRelease | null>(null);
	dismissedVersion = $state('');
	private lastChecked = 0;
	private started = false;

	/** There is a newer app, and it is the kind of app that can be updated by downloading. */
	get available(): LatestRelease | null {
		return this.latest && isNewer(APP_VERSION, this.latest.version) ? this.latest : null;
	}

	/** Available and not yet put off with "Later". */
	get showBanner(): boolean {
		const a = this.available;
		return !!a && compareVersions(a.version, this.dismissedVersion || '0') > 0;
	}

	start() {
		// The Google Play build (npm run aab) is updated by Play itself: no notice, and no asking the website.
		if (import.meta.env.VITE_PLAY === '1') return;
		if (this.started || nativePlatform() !== 'android') return;
		this.started = true;
		try {
			const saved = localStorage.getItem(DISMISSED_KEY) ?? '';
			this.dismissedVersion = /^\d+(\.\d+)+$/.test(saved) ? saved : '';
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
		this.dismissedVersion = a.version;
		try {
			localStorage.setItem(DISMISSED_KEY, a.version);
		} catch {
			// ignore
		}
	}
}

export const updates = new Updates();
