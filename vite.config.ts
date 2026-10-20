import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// `npm run build:native` sets this for the iOS/Android wrapper, which bundles its own files.
const native = process.env.VITE_NATIVE === '1';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: '200.html' }),
			paths: { relative: false },
			// Web only: an installed copy checks for new deployments. A native app updates through
			// its store instead, and has no use for the offline cache either.
			version: { pollInterval: native ? 0 : 60_000 },
			serviceWorker: { register: !native }
		})
	],
	test: { include: ['src/**/*.spec.ts'] }
});
