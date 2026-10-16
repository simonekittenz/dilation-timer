<script lang="ts">
	import { toTimeString } from './dates';
	import { slotsForDate } from './schedule';
	import { store } from './store.svelte';

	const slots = $derived(
		slotsForDate(store.settings, store.today, toTimeString(new Date(store.now)), store.log)
	);
	const firstOpen = $derived(slots.find((s) => s.status !== 'done'));
</script>

{#if slots.length === 0}
	<p class="card muted">Nothing scheduled for today.</p>
{:else}
	<ul class="slots">
		{#each slots as slot (slot.time)}
			<li class="card {slot.status}" class:next={slot === firstOpen}>
				<span class="time">{slot.time}</span>
				<span class="state">
					{#if slot.status === 'done'}Done ✓{:else if slot.status === 'overdue'}Overdue{:else}Later
						♡{/if}
				</span>
				{#if slot.status !== 'done'}
					<button
						class="btn small"
						class:ghost={slot !== firstOpen}
						onclick={() => store.start(slot.time)}
					>
						Start
					</button>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.slots {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.time {
		font-size: 1.3rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.state {
		flex: 1;
		color: var(--muted);
	}
	.done .state {
		color: var(--ok);
	}
	.overdue .state {
		color: var(--warn);
		font-weight: 700;
	}
	.next {
		border-color: var(--accent);
	}
</style>
