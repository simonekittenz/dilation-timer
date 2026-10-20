// Builds the Android app and publishes it on the website, so the download can't go stale:
//   npm run apk             builds the app. The version goes up by one only if the current version
//                           is already published (on origin/main); otherwise it is reused.
//   npm run apk -- --keep   never changes the version
//   npm run apk -- --bump   always raises the version
//   npm run aab             the Google Play version: an app bundle (.aab) signed with the upload key.
//                           Never published on the website, version untouched; it is for uploading to
//                           the Play Console. (Built without the in-app "new version" notice, since
//                           Play updates the app.)
//   npm run apk:debug       a test build for an emulator: the same app, signed with the same keys, but
//                           with remote debugging on. Not published, and it installs over (and under)
//                           the release build without uninstalling.
// The version number is what installed apps compare against the website to offer an update.
// It needs the Android SDK and a JDK 21 (found by itself) and the release signing key, which lives
// OUTSIDE this folder (see docs/native-apps.md, "Signing").
// Result: static/downloads/Dilation-timer.apk + src/lib/appRelease.json (what the welcome page shows).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { decideVersionCode } from './version.mjs';

const root = new URL('..', import.meta.url).pathname;
const android = join(root, 'android');
const APK_NAME = 'Dilation-timer.apk';
const debugBuild = process.argv.includes('--debug');
const aabBuild = process.argv.includes('--aab');

// The release key lives outside the repository. Losing it means everyone must uninstall to update.
const SIGNING_DIR = process.env.DILATION_SIGNING_DIR ?? join(homedir(), '.dilation-timer-signing');
const signing = {
	keystore: join(SIGNING_DIR, 'release.keystore'),
	password: join(SIGNING_DIR, 'password.txt'),
	// The app was first signed with Android's debug key. Phones that have it only accept an update
	// signed by that same key, or by a key it was handed over to ("rotated", via lineage.bin).
	oldKeystore: join(SIGNING_DIR, 'old-signer.keystore'), // the debug key, password "android"
	lineage: join(SIGNING_DIR, 'lineage.bin'),
	alias: 'dilation-timer',
	// Google Play checks uploads against this key. The app's real signing key is the release key,
	// which is handed to Play App Signing once (docs/play-store.md).
	uploadKeystore: join(SIGNING_DIR, 'upload.keystore'),
	uploadPassword: join(SIGNING_DIR, 'upload-password.txt'),
	uploadAlias: 'upload'
};

function androidSdk() {
	const fromEnv = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
	if (fromEnv) return fromEnv;
	const props = join(android, 'local.properties');
	if (existsSync(props)) {
		const dir = /^sdk\.dir=(.+)$/m.exec(readFileSync(props, 'utf8'))?.[1];
		if (dir) return dir.trim();
	}
	return join(homedir(), 'Library/Android/sdk');
}

/** The newest installed build-tools folder (it has zipalign, apksigner and aapt2). */
function buildTools() {
	const dir = join(androidSdk(), 'build-tools');
	if (!existsSync(dir)) return null;
	const newest = readdirSync(dir)
		.filter((d) => existsSync(join(dir, d, 'apksigner')))
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
		.at(-1);
	return newest ? join(dir, newest) : null;
}

function javaMajor(home) {
	const java = join(home, 'bin', 'java');
	if (!existsSync(java)) return null;
	const out = spawnSync(java, ['-version'], { encoding: 'utf8' });
	const match = /version "(\d+)/.exec(`${out.stdout}${out.stderr}`);
	return match ? Number(match[1]) : null;
}

/** Gradle 8.14 (what this project pins) is happiest on Java 21, which is also what the code targets. */
function findJdk21() {
	const candidates = [process.env.JAVA_HOME];
	const lookup = spawnSync('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' });
	if (lookup.status === 0) candidates.push(lookup.stdout.trim());
	const jvms = join(homedir(), 'Library/Java/JavaVirtualMachines');
	if (existsSync(jvms))
		for (const d of readdirSync(jvms)) candidates.push(join(jvms, d, 'Contents/Home'));
	return candidates.filter(Boolean).find((home) => javaMajor(home) === 21);
}

function run(cmd, args, options = {}) {
	console.log(`\n$ ${cmd} ${args.join(' ')}`);
	const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, ...options });
	if (result.status !== 0) {
		console.error(`\n"${cmd} ${args.join(' ')}" failed.`);
		process.exit(result.status ?? 1);
	}
}

