<script lang="ts">
	import { PALETTE } from '#lib/dilators.ts';
	import { useSettingsForm } from '#lib/settingsForm.svelte.ts';

	const form = useSettingsForm();
	const draft = form.draft;
	const hasDate = $derived(form.hasDate);
	const inUse = $derived(form.inUse);

	function addDilator() {
		draft.dilators.push({
			id: `d-${crypto.randomUUID().slice(0, 8)}`,
			name: `Dilator ${draft.dilators.length}`,
			color: PALETTE[draft.dilators.length % PALETTE.length]
		});
	}
</script>

<div class="panel">
	<label class="item">
		<span class="text">
			<span class="label">Day 1 (your surgery date)</span>
			<span class="hint">
				The WIH program starts with 7 packing days, so dilation typically begins on day 8. You can
				change that under Your schedule.
			</span>
		</span>
		<input
			type="date"
			value={hasDate ? draft.startDate : ''}
			oninput={(e) => form.setStartDate(e.currentTarget.value)}
			aria-label="Surgery date (Day 1)"
		/>
	</label>
	<div class="block">
		<span class="label">Your dilators</span>
		<p class="hint">Set these up once. Phases in your schedule just pick a dilator and a time.</p>
	</div>
	{#each draft.dilators as d, di (d.id)}
		<div class="block dilator">
			<div class="row">
				<input type="color" class="color" bind:value={d.color} aria-label="{d.name} color" />
				<input class="grow" bind:value={d.name} aria-label="Dilator name" />
				<button
					class="pill"
					onclick={() => draft.dilators.splice(di, 1)}
					disabled={inUse.has(d.id)}
					title={inUse.has(d.id) ? 'Used in a phase' : 'Remove'}
					aria-label="Remove {d.name}">✕</button
				>
			</div>
			<div class="row">
				<input
					class="grow"
					bind:value={d.nickname}
					placeholder="Nickname (optional), e.g. Sunny"
					aria-label="{d.name} nickname"
				/>
				<input
					type="number"
					min="1"
					class="num"
					placeholder="mm"
					bind:value={d.diameterMm}
					aria-label="Diameter in mm"
				/>
				<span class="hint">mm</span>
			</div>
		</div>
	{/each}
	<div class="block actions-row">
		<button class="pill strong" onclick={addDilator}>+ Add dilator</button>
	</div>
</div>
