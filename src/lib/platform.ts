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
