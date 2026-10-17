// Renders the alarm sounds (src/lib/sounds.ts) into WAV files for the iOS/Android app:
//   npm run sounds:render
// It runs the very same notes through the very same Web Audio chain the web app uses, in your
// installed Chrome (set CHROME_PATH if it lives somewhere else). The WAVs are committed, so you
// only need to run this after changing a sound.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const CHROME =
	process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = new URL('../static/sounds/', import.meta.url).pathname;
const SAMPLE_RATE = 22050; // the notes only go up to ~2.6 kHz, so this is plenty and keeps files small
const TAIL_SECONDS = 0.25;

function wav(samples) {
	const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
	const header = Buffer.alloc(44);
	header.write('RIFF', 0);
	header.writeUInt32LE(36 + data.length, 4);
	header.write('WAVE', 8);
	header.write('fmt ', 12);
	header.writeUInt32LE(16, 16); // fmt chunk size
	header.writeUInt16LE(1, 20); // PCM
	header.writeUInt16LE(1, 22); // mono
	header.writeUInt32LE(SAMPLE_RATE, 24);
	header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
	header.writeUInt16LE(2, 32); // block align
	header.writeUInt16LE(16, 34); // bits per sample
	header.write('data', 36);
	header.writeUInt32LE(data.length, 40);
	return Buffer.concat([header, data]);
}

// A bare Vite server (no SvelteKit) is enough: it only has to turn sounds.ts into JavaScript,
// plus serve one empty page to run the render from (Vite's own 404 page blocks scripts).
const server = await createServer({
	configFile: false,
	appType: 'custom',
	logLevel: 'error',
	plugins: [
		{
			name: 'blank-page',
			configureServer(s) {
				s.middlewares.use('/blank', (_req, res) => {
					res.setHeader('content-type', 'text/html');
					res.end('<!doctype html><title>render</title>');
				});
			}
		}
	]
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
	const page = await browser.newPage();
	await page.goto(base + 'blank'); // we only need a page on the server's origin
	mkdirSync(OUT, { recursive: true });
	const names = await page.evaluate(async () => (await import('/src/lib/sounds.ts')).SOUND_NAMES);
	for (const name of names) {
		const base64 = await page.evaluate(
			async (name, sampleRate, tail) => {
				const m = await import('/src/lib/sounds.ts');
				const notes = m.scoreFor(name);
				const seconds = m.scoreLength(notes) + tail;
				const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
				const { bus } = m.buildChain(ctx, 1);
				m.playScore(ctx, bus, notes, 0);
				const rendered = (await ctx.startRendering()).getChannelData(0);
				const pcm = new Int16Array(rendered.length);
				for (let i = 0; i < rendered.length; i++) {
					pcm[i] = Math.round(Math.max(-1, Math.min(1, rendered[i])) * 32767);
				}
				let binary = '';
				const bytes = new Uint8Array(pcm.buffer);
				for (let i = 0; i < bytes.length; i += 0x8000) {
					binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
				}
				return btoa(binary);
			},
			name,
			SAMPLE_RATE,
			TAIL_SECONDS
		);
		const pcm = new Int16Array(Buffer.from(base64, 'base64').buffer.slice(0));
		let peak = 0;
		let sum = 0;
		for (const v of pcm) {
			peak = Math.max(peak, Math.abs(v) / 32767);
			sum += (v / 32767) ** 2;
		}
		const db = (x) => (20 * Math.log10(x)).toFixed(1);
		writeFileSync(`${OUT}${name}.wav`, wav(pcm));
		console.log(
			`${name.padEnd(12)} ${(pcm.length / SAMPLE_RATE).toFixed(2)}s  peak ${db(peak)} dBFS  rms ${db(Math.sqrt(sum / pcm.length))} dBFS`
		);
	}
} finally {
	await browser.close();
	await server.close();
}
