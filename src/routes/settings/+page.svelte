<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Phase, Settings } from '$lib/types';
	import { store } from '$lib/store.svelte';

	let draft = $state<Settings>($state.snapshot(store.settings));
	let timesText = $state<Record<string, string>>(
		Object.fromEntries(store.settings.phases.map((p) => [p.id, p.times.join(', ')]))
	);

	function addPhase() {
		const last = draft.phases.at(-1);
		const id = crypto.randomUUID();
		if (last && last.toDay === null) last.toDay = last.fromDay;
		draft.phases.push({
			id,
			label: `Phase ${draft.phases.length + 1}`,
			fromDay: (last?.toDay ?? 0) + 1,
			toDay: null,
			times: [],
			steps: [{ label: 'Dilator 1', minutes: 10 }]
		});
		timesText[id] = '';
	}

	function parseTimes(text: string): string[] {
		return text
			.split(/[,\s]+/)
			.filter((t) => /^\d{1,2}:\d{2}$/.test(t))
			.map((t) => t.padStart(5, '0'));
	}

	function save() {
		const phases: Phase[] = draft.phases.map((p) => ({
			...p,
			times: parseTimes(timesText[p.id] ?? ''),
			steps: p.steps.filter((s) => s.minutes > 0)
		}));
		store.updateSettings({ startDate: draft.startDate, phases });
		void goto('/');
	}
</script>

<h1>Settings</h1>

<label class="card field">
	<span>Day 1 is</span>
	<input type="date" bind:value={draft.startDate} />
</label>

<p class="muted note">
	Each phase covers a range of days. Today's schedule is picked from the phase the date falls in.
</p>

{#each draft.phases as phase, pi (phase.id)}
	<section class="card phase">
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
			Session times (e.g. 08:00, 12:30, 18:00)
			<input bind:value={timesText[phase.id]} />
		</label>
		<div class="stack">
			Dilators, in order
			{#each phase.steps as step, si (si)}
				<div class="row">
					<input class="grow" bind:value={step.label} aria-label="Dilator name" />
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
					phase.steps.push({ label: `Dilator ${phase.steps.length + 1}`, minutes: 10 })}
			>
				+ Add dilator
			</button>
		</div>
	</section>
{/each}

<div class="row actions">
	<button class="btn ghost" onclick={addPhase}>+ Add phase</button>
	<button class="btn" onclick={save}>Save</button>
</div>

<style>
	h1 {
		margin-bottom: 1rem;
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
	.phase {
		display: grid;
		gap: 0.8rem;
		margin-bottom: 0.8rem;
	}
	.row {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		flex-wrap: wrap;
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
