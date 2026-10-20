<script lang="ts">
	import { defaultReminders, slotsInSchedule } from './reminders';
	import ReminderTimes from './ReminderTimes.svelte';
	import { store } from './store.svelte';
	import type { Reminders } from './types';

	let open = $state(false);
	let draft = $state<Reminders>(defaultReminders());
	const slots = $derived(slotsInSchedule(store.settings));

	async function turnOn() {
		await store.setReminders({ ...$state.snapshot(draft), enabled: true });
		open = false;
	}
</script>

{#if store.canOfferReminders && slots.length > 0}
	{#if !open}
		<button
			class="btn ghost small offer"
			data-testid="reminders-offer"
			onclick={() => (open = true)}
		>
			⏰ Set up daily reminders
		</button>
	{:else}
		<section class="card setup" data-testid="reminders-setup">
			<h2>Daily reminders ⏰</h2>
			<p class="muted">
				Pick a time for each session. Your phone reminds you, and you can start right from the
				reminder, ask to be reminded again in 30 minutes, or turn that one off.
			</p>
			<ReminderTimes value={draft} {slots} onchange={(next) => (draft = next)} />
			<div class="buttons">
				<button class="btn" onclick={turnOn}>Turn on reminders</button>
				<button class="btn ghost" onclick={() => (open = false)}>Not now</button>
			</div>
		</section>
	{/if}
{/if}

<style>
	.offer {
		justify-self: center;
		margin-top: 1rem;
		display: block;
		margin-inline: auto;
	}
	.setup {
		display: grid;
		gap: 0.7rem;
		margin-top: 1rem;
	}
	h2 {
		font-size: 1.15rem;
		font-weight: 900;
	}
	.buttons {
		display: grid;
		gap: 0.55rem;
	}
</style>
