import { self as sw } from '$app/service-worker';
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { resolve } from '$app/paths';

const CACHE = `cache-${version}`;
// The WAV alarm sounds and the Android app download are not needed by the web app itself, so its
// offline cache must not fetch them.
const SKIP = ['/sounds/', '/downloads/'];
const ASSETS = [
	...immutable.map((a) => resolve(a.path)),
	...assets.map((a) => resolve(a.path)).filter((f) => !SKIP.some((p) => f.startsWith(p))),
	'/200.html'
];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((c) => c.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== location.origin) return;
	event.respondWith(
		caches.match(event.request).then(
			(hit) =>
				hit ??
				fetch(event.request).catch(async () => {
					if (event.request.mode === 'navigate')
						return (await caches.match('/200.html')) as Response;
					return Response.error();
				})
		)
	);
});
