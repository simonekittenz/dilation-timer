<script lang="ts">
	import { nextStep } from './stepper';

	let {
		value,
		onchange,
		min = 1,
		max = Infinity,
		step = 1,
		unit = '',
		display,
		label
	}: {
		value: number;
		onchange: (next: number) => void;
		min?: number;
		max?: number;
		/** How far − and + go. With a step of 5, 7 goes to 10 and 10 goes to 5, so values land on the grid. */
		step?: number;
		unit?: string;
		/** Text to show instead of the number (for instance a date), when the number means little on its own. */
		display?: string;
		label: string;
	} = $props();

	const clamp = (n: number) => Math.min(max, Math.max(min, n));

	function bump(direction: 1 | -1) {
		onchange(clamp(nextStep(Number(value), direction, step)));
	}

	function typed(input: HTMLInputElement) {
		const n = Number(input.value);
		if (input.value.trim() === '' || !Number.isFinite(n)) {
			input.value = String(value); // keep the old value if it was cleared or is not a number
			return;
		}
		onchange(clamp(n));
		input.value = String(clamp(n));
	}
</script>

<div class="stepper">
	<button
		type="button"
		class="step"
		aria-label="Less {label}"
		onclick={() => bump(-1)}
		disabled={Number(value) <= min}>−</button
	>
	{#if display !== undefined}
		<span class="val shown" aria-label={label}>{display}</span>
	{:else}
		<label class="val">
			<input
				class="field"
				type="number"
				inputmode="decimal"
				{min}
				{value}
				aria-label={label}
				onchange={(e) => typed(e.currentTarget)}
			/>
			{#if unit}<span class="unit">{unit}</span>{/if}
		</label>
	{/if}
	<button
		type="button"
		class="step"
		aria-label="More {label}"
		onclick={() => bump(1)}
		disabled={Number(value) >= max}>+</button
	>
</div>

<style>
	.stepper {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
	}
	.step {
		flex: none;
		width: 2.2rem;
		height: 2.2rem;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: color-mix(in srgb, var(--accent-soft) 75%, var(--surface));
		color: var(--accent-strong);
		font: inherit;
		font-size: 1.3rem;
		font-weight: 800;
		line-height: 1;
		cursor: pointer;
	}
	.step:active:not(:disabled) {
		transform: scale(0.92);
	}
	.step:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.val {
		display: inline-flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.2rem;
		min-width: 3.6rem;
	}
	.val.shown {
		min-width: 5.6rem;
		font-size: 1rem;
		font-weight: 800;
		color: var(--ink);
	}
	.stepper .field {
		width: 2.6rem;
		padding: 0.2rem 0;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 1rem;
		font-weight: 800;
		text-align: right;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	.stepper .field::-webkit-outer-spin-button,
	.stepper .field::-webkit-inner-spin-button {
		appearance: none;
		margin: 0;
	}
	.stepper .field:focus {
		background: color-mix(in srgb, var(--accent-soft) 50%, var(--surface));
	}
	.unit {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--muted);
	}
</style>
