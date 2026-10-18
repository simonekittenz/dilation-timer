<script lang="ts">
	import { goto } from '$app/navigation';
	import { addDays, formatLongDate, formatShortDate } from './dates';
	import Mascot from './Mascot.svelte';
	import { summarizeWeek } from './setup';
	import { store } from './store.svelte';

	let picked = $state('');
	const valid = $derived(/^\d{4}-\d{2}-\d{2}$/.test(picked));

	const stage = $derived(store.settings.setup);
	const week = $derived(summarizeWeek(store.settings, store.today));
	const range = $derived(
		week.phaseStart
			? week.phaseEnd
				? week.phaseEnd === week.phaseStart
					? formatShortDate(week.phaseStart)
					: `${formatShortDate(week.phaseStart)} – ${formatShortDate(week.phaseEnd)}`
				: `${formatShortDate(week.phaseStart)} onwards`
			: ''
	);
	const inDays = (n: number) => (n === 1 ? 'tomorrow' : `in ${n} days`);

	function yes() {
		store.finishSetup();
	}

	function no() {
		store.finishSetup();
		void goto('/settings');
	}
</script>

{#if stage === 'ask-date'}
	<section class="card setup">
		<Mascot size={96} />
		<h2>When was your surgery? 🌸</h2>
		<p class="muted">
			That day is Day 1. I'll use it to work out where you are in your schedule. You can change it
			any time in Settings.
		</p>
		<label class="field">
			<span>Surgery date</span>
			<input type="date" bind:value={picked} aria-label="Surgery date" />
			<small class="muted">Tap the box to choose the date</small>
		</label>
		<button class="btn" disabled={!valid} onclick={() => store.chooseSurgeryDate(picked)}>
			Continue →
		</button>
	</section>
{:else if stage === 'confirm'}
	<section class="card setup" data-testid="confirm-week">
		<Mascot size={96} />
		<h2>Does this look right?</h2>
		<p class="muted">
			Surgery on <strong>{formatLongDate(week.surgeryDate)}</strong>, which is Day 1.
		</p>

		<div class="here">
			{#if week.state === 'before-surgery'}
				<p class="big">Your surgery is {inDays(week.daysUntilSurgery!)}</p>
				<p class="muted">Day 1 will be that day, and I'll start counting then.</p>
			{:else if week.state === 'beyond'}
				<p class="big">Day {week.day}</p>
				<p class="muted">
					With that date, nothing in the plan covers today. Check the date, or change the plan in
					Settings.
				</p>
			{:else}
				<p class="big">Today is Day {week.day} · {week.phase?.label}</p>
				<p class="muted">{range}</p>
				{#if week.state === 'rest'}
					<p>
						No dilation yet.
						{#if week.daysUntilDilation != null}
							Your first session is {inDays(week.daysUntilDilation)}, on
							{formatShortDate(week.firstDilationDate!)}.
						{/if}
					</p>
				{:else}
					<p>
						{week.sessionsPerDay === 1 ? 'One session' : `${week.sessionsPerDay} sessions`} a day, about
						{week.minutesPerSession} minutes each.
					</p>
				{/if}
			{/if}
		</div>

		<div class="buttons">
			<button class="btn" onclick={yes}>Yes, that looks right ✓</button>
			<button class="btn ghost" onclick={no}>No, take me to Settings</button>
		</div>
	</section>
{/if}

<style>
	.setup {
		display: grid;
		justify-items: center;
		gap: 0.8rem;
		text-align: center;
		padding: 1.4rem 1.1rem;
	}
	h2 {
		font-size: 1.4rem;
		font-weight: 900;
	}
	.field {
		display: grid;
		gap: 0.3rem;
		justify-items: center;
		font-weight: 700;
	}
	.field input {
		font-size: 1.1rem;
		padding: 0.6rem 0.9rem;
	}
	.here {
		display: grid;
		gap: 0.2rem;
		width: 100%;
		padding: 0.9rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--accent-soft) 55%, var(--surface));
		border: 2px solid var(--accent);
	}
	.big {
		font-size: 1.25rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.buttons {
		display: grid;
		gap: 0.6rem;
		width: 100%;
	}
</style>
