<script lang="ts">
	import { formatScheduleDate } from './dates';
	import { store } from './store.svelte';

	const note = $derived(store.pushBackNote);
	const ref = $derived(Number(store.settings.startDate.slice(0, 4)));
</script>

{#if note}
	<aside class="note card" data-testid="push-back-note" role="status">
		<p>
			Pushed back {note.days === 7 ? '1 week' : `${note.days} day${note.days === 1 ? '' : 's'}`} ♡
			<strong>{note.phaseLabel}</strong> now starts on {formatScheduleDate(note.startsOn, ref)}.
		</p>
		<div class="actions">
			<button class="btn ghost small" onclick={() => store.undoPushBack()}>Undo</button>
			<button class="btn ghost small" onclick={() => store.dismissPushBackNote()}>OK</button>
		</div>
	</aside>
{/if}

<style>
	.note {
		display: grid;
		gap: 0.6rem;
		margin-bottom: 1rem;
		font-weight: 600;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
</style>
