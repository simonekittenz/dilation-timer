<script lang="ts">
	import { updates } from './updates.svelte';
	import { store } from './store.svelte';

	// never interrupt a session
	const show = $derived(updates.showBanner && !store.active);
</script>

{#if show && updates.available}
	<section class="card update" role="status">
		<p class="head">New version available ♡</p>
		<p class="muted">
			Dilation timer {updates.available.version} is ready. Your settings and history stay.
		</p>
		<div class="row">
			<a class="btn small" href={updates.available.downloadUrl}>Download</a>
			<button class="btn ghost small" onclick={() => updates.dismiss()}>Later</button>
		</div>
		<small class="muted">When it has downloaded, open it and tap Install.</small>
	</section>
{/if}

<style>
	.update {
		display: grid;
		gap: 0.5rem;
		text-align: center;
		justify-items: center;
		margin-bottom: 1rem;
	}
	.head {
		font-weight: 900;
		color: var(--accent-strong);
	}
	.row {
		display: flex;
		gap: 0.6rem;
	}
	a.btn {
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}
</style>