// ---- version: android/app/build.gradle holds the truth; the app itself reads appRelease.json ----
const gradleFile = join(android, 'app/build.gradle');
const releaseFile = join(root, 'src/lib/appRelease.json');
const keep = process.argv.includes('--keep');
const bump = process.argv.includes('--bump');

/** The version code on origin/main, i.e. what has really been published; null if unknown. */
function publishedVersionCode() {
	spawnSync('git', ['fetch', 'origin', '--quiet'], { cwd: root, timeout: 20_000 });
	const shown = spawnSync('git', ['show', 'origin/main:android/app/build.gradle'], {
		cwd: root,
		encoding: 'utf8'
	});
	if (shown.status !== 0) return null;
	return Number(/versionCode (\d+)/.exec(shown.stdout)?.[1]) || null;
}
const gradle = readFileSync(gradleFile, 'utf8');
const currentCode = Number(/versionCode (\d+)/.exec(gradle)?.[1]);
if (!Number.isInteger(currentCode) || currentCode < 1) {
	console.error('Could not read versionCode from android/app/build.gradle.');
	process.exit(1);
}
const decision = decideVersionCode({
	current: currentCode,
	published: keep || bump || debugBuild || aabBuild ? null : publishedVersionCode(),
	keep: keep || debugBuild || aabBuild,
	bump
});
const versionCode = decision.code;
/** Version 1 is "1.0", version 2 is "1.1", and so on. */
const versionName = `1.${versionCode - 1}`;
writeFileSync(
	gradleFile,
	gradle
		.replace(/versionCode \d+/, `versionCode ${versionCode}`)
		.replace(/versionName "[^"]*"/, `versionName "${versionName}"`)
);
// Written before the web build so the app carries its own version number. The file's size and
// checksum are filled in once the app exists (the copy inside the app never uses them).
const previous = JSON.parse(readFileSync(releaseFile, 'utf8')).android ?? {};
writeFileSync(
	releaseFile,
	JSON.stringify({ android: { ...previous, version: versionName, versionCode } }, null, '\t') + '\n'
);
console.log(`Building version ${versionName} (code ${versionCode}): ${decision.why}`);

const tools = buildTools();
{
	const needed = aabBuild
		? [signing.uploadKeystore, signing.uploadPassword]
		: [signing.keystore, signing.password, signing.oldKeystore, signing.lineage];
	const missing = needed.filter((f) => !existsSync(f));
	if (missing.length > 0) {
		console.error(
			`The release signing key is missing (${missing.join(', ')}).\n` +
				'Restore your backup of the signing folder to ~/.dilation-timer-signing, or see\n' +
				'docs/native-apps.md ("Signing").'
		);
		process.exit(1);
	}
	if (!tools) {
		console.error('No Android build-tools found (zipalign, apksigner). See docs/native-apps.md.');
		process.exit(1);
	}
}

const jdk = findJdk21();
if (!jdk) {
	console.error(
		'No JDK 21 found. Install one (e.g. Temurin 21) or set JAVA_HOME. See docs/native-apps.md.'
	);
	process.exit(1);
}
console.log(`Using Java 21 at ${jdk}`);

// builds the web app for the wrapper and copies it into android/. The Play version is built with
// VITE_PLAY=1, which leaves out the self-update notice (Play delivers the updates).
run('npm', ['run', 'cap:sync'], { env: { ...process.env, VITE_PLAY: aabBuild ? '1' : '0' } });
const gradleEnv = { ...process.env, JAVA_HOME: jdk };

if (aabBuild) {
	run('./gradlew', ['bundleRelease', '--console=plain'], { cwd: android, env: gradleEnv });
	const bundle = join(android, 'app/build/outputs/bundle/release/app-release.aab');
	if (!existsSync(bundle)) {
		console.error(`Expected the bundle at ${bundle}, but it isn't there.`);
		process.exit(1);
	}
	const outDir = join(android, 'app/build/outputs/signing');
	mkdirSync(outDir, { recursive: true });
	const out = join(outDir, 'Dilation-timer-play.aab');
	copyFileSync(bundle, out);
	run(join(jdk, 'bin/jarsigner'), [
		'-keystore',
		signing.uploadKeystore,
		'-storepass:file',
		signing.uploadPassword,
		'-sigalg',
		'SHA256withRSA',
		'-digestalg',
		'SHA-256',
		out,
		signing.uploadAlias
	]);
	const check = spawnSync(join(jdk, 'bin/jarsigner'), ['-verify', out], { encoding: 'utf8' });
	if (!/jar verified/.test(check.stdout)) {
		console.error(`\nThe bundle's signature does not verify.\n${check.stdout}${check.stderr}`);
		process.exit(1);
	}
	console.log(`\nPlay bundle (NOT for the website): ${out}`);
	console.log('Upload it in the Play Console (see docs/play-store.md).');
	process.exit(0);
}

