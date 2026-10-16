<script lang="ts">
	import { dayNumber } from '$lib/dates';
	import Schedule from '$lib/Schedule.svelte';
	import { store } from '$lib/store.svelte';
	import Timer from '$lib/Timer.svelte';

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
		<p class="muted">{phase.steps.map((s) => `${s.label} · ${s.minutes} min`).join('  →  ')}</p>
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
	.sub {
		font-size: 1rem;
		font-weight: 800;
		color: var(--muted);
		margin-bottom: 0.6rem;
	}
</style>
