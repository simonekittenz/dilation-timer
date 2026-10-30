// Builds the iPhone app.
//   npm run ios:check        a quick check that the app still builds and starts: builds it for the iOS
//                            simulator without any signing, and looks at what went into it.
//   npm run ios:archive      the real build, signed with your Apple Developer account, written as an .ipa
//                            to ios/build/export/ (no upload).
//   npm run ios:testflight   the same, then uploaded to App Store Connect, where TestFlight picks it up.
//   npm run ios:archive -- --unsigned
//                            only makes the archive, without signing (works without an account).
//
// Signing needs your Apple Developer Team ID in APPLE_TEAM_ID (developer.apple.com → Membership details).
// Signing happens when the archive is exported. The easiest way to sign is to be signed in to Xcode (Settings → Accounts). To upload without Xcode being
// signed in (or from a script), make an App Store Connect API key and set ASC_KEY_PATH (the .p8 file),
// ASC_KEY_ID and ASC_ISSUER_ID. Put them in the environment, or in ~/.dilation-timer-signing/ios.env.
// See docs/app-store.md.
//
// The version is the same as the Android app's (src/lib/appRelease.json). The build number goes up with
// every commit, so each upload is accepted: App Store Connect refuses a build number it has seen before.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

// Your Apple details can live next to the Android signing keys, outside the project, in a file of
// KEY=value lines (APPLE_TEAM_ID=..., ASC_KEY_PATH=..., ASC_KEY_ID=..., ASC_ISSUER_ID=...).
const signingDir = process.env.DILATION_SIGNING_DIR ?? join(homedir(), '.dilation-timer-signing');
const envFile = join(signingDir, 'ios.env');
if (existsSync(envFile)) {
	for (const line of readFileSync(envFile, 'utf8').split('\n')) {
		const match = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
		if (match && !(match[1] in process.env))
			process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
	}
}
const iosApp = join(root, 'ios/App');
const buildDir = join(root, 'ios/build');
const mode = process.argv[2];
const unsigned = process.argv.includes('--unsigned');

if (!['--check', '--archive', '--upload'].includes(mode)) {
	console.error('Usage: node scripts/build-ios.mjs --check | --archive [--unsigned] | --upload');
	process.exit(1);
}

function fail(message) {
	console.error(`\nStopped: ${message}`);
	process.exit(1);
}
function run(cmd, args, options = {}) {
	console.log(`\n$ ${cmd} ${args.join(' ')}`);
	const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', ...options });
	if (result.status !== 0) fail(`"${cmd}" failed.`);
}
const out = (cmd, args) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8' }).stdout.trim();

if (spawnSync('xcodebuild', ['-version']).status !== 0)
	fail('Xcode is not installed (install it from the App Store, then open it once).');

// the web app, copied into the iOS project
run('npm', ['run', 'cap:sync']);

const version = JSON.parse(readFileSync(join(root, 'src/lib/appRelease.json'), 'utf8')).android
	.version;
const build = out('git', ['rev-list', '--count', 'HEAD']);
const versions = [`MARKETING_VERSION=${version}`, `CURRENT_PROJECT_VERSION=${build}`];
const project = ['-project', join(iosApp, 'App.xcodeproj'), '-scheme', 'App'];

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });

if (mode === '--check') {
	const derived = join(buildDir, 'derived');
	run('xcodebuild', [
		...project,
		'-configuration',
		'Debug',
		'-destination',
		'generic/platform=iOS Simulator',
		'-derivedDataPath',
		derived,
		'-quiet',
		'CODE_SIGNING_ALLOWED=NO',
		...versions,
		'build'
	]);
	const app = join(derived, 'Build/Products/Debug-iphonesimulator/App.app');
	const plist = (key) =>
		out('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, join(app, 'Info.plist')]);
	if (!existsSync(join(app, 'PrivacyInfo.xcprivacy')))
		fail('the privacy manifest is not in the app.');
	if (!existsSync(join(app, 'public/index.html')) && !existsSync(join(app, 'public/200.html')))
		fail('the web app is not inside the app.');
	console.log(
		`\nBuilt ${plist('CFBundleIdentifier')} ${plist('CFBundleShortVersionString')} (${plist('CFBundleVersion')}) for the simulator.`
	);
	console.log(`The app: ${app}`);
	process.exit(0);
}

// ---- archive (and export or upload) ----
// The archive is built without signing and signed when it is exported, with an Apple Distribution
// certificate and an App Store profile that Xcode makes by itself. Unlike signing the archive, that needs no
// registered iPhone, which a brand-new developer account does not have yet.
const team = process.env.APPLE_TEAM_ID;
const keyArgs =
	process.env.ASC_KEY_PATH && process.env.ASC_KEY_ID && process.env.ASC_ISSUER_ID
		? [
				'-authenticationKeyPath',
				process.env.ASC_KEY_PATH,
				'-authenticationKeyID',
				process.env.ASC_KEY_ID,
				'-authenticationKeyIssuerID',
				process.env.ASC_ISSUER_ID
			]
		: [];
const archive = join(buildDir, 'App.xcarchive');
run('xcodebuild', [
	...project,
	'-configuration',
	'Release',
	'-destination',
	'generic/platform=iOS',
	'-archivePath',
	archive,
	'-derivedDataPath',
	join(buildDir, 'derived'),
	'-quiet',
	'CODE_SIGNING_ALLOWED=NO',
	...versions,
	'archive'
]);
if (!existsSync(archive)) fail('the archive was not made.');
console.log(`\nArchived ${version} (${build}): ${archive}`);
if (unsigned) {
	console.log('Dry run only: it is not signed, so it cannot be uploaded or installed.');
	process.exit(0);
}
if (!team) fail('set APPLE_TEAM_ID to your Apple Developer Team ID (see docs/app-store.md).');

const upload = mode === '--upload';
const exportOptions = join(buildDir, 'ExportOptions.plist');
writeFileSync(
	exportOptions,
	`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>teamID</key>
	<string>${team}</string>
	<key>destination</key>
	<string>${upload ? 'upload' : 'export'}</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>uploadSymbols</key>
	<true/>
	<key>manageAppVersionAndBuildNumber</key>
	<false/>
</dict>
</plist>
`
);
run('xcodebuild', [
	'-exportArchive',
	'-archivePath',
	archive,
	'-exportOptionsPlist',
	exportOptions,
	'-exportPath',
	join(buildDir, 'export'),
	'-allowProvisioningUpdates',
	...keyArgs
]);
console.log(
	upload
		? `\nUploaded ${version} (${build}) to App Store Connect. It shows up under TestFlight after Apple has processed it (usually 5 to 30 minutes, you get an email).`
		: `\nExported to ${join(buildDir, 'export')}`
);
