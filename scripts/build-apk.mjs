// Builds the Android app and publishes it on the website, so the download can't go stale:
//   npm run apk
// It needs the Android SDK (see docs/native-apps.md) and a JDK 21, which it finds by itself.
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

const root = new URL('..', import.meta.url).pathname;
const android = join(root, 'android');
const APK_NAME = 'Dilation-timer.apk';

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

const jdk = findJdk21();
if (!jdk) {
	console.error(
		'No JDK 21 found. Install one (e.g. Temurin 21) or set JAVA_HOME. See docs/native-apps.md.'
	);
	process.exit(1);
}
console.log(`Using Java 21 at ${jdk}`);

run('npm', ['run', 'cap:sync']); // builds the web app for the wrapper and copies it into android/
run('./gradlew', ['assembleDebug', '--console=plain'], {
	cwd: android,
	env: { ...process.env, JAVA_HOME: jdk }
});

const built = join(android, 'app/build/outputs/apk/debug/app-debug.apk');
if (!existsSync(built)) {
	console.error(`Expected the app at ${built}, but it isn't there.`);
	process.exit(1);
}
const outDir = join(root, 'static/downloads');
mkdirSync(outDir, { recursive: true });
copyFileSync(built, join(outDir, APK_NAME));

const bytes = readFileSync(join(outDir, APK_NAME));
const versionName =
	/versionName "([^"]+)"/.exec(readFileSync(join(android, 'app/build.gradle'), 'utf8'))?.[1] ??
	'1.0';
const release = {
	android: {
		file: `/downloads/${APK_NAME}`,
		version: versionName,
		sizeBytes: statSync(join(outDir, APK_NAME)).size,
		sha256: createHash('sha256').update(bytes).digest('hex'),
		builtAt: new Date().toISOString()
	}
};
writeFileSync(join(root, 'src/lib/appRelease.json'), JSON.stringify(release, null, '\t') + '\n');
console.log(
	`\nPublished ${APK_NAME} (${(release.android.sizeBytes / 1e6).toFixed(1)} MB, v${versionName}) and src/lib/appRelease.json`
);
console.log('Commit both, then deploy the website.');
