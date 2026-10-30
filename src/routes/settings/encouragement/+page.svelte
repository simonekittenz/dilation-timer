<script lang="ts">
	import Mascot from '#lib/Mascot.svelte';
	import { useSettingsForm } from '#lib/settingsForm.svelte.ts';

	const form = useSettingsForm();
	const draft = form.draft;
	const messageText = form.messageText;
</script>

<div class="panel">
	<fieldset class="block companion">
		<legend class="label">Your little friend</legend>
		<div class="tiles">
			{#each [{ id: 'bunny', label: 'Bunny' }, { id: 'kitty', label: 'Kitty' }] as const as option (option.id)}
				<label class="tile" class:chosen={draft.mascot === option.id}>
					<input type="radio" name="mascot" value={option.id} bind:group={draft.mascot} />
					<Mascot animal={option.id} size={56} />
					<span>{option.label}</span>
				</label>
			{/each}
		</div>
	</fieldset>
	<label class="item">
		<span class="text">
			<span class="label">Celebrate milestones</span>
			<span class="hint">
				A small, dismissible message on Today for each month of your first year and every
				anniversary after, and a cheer on the end screen when you conquer a new dilator
			</span>
		</span>
		<input
			type="checkbox"
			class="toggle"
			checked={draft.celebrations !== false}
			onchange={(e) => (draft.celebrations = e.currentTarget.checked)}
			aria-label="Celebrate milestones"
		/>
	</label>
	<label class="item">
		<span class="text">
			<span class="label">Show my streak</span>
			<span class="hint">
				On Today, how many days in a row you did all of your sessions. Rest days don't break it, a
				skipped session does.
			</span>
		</span>
		<input
			type="checkbox"
			class="toggle"
			checked={draft.streak !== false}
			onchange={(e) => (draft.streak = e.currentTarget.checked)}
			aria-label="Show my streak"
		/>
	</label>
	<details>
		<summary><span class="label">Encouraging messages</span></summary>
		<div class="body">
			<p class="hint">
				One message per line. A random one pops up in a little bubble. Use <code>{'{name}'}</code>
				to drop in the dilator's nickname (or name). Leave a box empty to turn those off.
			</p>
			<label class="stack">
				<span class="label small">While a timer runs (changes every minute)</span>
				<textarea rows="6" bind:value={messageText.running}></textarea>
			</label>
			<label class="stack">
				<span class="label small">When a session is finished</span>
				<textarea rows="5" bind:value={messageText.done}></textarea>
			</label>
			<div class="actions-row">
				<button class="pill" onclick={() => form.resetMessages()}>Reset messages to defaults</button
				>
			</div>
		</div>
	</details>
</div>
