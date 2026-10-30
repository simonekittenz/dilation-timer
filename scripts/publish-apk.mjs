// Puts the app that `npm run apk` built on GitHub Releases, so the file is never committed to git.
//   npm run apk:publish
// Run it after committing and pushing the version bump (src/lib/appRelease.json and
// android/app/build.gradle): the release's tag is made on that commit.
// The website's download link (/downloads/Dilation-timer.apk) redirects to the newest release, and the
// installed apps learn about it from /release.json, which is published with the site (appRelease.json).
// Needs the GitHub CLI (`gh`), logged in.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const APK_NAME = 'Dilation-timer.apk';
const apk = join(root, 'android/app/build/outputs/signing', APK_NAME);

function fail(message) {
	console.error(`\nNot published: ${message}`);
	process.exit(1);
}
function run(cmd, args) {
	return spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
}
const out = (cmd, args) => run(cmd, args).stdout.trim();

const { android } = JSON.parse(readFileSync(join(root, 'src/lib/appRelease.json'), 'utf8'));
const tag = `v${android.version}`;

if (!existsSync(apk)) fail(`${apk} is missing. Run \`npm run apk\` first.`);
const bytes = readFileSync(apk);
if (createHash('sha256').update(bytes).digest('hex') !== android.sha256)
	fail(
		'the built app is not the one appRelease.json describes. Run `npm run apk` again and commit.'
	);
if (run('gh', ['--version']).status !== 0) fail('the GitHub CLI (gh) is not installed.');
if (run('gh', ['auth', 'status']).status !== 0) fail('gh is not logged in (`gh auth login`).');

// the tag goes on the commit that has this version, so that commit has to be on GitHub
const head = out('git', ['rev-parse', 'HEAD']);
run('git', ['fetch', 'origin', '--quiet']);
if (run('git', ['merge-base', '--is-ancestor', head, 'origin/main']).status !== 0)
	fail('HEAD has not been pushed. Commit the version bump and `git push` first.');
const gradle = readFileSync(join(root, 'android/app/build.gradle'), 'utf8');
if (!gradle.includes(`versionName "${android.version}"`))
	fail('android/app/build.gradle and appRelease.json disagree about the version.');
if (run('gh', ['release', 'view', tag]).status === 0)
	fail(`${tag} already exists on GitHub. Build a new version with \`npm run apk -- --bump\`.`);

// release notes: what changed since the previous release
const previous = out('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*']);
const changes = out('git', [
	'log',
	'--no-merges',
	'--pretty=- %s',
	previous ? `${previous}..${head}` : head
])
	.split('\n')
	.filter((line) => line && !/^- Release \d/.test(line))
	.join('\n');
const notes = [
	`Android app, version ${android.version}. Installs over the previous version and keeps your data.`,
	'',
	changes || '- Small fixes',
	'',
	'After downloading, open the file and tap Install. If Android asks, allow installs from your browser or Files app.',
	'',
	`SHA-256: \`${android.sha256}\``
].join('\n');
const notesFile = join(tmpdir(), `dilation-timer-notes-${tag}.md`);
writeFileSync(notesFile, notes + '\n');

const result = spawnSync(
	'gh',
	[
		'release',
		'create',
		tag,
		apk,
		'--target',
		head,
		'--title',
		`Dilation timer ${android.version}`,
		'--notes-file',
		notesFile
	],
	{ cwd: root, stdio: 'inherit' }
);
if (result.status !== 0) fail('gh could not create the release.');
console.log(
	`\nPublished ${tag}. The website's download link and the apps' update notice follow it`
);
console.log('once the website has been deployed (the push you just did).');
