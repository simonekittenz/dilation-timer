<script lang="ts">
	import { store } from '$lib/store.svelte';

	const groups = $derived(
		Object.entries(
			store.log.reduce<Record<string, typeof store.log>>((acc, e) => {
				(acc[e.date] ??= []).push(e);
				return acc;
			}, {})
		).sort(([a], [b]) => b.localeCompare(a))
	);
	const time = (ms: number) =>
		new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	const mins = (sec: number) => `${Math.round(sec / 60)} min`;
</script>

<h1>History</h1>

{#if groups.length === 0}
	<p class="card muted">No sessions logged yet.</p>
{/if}

{#each groups as [date, entries] (date)}
	<h2>
		{date} <span class="muted">· {entries.length} session{entries.length === 1 ? '' : 's'}</span>
	</h2>
	{#each entries as e (e.id)}
		<div class="card entry">
			<div>
				<strong>{time(e.startedAt)}</strong>
				{#if e.slot}<span class="muted"> (planned {e.slot})</span>{/if}
				<p class="muted">{e.steps.map((s) => `${s.label} ${mins(s.actualSeconds)}`).join(' · ')}</p>
			</div>
			<button
				class="btn ghost small"
				onclick={() => confirm('Delete this entry?') && store.removeLog(e.id)}
			>
				Delete
			</button>
		</div>
	{/each}
{/each}

<style>
	h1 {
		margin-bottom: 1rem;
	}
	h2 {
		font-size: 1rem;
		margin: 1.2rem 0 0.5rem;
	}
	.entry {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}
</style>
