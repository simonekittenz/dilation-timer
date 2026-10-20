<script lang="ts">
	import Mascot from './Mascot.svelte';
	import { milestoneLine, milestoneTitle, milestoneWhen } from './milestones';
	import { store } from './store.svelte';

	const m = $derived(store.milestone);
</script>

{#if m}
	<aside
		class="milestone"
		class:year={m.kind === 'year'}
		data-testid="milestone"
		aria-label="Milestone"
	>
		<span class="spark s1" aria-hidden="true">✦</span>
		<span class="spark s2" aria-hidden="true">✿</span>
		<span class="spark s3" aria-hidden="true">✦</span>
		<Mascot size={54} animal={store.settings.mascot} />
		<div class="words">
			<p class="when">{milestoneWhen(m.daysAgo)}{m.kind === 'year' ? ' 🎉' : ' ♡'}</p>
			<p class="title">{milestoneTitle(m)}</p>
			<p class="line">{milestoneLine(m)}</p>
		</div>
		<button class="close" onclick={() => store.dismissMilestone(m.id)} aria-label="Dismiss"
			>✕</button
		>
	</aside>
{/if}

<style>
	.milestone {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.7rem 2.6rem 0.7rem 0.7rem;
		margin-bottom: 1rem;
		border-radius: 26px;
		border: 2px solid var(--accent);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--accent-soft) 85%, var(--surface)),
			var(--surface)
		);
		box-shadow: 0 3px 0 var(--line);
		overflow: hidden;
	}
	.milestone.year {
		border-width: 3px;
	}
	.words {
		min-width: 0;
		flex: 1;
	}
	.when {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--accent-strong);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.title {
		font-size: 1.05rem;
		font-weight: 900;
		line-height: 1.2;
		color: var(--ink);
	}
	.line {
		margin-top: 0.15rem;
		font-size: 0.88rem;
		color: var(--muted);
		font-weight: 600;
	}
	.close {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		width: 2.2rem;
		height: 2.2rem;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--muted);
		font-size: 1rem;
		cursor: pointer;
	}
	.close:focus-visible {
		outline: 3px solid var(--accent);
	}
	.spark {
		position: absolute;
		color: var(--accent);
		opacity: 0.55;
		pointer-events: none;
		animation: twinkle 3.2s ease-in-out infinite;
	}
	.s1 {
		top: 0.4rem;
		left: 3.7rem;
		font-size: 0.8rem;
	}
	.s2 {
		bottom: 0.4rem;
		right: 3.2rem;
		font-size: 0.85rem;
		animation-delay: 1s;
	}
	.s3 {
		top: 2.4rem;
		right: 1rem;
		font-size: 0.6rem;
		animation-delay: 2s;
	}
	@keyframes twinkle {
		50% {
			opacity: 0.12;
			transform: scale(0.8);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spark {
			animation: none;
		}
	}
</style>
