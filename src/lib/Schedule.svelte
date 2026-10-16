<script lang="ts">
	import { SLOT_EMOJI, isOpen } from './schedule';
	import { store } from './store.svelte';

	const slots = $derived(store.todaySlots);
	const next = $derived(store.nextSlot);

	const STATE_TEXT = {
		done: 'Done ✓',
		skipped: 'Skipped',
		overdue: 'Overdue',
		due: 'Ready when you are ♡',
		upcoming: 'Later ♡'
	} as const;
</script>

{#if slots.length === 0}
	<p class="card muted">Nothing scheduled for today.</p>
{:else}
	<ul class="slots">
		{#each slots as s (s.slot)}
			<li class="card {s.status}" class:next={s.slot === next?.slot}>
				<span class="emoji" aria-hidden="true">{SLOT_EMOJI[s.slot]}</span>
				<span class="name">
					<strong>{s.label}</strong>
					<span class="state">{STATE_TEXT[s.status]}</span>
				</span>
				{#if isOpen(s)}
					<button class="btn ghost small" onclick={() => store.skip(s.slot)}>Skip</button>
					<button
						class="btn small"
						class:ghost={s.slot !== next?.slot}
						disabled={!!store.active}
						onclick={() => store.start(s.slot)}
					>
						Start
					</button>
				{:else if s.status === 'skipped' && s.entry}
					<button class="btn ghost small" onclick={() => s.entry && store.removeLog(s.entry.id)}>
						Undo
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
		gap: 0.6rem;
	}
	.emoji {
		font-size: 1.6rem;
	}
	.name {
		flex: 1;
		display: grid;
		line-height: 1.2;
	}
	.name strong {
		font-size: 1.15rem;
	}
	.state {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.done .state {
		color: var(--ok);
		font-weight: 700;
	}
	.skipped {
		opacity: 0.75;
	}
	.overdue .state {
		color: var(--warn);
		font-weight: 700;
	}
	.next {
		border-color: var(--accent);
	}
</style>
