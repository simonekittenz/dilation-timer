// Makes the pictures the Google Play listing asks for:
//   npm run dev                      (in one terminal: the screenshots are taken of the running app)
//   npm run store:assets             (in another; writes to ~/Desktop/Play-Store-assets)
// Options (environment variables): STORE_URL (default http://localhost:5173), OUT_DIR, CHROME_PATH.
//
//   icon-512.png               the app icon, 512 x 512
//   feature-graphic.jpg        the wide banner, 1024 x 500
//   phone-1-today.jpg ...      screenshots, 1170 x 2340 (2:1, the tallest Play allows)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME =
	process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_BASE = (process.env.STORE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = process.env.OUT_DIR ?? join(homedir(), 'Desktop', 'Play-Store-assets');
const root = new URL('..', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// ---- the icon: the 1024 px launcher icon, shrunk (Play wants 512 x 512) ----
execFileSync(
	'sips',
	['-z', '512', '512', join(root, 'assets/icon-only.png'), '--out', join(OUT, 'icon-512.png')],
	{
		stdio: 'ignore'
	}
);

const browser = await puppeteer.launch({
	executablePath: CHROME,
	headless: true,
	args: ['--autoplay-policy=no-user-gesture-required']
});

// ---- the feature graphic ----
{
	const bunny = readFileSync(join(root, 'static/icon.svg'), 'utf8')
		.replace(/<\?xml[^>]*>/, '')
		.replace(/<svg[^>]*>|<\/svg>/g, '')
		.replace(/<defs>[\s\S]*?<\/defs>/, '')
		.replace(/<rect[^>]*\/>/, '');
	const page = await browser.newPage();
	await page.setViewport({ width: 1024, height: 500 });
	await page.setContent(`<!doctype html><html><body style="margin:0">
<div style="width:1024px;height:500px;box-sizing:border-box;display:flex;align-items:center;gap:56px;padding:0 70px;
	background:radial-gradient(circle at 18% 30%, #fff0f6 0%, #ffd1e6 45%, #ff9ccb 100%);
	font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;position:relative;overflow:hidden">
	<div style="position:absolute;right:-90px;top:-110px;width:380px;height:380px;border-radius:50%;background:#ffffff55"></div>
	<div style="position:absolute;right:120px;bottom:-150px;width:300px;height:300px;border-radius:50%;background:#ff4f9a22"></div>
	<svg width="300" height="300" viewBox="0 0 512 500" style="flex:none;filter:drop-shadow(0 10px 0 #ff4f9a33)">${bunny}</svg>
	<div style="position:relative">
		<div style="font-size:78px;font-weight:900;line-height:1;color:#ff3d8d;letter-spacing:-1px">Dilation timer</div>
		<div style="margin-top:22px;font-size:32px;font-weight:600;line-height:1.3;color:#6b2a50">
			Your schedule, your timers,<br />and a gentle nudge to switch.
		</div>
	</div>
</div></body></html>`);
	await page.screenshot({ path: join(OUT, 'feature-graphic.jpg'), type: 'jpeg', quality: 95 });
	await page.close();
}

// ---- phone screenshots, taken of the real app with made-up (but plausible) data ----
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d;
};
const MIN = 60_000;
const now = Date.now();

// Week 5 of the standard program: four dilators, each a different colour. Day 36 is its first day.
const SETTINGS = {
	startDate: ymd(daysAgo(35)),
	setup: 'done',
	mascot: 'bunny',
	switchWindowMinutes: 1
};
const WEEK5 = [
	{ label: 'Dilator 0', color: '#d6c9f5', diameterMm: 20, minutes: 10 },
	{ label: 'Dilator 1', color: '#5a4b9c', diameterMm: 23, minutes: 10 },
	{ label: 'Dilator 2', color: '#f2c94c', diameterMm: 26, minutes: 30 },
	{ label: 'Dilator 3', color: '#ef7f8a', diameterMm: 29, minutes: 25 }
];

function session(phase, stepIndex, sinceStepStart, alertAgo = null) {
	const stepStartedAt = now - sinceStepStart;
	return {
		id: 'store-demo',
		date: ymd(new Date()),
		slot: 'morning',
		startedAt: stepStartedAt - stepIndex * 10 * MIN,
		steps: WEEK5,
		stepIndex,
		stepStartedAt,
		phase,
		warned: false,
		pausedAt: null,
		adjustMs: 0,
		alertSince: alertAgo === null ? null : now - alertAgo,
		records: WEEK5.slice(0, stepIndex + 1).map((s, i) => ({
			label: s.label,
			color: s.color,
			plannedMinutes: s.minutes,
			startedAt: stepStartedAt - (stepIndex - i) * 10 * MIN,
			endedAt: i < stepIndex ? stepStartedAt - (stepIndex - i - 1) * 10 * MIN : null
		}))
	};
}

function pastSession(daysBack, slot, hour) {
	const day = daysAgo(daysBack);
	day.setHours(hour, 5, 0, 0);
	const startedAt = day.getTime();
	return {
		id: `store-${daysBack}-${slot}`,
		date: ymd(day),
		slot,
		startedAt,
		finishedAt: startedAt + 75 * MIN,
		steps: WEEK5.map((s) => ({
			label: s.label,
			color: s.color,
			plannedMinutes: s.minutes,
			actualSeconds: s.minutes * 60 + 20
		}))
	};
}
const HISTORY = [1, 2, 3].flatMap((back) => [
	pastSession(back, 'evening', 20),
	pastSession(back, 'morning', 8)
]);

async function shot(name, { state, path = '/', steps = async () => {} }) {
	const page = await browser.newPage();
	// 440 x 880 css pixels at 2.66x = 1170 x 2340, the tallest shape (2:1) Google Play accepts
	await page.setViewport({ width: 440, height: 880, deviceScaleFactor: 1170 / 440 });
	await page.evaluateOnNewDocument((blob) => {
		localStorage.setItem('dilation-timer:welcome', 'web');
		localStorage.setItem('dilation-timer:v1', blob);
	}, JSON.stringify(state));
	await page.goto(URL_BASE + path, { waitUntil: 'networkidle0' });
	// a tap, like a real person's, so the web page doesn't show its "tap to turn the sound on" note
	// (the Android app never shows it)
	await page.mouse.click(5, 5);
	await new Promise((r) => setTimeout(r, 600));
	await steps(page);
	await new Promise((r) => setTimeout(r, 400));
	await page.screenshot({ path: join(OUT, name), type: 'jpeg', quality: 92 });
	await page.close();
}
const click = (page, label) =>
	page.evaluate((label) => {
		[...document.querySelectorAll('button, a.btn')]
			.find((b) => b.textContent.includes(label))
			?.click();
	}, label);

await shot('phone-1-today.jpg', { state: { settings: SETTINGS, log: [], active: null } });
await shot('phone-2-timer.jpg', {
	// a quarter of the way into Dilator 1: "Dilator 1" counting down, the others waiting
	state: { settings: SETTINGS, log: [], active: session('running', 1, 3 * MIN) }
});
await shot('phone-3-switch.jpg', {
	state: { settings: SETTINGS, log: [], active: session('switch', 1, 10 * MIN + 20_000, 20_000) }
});
await shot('phone-4-custom-length.jpg', {
	state: { settings: SETTINGS, log: [], active: null },
	path: '/custom',
	steps: async (page) => {
		await click(page, '1 hour');
		// desktop Chrome draws the unfilled part of a slider dark; an Android phone draws it light grey
		await page.addStyleTag({
			content: `input[type=range]{appearance:none;height:12px;border-radius:99px;
				background:linear-gradient(to right,#ff7eb6 var(--fill),#e6e6e6 var(--fill))}
				input[type=range]::-webkit-slider-thumb{appearance:none;width:26px;height:26px;border-radius:50%;background:#ff7eb6}`
		});
		await page.evaluate(() => {
			const r = document.querySelector('input[type=range]');
			r.style.setProperty('--fill', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
		});
	}
});
await shot('phone-5-custom-review.jpg', {
	state: { settings: SETTINGS, log: [], active: null },
	path: '/custom',
	steps: async (page) => {
		await click(page, '1 hour');
		await new Promise((r) => setTimeout(r, 300));
		await click(page, 'Next');
	}
});
await shot('phone-6-history.jpg', {
	state: { settings: SETTINGS, log: HISTORY, active: null },
	path: '/history'
});

await browser.close();
console.log(`Wrote the store pictures to ${OUT}`);
