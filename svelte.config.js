import adapter from '@sveltejs/adapter-static';

// `npm run build:native` sets this for the iOS/Android wrapper, which bundles its own files.
const native = process.env.VITE_NATIVE === '1';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({ fallback: '200.html' }),
		paths: { relative: false },
		// Web only: an installed copy checks for new deployments. A native app updates through
		// its store instead, and has no use for the offline cache either.
		version: { pollInterval: native ? 0 : 60_000 },
		serviceWorker: { register: !native }
	}
};

export default config;
