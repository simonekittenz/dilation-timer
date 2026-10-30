<script lang="ts">
	import { computeStreak } from './streak';
	import { store } from './store.svelte';

	// derived from values that only change when something real does (not on every clock tick)
	const today = $derived(store.today);
	const grace = $derived(store.lateNight?.date ?? null);
	const streak = $derived(computeStreak(store.settings, store.log, today, grace));
	const show = $derived(store.settings.streak !== false && streak.current > 0);
</script>

{#if show}
	<aside class="streak" data-testid="streak" aria-label="Day streak">
		<span class="flame" aria-hidden="true">🔥</span>
		<div class="words">
			<p class="count">{streak.current}-day streak</p>
			<p class="line">
				{#if streak.todayPending}
					Finish today's routine to make it {streak.current + 1}
				{:else if streak.best > streak.current}
					Your best is {streak.best}
				{:else}
					That's your best yet ♡
				{/if}
			</p>
		</div>
	</aside>
{/if}

<style>
	.streak {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.6rem 1rem;
		margin-bottom: 1rem;
		border-radius: 26px;
		border: 2px solid var(--line);
		background: var(--surface);
		box-shadow: 0 3px 0 var(--line);
	}
	.flame {
		font-size: 1.8rem;
		line-height: 1;
	}
	.count {
		font-size: 1.05rem;
		font-weight: 900;
		color: var(--accent-strong);
		line-height: 1.2;
	}
	.line {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--muted);
	}
</style>
