<script lang="ts">
	import { goto } from '$app/navigation';
	import { wihPhases } from '$lib/defaults';
	import { PALETTE, stepsInUse, wihDilators } from '$lib/dilators';
	import Swatch from '$lib/Swatch.svelte';
	import { store } from '$lib/store.svelte';
	import type { Phase, Settings } from '$lib/types';

	let draft = $state<Settings>($state.snapshot(store.settings));
	const inUse = $derived(stepsInUse(draft));
	const colorOf = (id: string) => draft.dilators.find((d) => d.id === id)?.color ?? '#ff9ccb';

	function addDilator() {
		draft.dilators.push({
			id: `d-${crypto.randomUUID().slice(0, 8)}`,
			name: `Dilator ${draft.dilators.length}`,
			color: PALETTE[draft.dilators.length % PALETTE.length]
		});
	}

	function addPhase() {
		const last = draft.phases.at(-1);
		const id = crypto.randomUUID();
		if (last && last.toDay === null) last.toDay = last.fromDay;
		draft.phases.push({
			id,
			label: `Phase ${draft.phases.length + 1}`,
			fromDay: (last?.toDay ?? 0) + 1,
			toDay: null,
			slots: ['morning', 'evening'],
			steps: [{ dilatorId: draft.dilators[0]?.id ?? '', minutes: 10 }]
		});
	}

	function resetToWih() {
		if (!confirm('Replace all dilators and phases with the WIH standard program?')) return;
		draft.dilators = wihDilators();
		draft.phases = wihPhases();
	}

	function save() {
		const phases: Phase[] = draft.phases.map((p) => ({
			...p,
			steps: p.steps.filter(
				(s) => s.minutes > 0 && draft.dilators.some((d) => d.id === s.dilatorId)
			)
		}));
		const dilators = draft.dilators.map((d) => ({
			...d,
			name: d.name.trim() || 'Dilator',
			diameterMm: d.diameterMm ? Number(d.diameterMm) : undefined
		}));
		store.updateSettings({
			startDate: draft.startDate,
			leewayMinutes: Math.max(0, Number(draft.leewayMinutes) || 0),
			dilators,
			phases
		});
		void goto('/');
	}
</script>

<h1>Settings 🎀</h1>

<label class="card field">
	<span>Day 1 is</span>
	<input type="date" bind:value={draft.startDate} />
</label>

<label class="card field leeway">
	<span>
		Gentle window
		<small class="muted">Minutes of calm before the alarm gets loud</small>
	</span>
	<input type="number" min="0" step="0.5" class="num" bind:value={draft.leewayMinutes} />
</label>

<details class="card phase" open>
	<summary
		><strong>Your dilators</strong> <span class="muted">· {draft.dilators.length}</span></summary
	>
	<p class="muted note">Set these up once. Phases below just pick a dilator and a time.</p>
	{#each draft.dilators as d, di (d.id)}
		<div class="row dilator">
			<input type="color" class="color" bind:value={d.color} aria-label="{d.name} color" />
			<input class="grow" bind:value={d.name} aria-label="Dilator name" />
			<input
				type="number"
				min="1"
				class="num"
				placeholder="mm"
				bind:value={d.diameterMm}
				aria-label="Diameter in mm"
			/>
			<span class="muted">mm</span>
			<button
				class="btn ghost small"
				onclick={() => draft.dilators.splice(di, 1)}
				disabled={inUse.has(d.id)}
				title={inUse.has(d.id) ? 'Used in a phase' : 'Remove'}
				aria-label="Remove {d.name}">✕</button
			>
		</div>
	{/each}
	<button class="btn ghost small" onclick={addDilator}>+ Add dilator</button>
</details>

<p class="muted note">
	Each phase covers a range of days. Today's schedule is picked from the phase the date falls in.
</p>

{#each draft.phases as phase, pi (phase.id)}
	<details class="card phase">
		<summary>
			<strong>{phase.label}</strong>
			<span class="muted">
				· day {phase.fromDay}{phase.toDay === null
					? '+'
					: phase.toDay === phase.fromDay
						? ''
						: `–${phase.toDay}`}
				· {Math.round(phase.steps.reduce((sum, st) => sum + st.minutes, 0) * 10) / 10} min
			</span>
		</summary>
		<div class="row">
			<input class="grow" bind:value={phase.label} aria-label="Phase name" />
			<button
				class="btn ghost small"
				onclick={() => draft.phases.splice(pi, 1)}
				disabled={draft.phases.length === 1}>Remove</button
			>
		</div>
		<div class="row">
			<label>From day <input type="number" min="1" bind:value={phase.fromDay} class="num" /></label>
			<label>
				To day
				<input
					type="number"
					min="1"
					class="num"
					placeholder="∞"
					value={phase.toDay ?? ''}
					oninput={(e) =>
						(phase.toDay = e.currentTarget.value ? Number(e.currentTarget.value) : null)}
				/>
			</label>
		</div>
		<label class="stack">
			Sessions per day
			<select
				value={phase.slots.length > 1 ? 'two' : 'one'}
				onchange={(e) =>
					(phase.slots = e.currentTarget.value === 'two' ? ['morning', 'evening'] : ['daily'])}
			>
				<option value="one">Once a day</option>
				<option value="two">Morning &amp; evening</option>
			</select>
		</label>
		<div class="stack">
			Dilators, in order
			{#each phase.steps as step, si (si)}
				<div class="row">
					<Swatch color={colorOf(step.dilatorId)} size={26} />
					<select class="grow" bind:value={step.dilatorId} aria-label="Dilator">
						{#each draft.dilators as d (d.id)}
							<option value={d.id}>{d.name}</option>
						{/each}
					</select>
					<input type="number" min="1" class="num" bind:value={step.minutes} aria-label="Minutes" />
					<span class="muted">min</span>
					<button
						class="btn ghost small"
						onclick={() => phase.steps.splice(si, 1)}
						disabled={phase.steps.length === 1}
						aria-label="Remove dilator">✕</button
					>
				</div>
			{/each}
			<button
				class="btn ghost small"
				onclick={() =>
					phase.steps.push({
						dilatorId: draft.dilators[phase.steps.length % draft.dilators.length]?.id ?? '',
						minutes: 10
					})}
			>
				+ Add dilator
			</button>
		</div>
	</details>
{/each}

<div class="row actions">
	<button class="btn ghost" onclick={addPhase}>+ Add phase</button>
	<button class="btn ghost" onclick={resetToWih}>Reset to WIH program</button>
	<button class="btn" onclick={save}>Save</button>
</div>

<style>
	h1 {
		margin-bottom: 1rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.leeway {
		margin-top: 0.6rem;
	}
	.leeway small {
		display: block;
	}
	.field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.note {
		margin: 0.8rem 0;
		font-size: 0.9rem;
	}
	summary {
		cursor: pointer;
		list-style-position: inside;
	}
	.phase {
		margin-bottom: 0.8rem;
	}
	.phase > :not(summary) {
		margin-top: 0.8rem;
	}
	.row {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.color {
		width: 2.4rem;
		height: 2.4rem;
		padding: 0.15rem;
		border-radius: 50%;
		cursor: pointer;
	}
	.dilator {
		margin-bottom: 0.6rem;
	}
	.stack {
		display: grid;
		gap: 0.4rem;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.num {
		width: 4.5rem;
	}
	.actions {
		justify-content: space-between;
		margin-top: 1rem;
	}
</style>
