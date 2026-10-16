<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { store } from '$lib/store.svelte';

	let { children } = $props();

	onMount(() => store.boot());

	const tabs = [
		{ href: '/', label: 'Today' },
		{ href: '/history', label: 'History' },
		{ href: '/settings', label: 'Settings' }
	];
</script>

<div class="shell" class:alerting={store.active && store.active.phase !== 'running'}>
	<main>{@render children()}</main>
	<nav>
		{#each tabs as t (t.href)}
			<a href={t.href} aria-current={page.url.pathname === t.href ? 'page' : undefined}>{t.label}</a
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
		padding: 1.2rem 1rem 6rem;
	}
	nav {
		position: fixed;
		inset: auto 0 0 0;
		display: flex;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.6rem 0.6rem calc(0.6rem + env(safe-area-inset-bottom));
		background: color-mix(in srgb, var(--bg) 85%, transparent);
		backdrop-filter: blur(10px);
		border-top: 1px solid var(--line);
	}
	nav a {
		padding: 0.5rem 1.1rem;
		border-radius: 999px;
		color: var(--muted);
		text-decoration: none;
		font-weight: 600;
	}
	nav a[aria-current='page'] {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.alerting {
		animation: flash 1s ease-in-out infinite;
	}
	@keyframes flash {
		50% {
			background: color-mix(in srgb, var(--warn) 35%, var(--bg));
		}
	}
</style>
