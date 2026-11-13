<script lang="ts">
	import './settings.css';
	import { page } from '$app/state';
	import { routePath } from '#lib/route.ts';
	import { provideSettingsForm } from '#lib/settingsForm.svelte.ts';

	let { children } = $props();

	// One form for all the Settings pages, so moving between them keeps what is on screen.
	const form = provideSettingsForm();

	const TITLES: Record<string, string> = {
		about: 'About you',
		alerts: 'Sessions & alerts',
		encouragement: 'Encouragement',
		schedule: 'Your schedule',
		data: 'Your data'
	};
	const section = $derived(routePath(page.url.pathname).split('/')[2] ?? '');
</script>

<div class="settings">
	<div class="head">
		{#if section}
			<a class="back-btn" href="/settings" aria-label="Back to Settings">‹</a>
		{/if}
		<h1>{TITLES[section] ?? 'Settings'}</h1>
		<p class="status {form.status}" role="status" aria-live="polite">
			{#if form.status === 'saved'}
				Saved ✓
			{:else}
				Not saved yet, finish the empty date or day field
			{/if}
		</p>
	</div>
	{@render children()}
</div>
