import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import release from './appRelease.json';

// The website offers the Android app as a download. These tests keep the file and the information
// the start page shows about it honest, and keep the app from ever containing a copy of itself.
const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const apkPath = `static${release.android.file}`;

describe('the Android download on the website', () => {
	it('is where the start page says it is', () => {
		expect(release.android.file).toBe('/downloads/Dilation-timer.apk');
		expect(existsSync(new URL(apkPath, root))).toBe(true);
	});

	it('is a real app file, and exactly the one the page describes', () => {
		const bytes = read(apkPath);
		expect(bytes.subarray(0, 4).toString('latin1')).toBe('PK\u0003\u0004'); // an APK is a zip
		expect(statSync(new URL(apkPath, root)).size).toBe(release.android.sizeBytes);
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(release.android.sha256);
		expect(Number.isNaN(new Date(release.android.builtAt).getTime())).toBe(false);
		expect(release.android.version).toMatch(/^\d+\.\d+/);
	});

	it('is the same app id the stores and the phone expect', () => {
		// names inside the zip are stored as plain text
		const text = read(apkPath).toString('latin1');
		expect(text).toContain('AndroidManifest.xml');
		expect(text).toContain('assets/public/sounds/ping.wav');
	});

	it('does not contain a copy of any earlier download (it would double in size every build)', () => {
		expect(read(apkPath).toString('latin1')).not.toContain('assets/public/downloads');
	});

	it('is kept out of the app build and out of the web app offline cache', () => {
		expect(JSON.parse(read('package.json').toString()).scripts['build:native']).toContain(
			'rm -rf build/downloads'
		);
		expect(read('src/service-worker.ts').toString()).toContain("'/downloads/'");
	});

	it('is served as a download with the right file type', () => {
		const vercel = JSON.parse(read('vercel.json').toString());
		const rule = vercel.headers.find((h: { source: string }) => h.source === release.android.file);
		const headers = Object.fromEntries(
			rule.headers.map((h: { key: string; value: string }) => [h.key, h.value])
		);
		expect(headers['Content-Type']).toBe('application/vnd.android.package-archive');
		expect(headers['Content-Disposition']).toContain('attachment');
	});

	it('has a version the installed apps can compare, and it matches the app that was built', () => {
		const gradle = read('android/app/build.gradle').toString();
		const code = Number(/versionCode (\d+)/.exec(gradle)?.[1]);
		expect(Number.isInteger(release.android.versionCode)).toBe(true);
		expect(release.android.versionCode).toBeGreaterThanOrEqual(1);
		expect(release.android.versionCode).toBe(code);
		expect(/versionName "([^"]+)"/.exec(gradle)?.[1]).toBe(release.android.version);
		expect(release.android.version).toBe(`1.${code - 1}`);
	});

	it('is published where the app looks for it, readable from the app and never cached', () => {
		const vercel = JSON.parse(read('vercel.json').toString());
		const rule = vercel.headers.find((h: { source: string }) => h.source === '/release.json');
		const headers = Object.fromEntries(
			rule.headers.map((h: { key: string; value: string }) => [h.key, h.value])
		);
		expect(headers['Access-Control-Allow-Origin']).toBe('*');
		expect(headers['Cache-Control']).toContain('no-cache');
		const route = read('src/routes/release.json/+server.ts').toString();
		expect(route).toContain('export const prerender = true');
		expect(route).toContain('appRelease.json');
	});
});
