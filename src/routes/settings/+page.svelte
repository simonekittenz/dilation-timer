<script lang="ts">
	import { isNative } from '#lib/platform.ts';
	import { useSettingsForm } from '#lib/settingsForm.svelte.ts';
	import { store } from '#lib/store.svelte.ts';
	import { updates } from '#lib/updates.svelte.ts';
	import { APP_VERSION } from '#lib/version.ts';

	const form = useSettingsForm();
	const draft = form.draft;
	const hasDate = $derived(form.hasDate);
	const day = $derived(form.day);
	const currentPhase = $derived(form.currentPhase);
	const todayLabel = $derived(
		new Date(store.now).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		})
	);

	const sections = $derived([
		{
			href: '/settings/about',
			icon: '🌸',
			title: 'About you',
			hint: `Surgery date and ${draft.dilators.length} dilators`
		},
		{
			href: '/settings/alerts',
			icon: '🔔',
			title: 'Sessions & alerts',
			hint: isNative() ? 'Sound, alerts and reminders' : 'Switch window, sound, reminders'
		},
		{
			href: '/settings/encouragement',
			icon: '💌',
			title: 'Encouragement',
			hint: 'Your friend, milestones, streak'
		},
		{
			href: '/settings/schedule',
			icon: '🗓️',
			title: 'Your schedule',
			hint: `${draft.phases.length} phases, push back, edit`
		},
		{
			href: '/settings/data',
			icon: '💾',
			title: 'Your data',
			hint: 'Back up and restore'
		}
	]);
</script>

<section class="here">
	<p class="hint">Today · {todayLabel}</p>
	{#if !hasDate}
		<h2>Pick your surgery date</h2>
		<p class="hint">
			Then I can show where you are in the schedule. The Today screen asks for it too.
		</p>
	{:else if day < 1}
		<h2>Starts in {1 - day} day{1 - day === 1 ? '' : 's'}</h2>
	{:else if currentPhase}
		<div class="here-row">
			<h2>Day {day} · {currentPhase.label}</h2>
			<a class="pill" href="/settings/schedule#current-phase">See phase →</a>
		</div>
	{:else}
		<h2>Day {day} · no phase covers today</h2>
	{/if}
</section>

<div class="panel menu">
	{#each sections as section (section.href)}
		<a class="item link" href={section.href}>
			<span class="icon" aria-hidden="true">{section.icon}</span>
			<span class="text">
				<span class="label">{section.title}</span>
				<span class="hint">{section.hint}</span>
			</span>
			<span class="chev" aria-hidden="true">›</span>
		</a>
	{/each}
</div>

<p class="version hint" data-testid="version">
	Dilation timer v{APP_VERSION}{isNative() ? ' · app' : ''}
	{#if updates.available}
		· <a href={updates.available.downloadUrl}>v{updates.available.version} is available</a>
	{/if}
	· <a href="/privacy">Privacy</a>
</p>
