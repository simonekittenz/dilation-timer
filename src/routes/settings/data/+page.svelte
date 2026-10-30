<script lang="ts">
	import { backupFileName, createBackup, describeBackup, parseBackup } from '#lib/backup.ts';
	import { ask } from '#lib/dialog.svelte.ts';
	import { saveTextFile } from '#lib/files.ts';
	import { isNative } from '#lib/platform.ts';
	import { useSettingsForm } from '#lib/settingsForm.svelte.ts';
	import { store } from '#lib/store.svelte.ts';

	const form = useSettingsForm();

	let backupNote = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);

	async function saveBackup() {
		const backup = createBackup($state.snapshot(store.settings), $state.snapshot(store.log));
		try {
			const result = await saveTextFile(backupFileName(), JSON.stringify(backup, null, 2));
			backupNote =
				result === 'cancelled'
					? null
					: { kind: 'ok', text: 'Backup saved. Keep the file somewhere safe ♡' };
		} catch {
			backupNote = { kind: 'error', text: "Couldn't save the backup. Please try again." };
		}
	}

	async function restoreBackup(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		input.value = ''; // so choosing the same file again still works
		if (!file) return;
		const parsed = parseBackup(await file.text());
		if (!parsed.ok) {
			backupNote = { kind: 'error', text: parsed.error };
			return;
		}
		const yes = await ask({
			title: 'Replace everything with this backup?',
			message: `${describeBackup(parsed)}\n\nThis can't be undone.`,
			confirmLabel: 'Yes, restore it',
			cancelLabel: 'Cancel',
			danger: true
		});
		if (!yes) return;
		const result = store.restoreBackup(parsed);
		if (!result.ok) {
			backupNote = { kind: 'error', text: result.error };
			return;
		}
		form.reload();
		backupNote = { kind: 'ok', text: 'Restored ✓ Your history and settings are back.' };
	}
</script>

<div class="panel">
	<div class="block">
		<span class="label">Back up your data 💾</span>
		<p class="hint">
			Your history and settings live only on this device. Save a copy before switching phones, or
			before moving to the app version.
		</p>
		<div class="actions-row">
			<button class="pill strong" onclick={saveBackup}>💾 Save backup</button>
			<label class="pill file">
				📂 Restore backup
				<input type="file" accept="application/json,.json" onchange={restoreBackup} />
			</label>
		</div>
		{#if backupNote}
			<p class="hint note-{backupNote.kind}" role="status">{backupNote.text}</p>
		{/if}
	</div>
	{#if !isNative()}
		<a class="item link" href="/welcome">
			<span class="text">
				<span class="label">Get the Android app</span>
				<span class="hint">or see what the web version can't do</span>
			</span>
			<span aria-hidden="true">→</span>
		</a>
	{/if}
</div>