run('./gradlew', ['assembleRelease', ...(debugBuild ? ['-PtestBuild'] : []), '--console=plain'], {
	cwd: android,
	env: gradleEnv
});
const unsigned = join(android, 'app/build/outputs/apk/release/app-release-unsigned.apk');
if (!existsSync(unsigned)) {
	console.error(`Expected the app at ${unsigned}, but it isn't there.`);
	process.exit(1);
}

// align, then sign with the release key and the rotation file (in that order: signing seals the file)
const work = join(android, 'app/build/outputs/signing');
mkdirSync(work, { recursive: true });
const aligned = join(work, 'aligned.apk');
const signed = join(work, debugBuild ? 'Dilation-timer-test.apk' : APK_NAME);
run(join(tools, 'zipalign'), ['-p', '-f', '4', unsigned, aligned]);
run(
	join(tools, 'apksigner'),
	[
		'sign',
		// the oldest key signs the classic signature (v2), which phones older than Android 9 use
		'--ks',
		signing.oldKeystore,
		'--ks-key-alias',
		'androiddebugkey',
		'--ks-pass',
		'pass:android',
		// the release key signs v3 with the lineage; Android 9 and up use that one
		'--next-signer',
		'--ks',
		signing.keystore,
		'--ks-key-alias',
		signing.alias,
		'--ks-pass',
		`file:${signing.password}`,
		// v2 is understood by every Android this app supports (7.0 and up), so the old v1 is not needed
		'--v1-signing-enabled',
		'false',
		'--v2-signing-enabled',
		'true',
		'--v3-signing-enabled',
		'true',
		'--lineage',
		signing.lineage,
		'--out',
		signed,
		aligned
	],
	{ env: gradleEnv }
);

// check what we are about to publish
const verify = spawnSync(
	join(tools, 'apksigner'),
	['verify', '--verbose', '--print-certs', signed],
	{ encoding: 'utf8', env: gradleEnv }
);
const report = `${verify.stdout}${verify.stderr}`;
const signer = /certificate SHA-256 digest: ([0-9a-f]{64})/.exec(report)?.[1];
const fail = (why) => {
	console.error(`\nNot publishing: ${why}\n${report}`);
	process.exit(1);
};
if (verify.status !== 0 || !signer) fail('the signature does not verify.');
if (!/Verified using v2 scheme[^\n]*: true/.test(report)) fail('it is not signed with scheme v2.');
if (!/Verified using v3 scheme[^\n]*: true/.test(report))
	fail('it is not signed with scheme v3 (needed for the key rotation).');
const badging = spawnSync(join(tools, 'aapt2'), ['dump', 'badging', signed], {
	encoding: 'utf8'
}).stdout;
const debuggable = /application-debuggable/.test(badging);
if (debugBuild && !debuggable) fail('the test build should have debugging on, but it does not.');
if (!debugBuild && debuggable) fail('the app is marked as a debug build.');
const previousSigner = JSON.parse(readFileSync(releaseFile, 'utf8')).android?.signer;
if (previousSigner && previousSigner !== signer)
	fail(`it is signed with a different key than the last release (${previousSigner}).`);
console.log(`Signed with the release key ${signer.match(/.{2}/g).slice(0, 8).join(':')}:…`);

if (debugBuild) {
	console.log(`\nTest build (debugging on, NOT published): ${signed}`);
	console.log('Install it with: adb install -r <that file>   (works over a release build too)');
	process.exit(0);
}

const outDir = join(root, 'static/downloads');
mkdirSync(outDir, { recursive: true });
copyFileSync(signed, join(outDir, APK_NAME));

const bytes = readFileSync(join(outDir, APK_NAME));
const release = {
	android: {
		...(JSON.parse(readFileSync(releaseFile, 'utf8')).android ?? {}),
		file: `/downloads/${APK_NAME}`,
		version: versionName,
		versionCode,
		sizeBytes: statSync(join(outDir, APK_NAME)).size,
		sha256: createHash('sha256').update(bytes).digest('hex'),
		signer,
		builtAt: new Date().toISOString()
	}
};
writeFileSync(releaseFile, JSON.stringify(release, null, '\t') + '\n');
console.log(
	`\nPublished ${APK_NAME} (${(release.android.sizeBytes / 1e6).toFixed(1)} MB, v${versionName}) and src/lib/appRelease.json`
);
console.log('Commit both, then deploy the website.');
