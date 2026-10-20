import { describe, expect, it } from 'vitest';
import { pageOnly, readDoNotTrack, shouldTrack } from './analytics';

describe('when the website counts a visit', () => {
	const web = { native: false, dev: false, doNotTrack: false };

	it('counts an ordinary visit to the website', () => {
		expect(shouldTrack(web)).toBe(true);
	});

	it('never counts the Android/iPhone app or the Play build', () => {
		expect(shouldTrack({ ...web, native: true })).toBe(false);
	});

	it('never counts development', () => {
		expect(shouldTrack({ ...web, dev: true })).toBe(false);
	});

	it('respects Do Not Track and Global Privacy Control', () => {
		expect(shouldTrack({ ...web, doNotTrack: true })).toBe(false);
		expect(readDoNotTrack({ doNotTrack: '1' })).toBe(true);
		expect(readDoNotTrack({ doNotTrack: 'yes' })).toBe(true);
		expect(readDoNotTrack({ globalPrivacyControl: true })).toBe(true);
		expect(readDoNotTrack({ doNotTrack: '0' })).toBe(false);
		expect(readDoNotTrack({ doNotTrack: null })).toBe(false);
		expect(readDoNotTrack({})).toBe(false);
		expect(readDoNotTrack(undefined)).toBe(false);
	});
});

describe('pageOnly: only the page is ever sent', () => {
	it('drops query strings and fragments', () => {
		expect(pageOnly('https://dilation-timer.vercel.app/history?x=1#top')).toBe(
			'https://dilation-timer.vercel.app/history'
		);
		expect(pageOnly('/settings?surgery=2026-10-01')).toBe('/settings');
		expect(pageOnly('/custom#review')).toBe('/custom');
	});

	it('leaves plain pages alone', () => {
		expect(pageOnly('https://dilation-timer.vercel.app/')).toBe(
			'https://dilation-timer.vercel.app/'
		);
		expect(pageOnly('/privacy')).toBe('/privacy');
	});
});
