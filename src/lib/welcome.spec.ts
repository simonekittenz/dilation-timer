import { describe, expect, it } from 'vitest';
import { describeDownload, detectPlatform, shouldShowWelcome } from './welcome';

const UA = {
	pixel:
		'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
	iphone:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
	ipadAsMac:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
	mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
	windows:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
};

describe('detectPlatform', () => {
	it('recognises phones, tablets and computers', () => {
		expect(detectPlatform(UA.pixel)).toBe('android');
		expect(detectPlatform(UA.iphone)).toBe('ios');
		expect(detectPlatform(UA.ipadAsMac, 5)).toBe('ios'); // iPad pretending to be a Mac
		expect(detectPlatform(UA.mac, 0)).toBe('desktop'); // a real Mac has no touch screen
		expect(detectPlatform(UA.windows)).toBe('desktop');
		expect(detectPlatform('')).toBe('desktop');
	});
});

describe('shouldShowWelcome', () => {
	const fresh = { native: false, standalone: false, hasData: false, seen: false };

	it('shows it to a brand-new visitor on the website', () => {
		expect(shouldShowWelcome(fresh)).toBe(true);
	});

	it('never bothers anyone who is already set up or has chosen', () => {
		expect(shouldShowWelcome({ ...fresh, hasData: true })).toBe(false); // existing users
		expect(shouldShowWelcome({ ...fresh, seen: true })).toBe(false); // chose once
		expect(shouldShowWelcome({ ...fresh, standalone: true })).toBe(false); // installed web app
		expect(shouldShowWelcome({ ...fresh, native: true })).toBe(false); // the Android/iOS app
	});
});

describe('describeDownload', () => {
	it('summarises the file in plain words', () => {
		const text = describeDownload(
			{
				file: '/x.apk',
				version: '1.0',
				sizeBytes: 5_700_000,
				sha256: '',
				builtAt: '2026-10-18T10:00:00Z'
			},
			'en-GB'
		);
		expect(text).toBe('5.7 MB · v1.0 · 18 Oct 2026');
	});
});
