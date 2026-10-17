// Draws the app icon + launch screen artwork (assets/*.png) from static/icon.svg's bunny:
//   npm run icons        (renders the PNGs, then lets @capacitor/assets size them for iOS + Android)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME =
	process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = new URL('../assets/', import.meta.url).pathname;

// just the bunny (the file's own background tile and gradient are dropped)
const bunny = readFileSync(new URL('../static/icon.svg', import.meta.url), 'utf8')
	.replace(/<\?xml[^>]*>/, '')
	.replace(/<svg[^>]*>|<\/svg>/g, '')
	.replace(/<defs>[\s\S]*?<\/defs>/, '')
	.replace(/<rect[^>]*\/>/, '');

const GRADIENT = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
	<stop offset="0" stop-color="#ff9ccb"/><stop offset="1" stop-color="#ff4f9a"/></linearGradient></defs>`;

/** The bunny, centred in a square canvas at the given scale (the art itself is 512 wide). */
function art(size, scale) {
	const tx = size / 2 - 256 * scale;
	const ty = size / 2 - 250 * scale;
	return `<g transform="translate(${tx} ${ty}) scale(${scale})">${bunny}</g>`;
}

const svg = (size, body) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

const images = {
	// iOS: opaque full-bleed square (iOS rounds the corners itself)
	'icon-only.png': svg(
		1024,
		`${GRADIENT}<rect width="1024" height="1024" fill="url(#g)"/>${art(1024, 1.7)}`
	),
	// Android adaptive icon: the bunny must sit inside the central ~60% so no phone shape crops it
	'icon-foreground.png': svg(1024, art(1024, 1.15)),
	'icon-background.png': svg(1024, `${GRADIENT}<rect width="1024" height="1024" fill="url(#g)"/>`),
	'splash.png': svg(2732, `<rect width="2732" height="2732" fill="#fff0f6"/>${art(2732, 1.5)}`),
	'splash-dark.png': svg(2732, `<rect width="2732" height="2732" fill="#2b1626"/>${art(2732, 1.5)}`)
};

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
	const page = await browser.newPage();
	for (const [name, markup] of Object.entries(images)) {
		const size = Number(/width="(\d+)"/.exec(markup)[1]);
		await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
		await page.setContent(`<body style="margin:0;background:transparent">${markup}</body>`);
		const transparent = name === 'icon-foreground.png';
		writeFileSync(`${OUT}${name}`, await page.screenshot({ omitBackground: transparent }));
		console.log('wrote', name);
	}
} finally {
	await browser.close();
}
