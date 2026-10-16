<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { store } from '$lib/store.svelte';

	let { children } = $props();

	// Load saved data before any page script runs (pages copy settings into local drafts).
	if (browser) store.boot();

	const tabs = [
		{ href: '/', label: 'Today', icon: '🌸' },
		{ href: '/history', label: 'History', icon: '📖' },
		{ href: '/settings', label: 'Settings', icon: '🎀' }
	];
</script>

<div class="shell" class:alerting={store.escalated}>
	<main>{@render children()}</main>
	<nav>
		{#each tabs as t (t.href)}
			<a href={t.href} aria-current={page.url.pathname === t.href ? 'page' : undefined}
				><span aria-hidden="true">{t.icon}</span> {t.label}</a
			>
		{/each}
	</nav>
</div>

<style>
	.shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding-top: env(safe-area-inset-top);
	}
	main {
		flex: 1;
		width: min(560px, 100%);
		margin: 0 auto;
		padding: 1.2rem 1rem 7rem;
	}
	nav {
		position: fixed;
		left: 50%;
		bottom: calc(0.8rem + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		display: flex;
		gap: 0.2rem;
		padding: 0.35rem;
		background: var(--surface);
		border: 2px solid var(--line);
		border-radius: 999px;
		box-shadow:
			0 4px 0 var(--line),
			var(--shadow);
	}
	nav a {
		padding: 0.5rem 0.9rem;
		border-radius: 999px;
		color: var(--muted);
		text-decoration: none;
		font-weight: 800;
		font-size: 0.95rem;
		white-space: nowrap;
	}
	nav a[aria-current='page'] {
		background: linear-gradient(180deg, var(--accent), var(--accent-strong));
		color: var(--accent-ink);
	}
	.alerting {
		animation: flash 1s ease-in-out infinite;
	}
	@keyframes flash {
		50% {
			background: color-mix(in srgb, var(--warn) 22%, transparent);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.alerting {
			animation: none;
			background: color-mix(in srgb, var(--warn) 18%, transparent);
		}
	}
</style>
