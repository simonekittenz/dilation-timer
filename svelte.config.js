import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({ fallback: '200.html' }),
		paths: { relative: false },
		// Checked by the app so an open/installed copy notices new deployments.
		version: { pollInterval: 60_000 }
	}
};

export default config;
