<script lang="ts">
	import { dialog } from './dialog.svelte';
	import Mascot from './Mascot.svelte';

	const open = $derived(dialog.current);
	let safeButton: HTMLButtonElement | undefined = $state();
	// the friendly answer has the focus, so Enter never confirms something destructive by accident
	$effect(() => {
		if (open) safeButton?.focus();
	});
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && dialog.answer(false)} />

{#if open}
	<div class="backdrop" role="presentation" onclick={() => dialog.answer(false)}>
		<div
			class="card"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="dialog-title"
			aria-describedby={open.message ? 'dialog-message' : undefined}
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
		>
			<Mascot size={64} />
			<h2 id="dialog-title">{open.title}</h2>
			{#if open.message}<p id="dialog-message">{open.message}</p>{/if}
			<div class="buttons" class:danger={open.danger}>
				<button class="btn yes" onclick={() => dialog.answer(true)}>
					{open.confirmLabel ?? 'Yes'}
				</button>
				<button class="btn no" bind:this={safeButton} onclick={() => dialog.answer(false)}>
					{open.cancelLabel ?? 'Cancel'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: color-mix(in srgb, var(--ink) 40%, transparent);
		animation: fade 0.15s ease-out;
	}
	.card {
		width: min(380px, 100%);
		max-height: 92dvh;
		overflow-y: auto;
		display: grid;
		justify-items: center;
		gap: 0.6rem;
		padding: 1.3rem 1.2rem 1.2rem;
		border-radius: 28px;
		border: 2px solid var(--accent);
		background: var(--surface);
		box-shadow:
			0 6px 0 var(--line),
			var(--shadow);
		text-align: center;
		outline: none;
		animation: pop 0.22s ease-out;
	}
	h2 {
		font-size: 1.25rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	p {
		white-space: pre-line;
		font-size: 0.95rem;
		color: var(--muted);
	}
	.buttons {
		display: grid;
		gap: 0.5rem;
		width: 100%;
		margin-top: 0.4rem;
	}
	/* a question that is just a question: the answer you asked for is the big button */
	.buttons:not(.danger) .no {
		order: 2;
		background: var(--surface);
		color: var(--accent-strong);
		border: 2px solid var(--accent-soft);
		box-shadow: none;
	}
	/* something that cannot be undone: staying safe is the big button, doing it is the quiet one */
	.buttons.danger .yes {
		order: 2;
		background: var(--surface);
		color: var(--warn);
		border: 2px solid var(--accent-soft);
		box-shadow: none;
	}
	.buttons .btn:focus-visible {
		outline: 3px solid var(--accent-strong);
		outline-offset: 3px;
	}
	@keyframes pop {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card,
		.backdrop {
			animation: none;
		}
	}
</style>
