type CapacitorWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean } };

/** True when running inside the iOS/Android app wrapper rather than a browser. */
export function isNative(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return !!(window as CapacitorWindow).Capacitor?.isNativePlatform?.();
	} catch {
		return false;
	}
}

/** "android", "ios" or "web", as reported by Capacitor's own bridge. */
export function nativePlatform(): 'android' | 'ios' | 'web' {
	if (typeof window === 'undefined') return 'web';
	try {
		const p = (
			window as CapacitorWindow & { Capacitor?: { getPlatform?: () => string } }
		).Capacitor?.getPlatform?.();
		return p === 'android' || p === 'ios' ? p : 'web';
	} catch {
		return 'web';
	}
}
