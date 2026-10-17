/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `cache-${version}`;
// The WAV alarm sounds are only used by the iOS/Android app, so the web app doesn't download them.
const ASSETS = [...build, ...files.filter((f) => !f.startsWith('/sounds/')), '/200.html'];

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
