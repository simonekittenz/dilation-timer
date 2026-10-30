<script lang="ts">
	import { dilatorLabel } from './dilators';
	import Stepper from './Stepper.svelte';
	import Swatch from './Swatch.svelte';
	import type { Dilator, Step } from './types';

	let {
		steps = $bindable(),
		dilators,
		keepOne = false,
		newMinutes = 10,
		minuteStep = 1
	}: {
		steps: Step[];
		dilators: Dilator[];
		/** Don't allow removing the last dilator. */
		keepOne?: boolean;
		/** Minutes given to a dilator added with "+ Add dilator". */
		newMinutes?: number;
		minuteStep?: number;
	} = $props();

	const colorOf = (id: string) => dilators.find((d) => d.id === id)?.color ?? '#ff9ccb';
</script>

<div class="stack">
	{#each steps as step, si (si)}
		<div class="row">
			<Swatch color={colorOf(step.dilatorId)} size={26} />
			<select class="grow" bind:value={step.dilatorId} aria-label="Dilator">
				{#each dilators as d (d.id)}
					<option value={d.id}>{dilatorLabel(d)}</option>
				{/each}
			</select>
			<Stepper
				value={Number(step.minutes)}
				min={1}
				step={minuteStep}
				unit="min"
				label="minutes"
				onchange={(n) => (step.minutes = n)}
			/>
			<button
				class="btn ghost small"
				onclick={() => steps.splice(si, 1)}
				disabled={keepOne && steps.length === 1}
				aria-label="Remove dilator">✕</button
			>
		</div>
	{/each}
	<button
		class="btn ghost small"
		onclick={() =>
			steps.push({
				dilatorId: dilators[steps.length % dilators.length]?.id ?? '',
				minutes: newMinutes
			})}
	>
		+ Add dilator
	</button>
</div>

<style>
	.stack {
		display: grid;
		gap: 0.4rem;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.row {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
</style>
