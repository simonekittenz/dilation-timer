<script lang="ts">
	import { RECENT } from './stats';

	/** Seconds, oldest first. A little row of bars for the latest ones, the newest on the right. */
	let { values }: { values: number[] } = $props();

	const recent = $derived(values.slice(-RECENT));
	const top = $derived(Math.max(1, ...recent));
</script>

{#if recent.length > 1}
	<span class="spark" aria-hidden="true">
		{#each recent as v, i (i)}
			<span class="bar" class:latest={i === recent.length - 1} style:height="{(v / top) * 100}%"
			></span>
		{/each}
	</span>
{/if}

<style>
	.spark {
		display: inline-flex;
		align-items: flex-end;
		gap: 3px;
		height: 2rem;
	}
	.bar {
		width: 6px;
		min-height: 3px;
		border-radius: 3px 3px 1px 1px;
		background: var(--accent-soft);
	}
	.bar.latest {
		background: var(--accent-strong);
	}
</style>
