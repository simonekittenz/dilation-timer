<script lang="ts">
	import '../app.css';
	import { browser } from '$app/env';
	import { goto } from '$app/navigation';
	import { page, updated } from '$app/state';
	import { isNative } from '#lib/platform.ts';
	import { store } from '#lib/store.svelte.ts';
	import { updates } from '#lib/updates.svelte.ts';
	import { startAnalytics } from '#lib/analytics.ts';
	import { hasSeenWelcome, isStandalonePwa, shouldShowWelcome } from '#lib/welcome.ts';

	let { children } = $props();

	// Load saved data before any page script runs (pages copy settings into local drafts).
	if (browser) {
		store.boot();
		updates.start(); // the Android app only: is there a newer version to download?
		void startAnalytics(); // the website only: anonymous page-view counts
	}

	// Brand-new visitors on the website see the start page once (the app, the installed web app,
	// and anyone who already has data or has chosen never do).
	const showWelcome = $derived(
		browser &&
			page.url.pathname === '/' &&
			shouldShowWelcome({
				native: isNative(),
				standalone: isStandalonePwa(),
				hasData: store.hasSavedData,
				seen: hasSeenWelcome()
			})
	);
	$effect(() => {
		if (showWelcome) void goto('/welcome', { replace: true });
	});

	// A reminder asked for Today (for instance "Start session"): go there from wherever we were.
	let seenReminderOpens = store.reminderOpened;
	$effect(() => {
		const opens = store.reminderOpened;
		if (opens === seenReminderOpens) return;
		seenReminderOpens = opens;
		if (page.url.pathname !== '/') void goto('/');
	});

	// An installed app can sit open in the background for days. When a new version has been
	// deployed, reload into it, but never in the middle of a session.
	$effect(() => {
		if (updated.current && !store.active && !isNative()) location.reload();
	});

	$effect(() => {
		if (isNative()) return;
		const check = () => document.visibilityState === 'visible' && void updated.check();
		document.addEventListener('visibilitychange', check);
		return () => document.removeEventListener('visibilitychange', check);
	});

	// While a session is on screen there is nothing else to look at: no menu, just the timer.
	const focus = $derived(page.url.pathname === '/' && !!store.active);

	const tabs = [
		{ href: '/', label: 'Today', icon: '🌸' },
		{ href: '/history', label: 'History', icon: '📖' },
		{ href: '/settings', label: 'Settings', icon: '🎀' }
	];
</script>

<div class="shell" class:alerting={store.escalated}>
	<main class:focus>
		{#if !showWelcome}{@render children()}{/if}
	</main>
	{#if page.url.pathname !== '/welcome' && !focus}
		<nav>
			{#each tabs as t (t.href)}
				<a href={t.href} aria-current={page.url.pathname === t.href ? 'page' : undefined}
					><span aria-hidden="true">{t.icon}</span> {t.label}</a
				>
			{/each}
		</nav>
	{/if}
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
	main.focus {
		padding-top: 0.6rem;
		padding-bottom: calc(1rem + env(safe-area-inset-bottom));
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
