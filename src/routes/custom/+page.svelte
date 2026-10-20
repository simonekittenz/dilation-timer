<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		MAX_TOTAL,
		MIN_TOTAL,
		baseSteps,
		defaultTotal,
		formatDuration,
		inferCustomSteps,
		totalMinutes
	} from '#lib/customSession.ts';
	import { dayNumber } from '#lib/dates.ts';
	import DilatorName from '#lib/DilatorName.svelte';
	import Mascot from '#lib/Mascot.svelte';
	import { SLOT_EMOJI, isOpen } from '#lib/schedule.ts';
	import StepsEditor from '#lib/StepsEditor.svelte';
	import { store } from '#lib/store.svelte.ts';
	import Swatch from '#lib/Swatch.svelte';
	import type { SlotId, Step } from '#lib/types.ts';

	const dilators = $derived(store.settings.dilators);
	const routineFor = () =>
		baseSteps(store.settings.phases, dayNumber(store.settings.startDate, store.today));
	// today's routine is what the quick buttons stretch or squeeze
	const base = $derived(routineFor());
	const firstRoutine = routineFor(); // only for where the slider and ticks start

	// the first-run questions come first
	$effect(() => {
		if ((store.settings.setup ?? 'done') !== 'done') void goto('/', { replace: true });
	});

	let stage = $state<'pick' | 'review'>('pick');
	let total = $state(defaultTotal(firstRoutine));
	let selected = $state<string[]>([...new Set(firstRoutine.map((s) => s.dilatorId))]);
	let steps = $state<Step[]>([]);
	let dropped = $state<string[]>([]);

	const openSlots = $derived(store.todaySlots.filter(isOpen));
	// which schedule slot this stands in for; null is an extra session
	let slotChoice = $state<{ slot: SlotId | null } | null>(null);
	const slot = $derived(slotChoice ? slotChoice.slot : (store.nextSlot?.slot ?? null));

	const planned = $derived(totalMinutes(steps));
	const valid = $derived(
		steps.length > 0 &&
			steps.every((s) => Number.isFinite(Number(s.minutes)) && Number(s.minutes) > 0)
	);
	const nameOf = (id: string) => dilators.find((d) => d.id === id)?.name ?? 'Dilator';

	function next() {
		const result = inferCustomSteps(
			base,
			selected,
			dilators.map((d) => d.id),
			total
		);
		steps = result.steps;
		dropped = result.dropped;
		stage = 'review';
	}

	function start() {
		if (!valid) return;
		if (store.startCustom($state.snapshot(steps), slot)) void goto('/');
	}
</script>

<header>
	<a class="back" href="/">← Today</a>
	<h1>Custom session <span class="sparkle">✨</span></h1>
</header>

{#if store.active}
	<section class="card note">
		<Mascot size={80} />
		<p>A session is already running.</p>
		<a class="btn" href="/">Back to the timer</a>
	</section>
{:else if stage === 'pick'}
	<section class="card">
		<p class="muted">
			Pick how long you have. I'll take today's routine and stretch or squeeze it to fit, in blocks
			of 5 minutes.
		</p>
		<div class="how-long">
			<span class="label">How long?</span>
			<strong class="big" data-testid="total">{formatDuration(total)}</strong>
		</div>
		<input
			type="range"
			min={MIN_TOTAL}
			max={MAX_TOTAL}
			step="5"
			bind:value={total}
			aria-label="Session length in minutes"
		/>
		<div class="presets">
			<button class="btn small" class:ghost={total !== 60} onclick={() => (total = 60)}>
				1 hour
			</button>
			<button class="btn small" class:ghost={total !== 120} onclick={() => (total = 120)}>
				2 hours
			</button>
		</div>
	</section>

	<section class="card">
		<h2>Which dilators?</h2>
		<div class="picks">
			{#each dilators as d (d.id)}
				<label class="pick" class:on={selected.includes(d.id)}>
					<input type="checkbox" bind:group={selected} value={d.id} />
					<Swatch color={d.color} size={22} />
					<span class="grow" title={d.diameterMm ? `${d.diameterMm} mm` : undefined}
						><DilatorName label={d.name} nickname={d.nickname} /></span
					>
				</label>
			{/each}
		</div>
	</section>

	<button class="btn huge" disabled={selected.length === 0} onclick={next}>Next →</button>
{:else}
	<section class="card">
		<h2>Does this look right?</h2>
		<p class="muted" data-testid="plan-total">
			<strong>{formatDuration(planned)}</strong>
			in total{planned !== total ? ` (you picked ${formatDuration(total)})` : ''}. Change anything
			you like.
		</p>
		<StepsEditor bind:steps {dilators} newMinutes={5} minuteStep={5} />
		{#if dropped.length > 0}
			<p class="warn" data-testid="dropped">
				There isn't 5 minutes for every dilator, so I left out {dropped.map(nameOf).join(', ')}.
			</p>
		{/if}
	</section>

	<section class="card">
		<h2>This counts as</h2>
		<div class="presets">
			{#each openSlots as s (s.slot)}
				<button
					class="btn small"
					class:ghost={slot !== s.slot}
					onclick={() => (slotChoice = { slot: s.slot })}
				>
					{SLOT_EMOJI[s.slot]}
					{s.label}
				</button>
			{/each}
			<button
				class="btn small"
				class:ghost={slot !== null}
				onclick={() => (slotChoice = { slot: null })}
			>
				Extra
			</button>
		</div>
		<small class="muted">
			{slot
				? "It takes the place of that session in today's schedule."
				: "An extra session; today's schedule stays as it is."}
		</small>
	</section>

	<button class="btn huge" disabled={!valid} onclick={start}>Start custom session</button>
	<button class="btn ghost" onclick={() => (stage = 'pick')}>← Back</button>
{/if}

<style>
	header {
		margin-bottom: 1rem;
	}
	.back {
		font-weight: 800;
		color: var(--accent-strong);
		text-decoration: none;
	}
	h1 {
		font-size: 1.7rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	h2 {
		font-size: 1.15rem;
		font-weight: 900;
		margin-bottom: 0.6rem;
	}
	.card {
		display: grid;
		gap: 0.7rem;
		margin-bottom: 1rem;
	}
	.note {
		justify-items: center;
		text-align: center;
	}
	.how-long {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.label {
		font-weight: 800;
	}
	.big {
		font-size: 1.8rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--accent);
	}
	.presets {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.picks {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.5rem 0.6rem;
		border-radius: var(--radius);
		border: 2px solid var(--line);
		background: var(--surface);
		cursor: pointer;
	}
	.pick.on {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent-soft) 45%, var(--surface));
	}
	.pick input {
		width: 1.2rem;
		height: 1.2rem;
		accent-color: var(--accent);
	}
	.grow {
		flex: 1;
		min-width: 0;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.warn {
		color: var(--warn);
		font-weight: 800;
		font-size: 0.9rem;
	}
	.btn.huge {
		width: 100%;
		margin-bottom: 0.7rem;
	}
</style>
