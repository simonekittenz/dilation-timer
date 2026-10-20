import { execFileSync } from 'node:child_process';
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
		expect(read('src/service-worker/index.ts').toString()).toContain("'/downloads/'");
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

	it('records which key signed it, and that key never changes (or nobody could update)', () => {
		// the SHA-256 of the release certificate; the same value is in the signing folder's README
		expect(release.android.signer).toMatch(/^[0-9a-f]{64}$/);
		expect(release.android.signer).toBe(
			'bf3533f4e97799858e5d53fc641325312194bde07ae28db64277229dcbd8b564'
		);
	});

	it('keeps signing keys and passwords out of git, whatever happens', () => {
		const ignore = read('.gitignore').toString();
		for (const pattern of ['*.keystore', '*.jks', 'password.txt', 'lineage.bin'])
			expect(ignore).toContain(pattern);
		const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
		const secrets = tracked.filter((f) =>
			/\.(keystore|jks|p12|pfx)$|(^|\/)(password\.txt|lineage\.bin)$/.test(f)
		);
		expect(secrets).toEqual([]);
	});

	it('has a debug build for testing that is kept apart from the published one', () => {
		const scripts = JSON.parse(read('package.json').toString()).scripts;
		expect(scripts.apk).toBe('node scripts/build-apk.mjs');
		expect(scripts['apk:debug']).toBe('node scripts/build-apk.mjs --debug');
		const script = read('scripts/build-apk.mjs').toString();
		expect(script).toContain('assembleRelease');
		expect(script).toContain('--lineage');
		expect(script).toContain('application-debuggable');
	});

	it('has a privacy page that Google Play and the apps can link to', () => {
		const page = read('src/routes/privacy/+page.svelte').toString();
		expect(page).toContain('no accounts');
		// the page must tell the truth about the website's visit counter, and say the apps have none
		expect(page).toContain('Vercel Web Analytics');
		expect(page).toContain('no analytics or tracking at all');
		expect(page).toContain('github.com/simonekittenz/dilation-timer/issues');
		// reachable from inside the app and from the start page
		expect(read('src/routes/settings/+page.svelte').toString()).toContain('href="/privacy"');
		expect(read('src/routes/welcome/+page.svelte').toString()).toContain('href="/privacy"');
	});

	it('can build the Google Play bundle, without the self-update notice and never for the website', () => {
		const scripts = JSON.parse(read('package.json').toString()).scripts;
		expect(scripts.aab).toBe('node scripts/build-apk.mjs --aab');
		const script = read('scripts/build-apk.mjs').toString();
		expect(script).toContain('bundleRelease');
		expect(script).toContain('jarsigner'); // bundles are signed with the upload key
		expect(script).toContain("VITE_PLAY: aabBuild ? '1' : '0'");
		// the bundle goes to the build folder only, never into the website's downloads
		expect(
			script.slice(script.indexOf('if (aabBuild) {'), script.indexOf('process.exit(0);'))
		).not.toContain('static/downloads');
		expect(read('src/lib/updates.svelte.ts').toString()).toContain("VITE_PLAY === '1'");
	});

	it('documents the Play steps and uses the real privacy page address', () => {
		const doc = read('docs/play-store.md').toString();
		expect(doc).toContain('https://dilation-timer.vercel.app/privacy');
		expect(doc).toContain('com.simonekittenz.dilationtimer');
		expect(doc).toContain('12 testers');
		expect(doc).toContain('Not affiliated with or endorsed by WIH International Hospital');
	});

	it('keeps the session screen focused: no menu, a one-line dilator strip, round controls', () => {
		const layout = read('src/routes/+layout.svelte').toString();
		expect(layout).toContain("page.url.pathname === '/' && !!store.active");
		expect(layout).toContain("page.url.pathname !== '/welcome' && !focus");
		const timer = read('src/lib/Timer.svelte').toString();
		expect(timer).toContain('class="steps"');
		expect(timer).toContain('class="round main"');
		// the finish estimate is a pill on the same row as the dilator chips, and no diameter on the ring
		expect(timer).toContain('data-testid="eta"');
		expect(timer).not.toContain('current.diameterMm');
		// the strip's own rule must not wrap onto a second line
		const strip = /\t\.steps \{[^}]*\}/.exec(timer)?.[0] ?? '';
		expect(strip).toContain('display: flex');
		expect(strip).not.toContain('flex-wrap');
	});

	it('has a Ko-fi support note on the website start page only, with a safe link', () => {
		const welcome = read('src/routes/welcome/+page.svelte').toString();
		expect(welcome).toContain('href="https://ko-fi.com/zephyralux"');
		expect(welcome).toContain('rel="noopener noreferrer"');
		// the apps never show the start page, so no donation link ends up in the Play version
		for (const file of [
			'src/routes/+layout.svelte',
			'src/routes/+page.svelte',
			'src/lib/Timer.svelte'
		])
			expect(read(file).toString()).not.toContain('ko-fi');
	});
});
