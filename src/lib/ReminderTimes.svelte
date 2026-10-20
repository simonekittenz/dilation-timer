<script lang="ts">
	import { SLOT_EMOJI } from './schedule';
	import type { Reminders, SlotId } from './types';

	let {
		value,
		slots,
		onchange
	}: { value: Reminders; slots: SlotId[]; onchange: (next: Reminders) => void } = $props();

	const NAMES: Record<SlotId, string> = {
		morning: 'Morning session',
		evening: 'Evening session',
		daily: 'Daily session'
	};

	function setTime(slot: SlotId, time: string) {
		if (!/^\d{2}:\d{2}$/.test(time)) return; // cleared while editing: keep the old time
		onchange({ ...value, times: { ...value.times, [slot]: time } });
	}
</script>

{#if slots.length === 0}
	<p class="muted">Your schedule has no sessions yet, so there is nothing to remind you about.</p>
{:else}
	<ul class="times">
		{#each slots as slot (slot)}
			<li>
				<label for="reminder-{slot}">
					<span aria-hidden="true">{SLOT_EMOJI[slot]}</span>
					{NAMES[slot]}
				</label>
				<input
					id="reminder-{slot}"
					type="time"
					value={value.times[slot]}
					onchange={(e) => setTime(slot, e.currentTarget.value)}
				/>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.times {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
		width: 100%;
	}
	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-weight: 700;
	}
	input {
		font-size: 1.05rem;
		font-weight: 800;
	}
</style>
