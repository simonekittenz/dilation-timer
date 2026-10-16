<script lang="ts">
	import { dayNumber } from '$lib/dates';
	import Schedule from '$lib/Schedule.svelte';
	import { store } from '$lib/store.svelte';
	import Swatch from '$lib/Swatch.svelte';
	import Timer from '$lib/Timer.svelte';
	import { resolveSteps } from '$lib/dilators';

	const phase = $derived(store.todayPhase);
	const day = $derived(dayNumber(store.settings.startDate, store.today));
	const dateLabel = $derived(
		new Date(store.now).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		})
	);
	const nextSlot = $derived(store.nextSlot);
	const steps = $derived(phase ? resolveSteps(store.settings.dilators, phase.steps) : []);
</script>

<header>
	<h1>{dateLabel} <span class="sparkle">✿</span></h1>
	<p class="muted">
		{#if day < 1}
			Starts in {1 - day} day{1 - day === 1 ? '' : 's'}
		{:else if phase}
			Day {day} · {phase.label}
		{:else}
			Day {day} · no phase covers today
		{/if}
	</p>
</header>

{#if store.active}
	<Timer />
{:else if phase}
	<section class="routine card">
		<h2>Today's routine 🎀</h2>
		<ol class="steps">
			{#each steps as st, i (i)}
				<li><Swatch color={st.color} size={20} /> {st.label} · {st.minutes} min</li>
			{/each}
		</ol>
		<button class="btn" onclick={() => store.start(nextSlot?.slot ?? null)}>
			{nextSlot ? `Start ${nextSlot.label.toLowerCase()} session` : 'Start an extra session'}
		</button>
	</section>
	<h2 class="sub">Schedule ♡</h2>
	<Schedule />
{:else}
	<p class="card muted">
		No routine covers today. Check the start date and phases in <a href="/settings">Settings</a>.
	</p>
{/if}

<style>
	header {
		margin-bottom: 1.2rem;
	}
	h1 {
		font-size: 1.7rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.sparkle {
		font-size: 1.1rem;
	}
	.routine {
		display: grid;
		gap: 0.7rem;
		justify-items: start;
		margin-bottom: 1.4rem;
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		color: var(--muted);
		font-weight: 600;
	}
	.steps li {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.sub {
		font-size: 1rem;
		font-weight: 800;
		color: var(--muted);
		margin-bottom: 0.6rem;
	}
</style>
