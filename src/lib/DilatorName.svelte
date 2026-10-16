<script lang="ts">
	let { label, nickname }: { label: string; nickname?: string } = $props();
</script>

{label}{#if nickname}<span class="nick">“{nickname}”</span>{/if}

<style>
	.nick {
		margin-left: 0.3em;
		font-style: italic;
		font-weight: 700;
		color: var(--accent-strong);
	}
</style>
