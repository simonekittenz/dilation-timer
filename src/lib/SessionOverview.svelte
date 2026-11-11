<script lang="ts">
	import { formatDuration } from './customSession';
	import { formatClock, formatClockTime } from './dates';
	import DilatorName from './DilatorName.svelte';
	import { remainingMs, sessionOverview } from './session';
	import { describeSeconds } from './stats';
	import { store } from './store.svelte';
	import Swatch from './Swatch.svelte';

	let { onclose }: { onclose: () => void } = $props();

	const s = $derived(store.active!);
	const overview = $derived(sessionOverview(s, store.now, store.switchWindowFor));
	const left = $derived(remainingMs(s, store.now));
	const swaps = $derived(
		overview.rows.flatMap((r) => (r.swapSeconds !== undefined ? [r.swapSeconds] : []))
	);
	const averageSwap = $derived(
		swaps.length ? swaps.reduce((a, b) => a + b, 0) / swaps.length : null
	);
	const range = (from: number, to: number, estimated: boolean) =>
		`${estimated ? '~' : ''}${formatClockTime(from)} – ${formatClockTime(to)}`;

	let sheet: HTMLElement | undefined = $state();
	$effect(() => sheet?.focus());
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop" role="presentation" onclick={onclose}>
	<div
		class="sheet"
		role="dialog"
		aria-modal="true"
		aria-label="Session overview"
		tabindex="-1"
		bind:this={sheet}
		onclick={(e) => e.stopPropagation()}
		onkeydown={() => {}}
	>
		<header>
			<h2>Your session</h2>
			<button class="close" onclick={onclose} aria-label="Close">✕</button>
		</header>
		<ol class="rows" data-testid="overview">
			{#each overview.rows as row, i (i)}
				<li class={row.status}>
					<span class="mark" aria-hidden="true">
						{#if row.status === 'done'}✓{:else}<Swatch color={row.color} size={16} />{/if}
					</span>
					<span class="what">
						<span class="name"><DilatorName label={row.label} nickname={row.nickname} /></span>
						<span class="when">
							{range(row.startAt, row.endAt, row.estimated)}
							{#if row.status === 'now' && s.phase === 'running'}
								· {formatClock(left)} left{/if}
						</span>
						{#if row.readySeconds !== undefined}
							<span class="extra" data-testid="ready-time">
								Ready after {describeSeconds(row.readySeconds)}
							</span>
						{/if}
						{#if row.swapSeconds !== undefined}
							<span class="extra" data-testid="swap-time">
								Swapped in {describeSeconds(row.swapSeconds)}
							</span>
						{/if}
					</span>
					<span class="len">{formatDuration(row.minutes)}</span>
				</li>
			{/each}
		</ol>
		<dl class="totals">
			<div>
				<dt>Started</dt>
				<dd>{formatClockTime(overview.startedAt)}</dd>
			</div>
			<div>
				<dt>{overview.finishAt === null ? 'Finished' : 'Done around'}</dt>
				<dd>
					{overview.finishAt === null
						? formatClockTime(overview.rows.at(-1)?.endAt ?? store.now)
						: formatClockTime(overview.finishAt)}
				</dd>
			</div>
			<div>
				<dt>Total</dt>
				<dd>{formatDuration(overview.plannedMinutes)}</dd>
			</div>
		</dl>
		{#if averageSwap !== null}
			<p class="swaps" data-testid="swap-average">
				{swaps.length === 1 ? 'One swap' : `${swaps.length} swaps`} so far, about
				<strong>{describeSeconds(averageSwap)}</strong> each
			</p>
		{/if}
		<p class="note">
			Times with ~ are a guess: they move if you pause, add minutes, or switch late.
		</p>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		align-items: end;
		justify-items: center;
		background: color-mix(in srgb, var(--ink) 35%, transparent);
		animation: fade 0.15s ease-out;
	}
	.sheet {
		width: min(520px, 100%);
		max-height: 88dvh;
		overflow-y: auto;
		padding: 1rem 1.1rem calc(1.2rem + env(safe-area-inset-bottom));
		border-radius: 28px 28px 0 0;
		background: var(--surface);
		box-shadow: 0 -8px 30px rgba(255, 105, 170, 0.25);
		outline: none;
		animation: rise 0.2s ease-out;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.6rem;
	}
	h2 {
		font-size: 1.2rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.close {
		width: 2.4rem;
		height: 2.4rem;
		border: 0;
		border-radius: 50%;
		background: color-mix(in srgb, var(--accent-soft) 75%, var(--surface));
		color: var(--accent-strong);
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.65rem 0.2rem;
		border-top: 1px solid var(--line);
	}
	li:first-child {
		border-top: 0;
	}
	.mark {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 50%;
		border: 2px solid var(--line);
		font-size: 0.8rem;
		font-weight: 900;
	}
	li.done .mark {
		background: var(--ok);
		border-color: var(--ok);
		color: #fff;
	}
	li.now .mark {
		border-color: var(--accent-strong);
		background: var(--accent-soft);
	}
	.what {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.name {
		font-weight: 800;
	}
	.when {
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}
	.extra {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.swaps {
		margin: 0.7rem 0 0;
		text-align: center;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.swaps strong {
		color: var(--accent-strong);
	}
	li.now .name,
	li.now .len {
		color: var(--accent-strong);
	}
	li.done .name,
	li.done .when,
	li.done .len {
		opacity: 0.75;
	}
	.len {
		flex: none;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.totals {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin: 0.8rem 0 0;
		padding: 0.7rem 0.8rem;
		border-radius: 18px;
		background: color-mix(in srgb, var(--accent-soft) 45%, var(--surface));
		text-align: center;
	}
	dt {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
	}
	dd {
		margin: 0.1rem 0 0;
		font-weight: 900;
		font-variant-numeric: tabular-nums;
	}
	.note {
		margin-top: 0.7rem;
		font-size: 0.8rem;
		color: var(--muted);
		text-align: center;
	}
	@keyframes rise {
		from {
			transform: translateY(40px);
			opacity: 0;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	/* sideways or on a wide screen: a card in the middle instead of a sheet from the bottom */
	@media (orientation: landscape) and (max-height: 540px), (min-width: 700px) {
		.backdrop {
			align-items: center;
		}
		.sheet {
			max-height: 92dvh;
			border-radius: 28px;
			padding-bottom: 1.2rem;
		}
	}
	/* a short sideways screen: the dilators on the left, the totals beside them */
	@media (orientation: landscape) and (max-height: 540px) {
		.sheet {
			width: min(780px, 100%);
			display: grid;
			grid-template-columns: minmax(0, 1fr) 15rem;
			column-gap: 1.2rem;
			align-content: start;
			padding-top: 0.7rem;
			padding-bottom: 0.8rem;
		}
		header {
			grid-column: 1 / -1;
			margin-bottom: 0.2rem;
		}
		.rows {
			grid-row: 2 / span 2;
		}
		li {
			padding: 0.4rem 0.2rem;
		}
		.totals {
			grid-column: 2;
			grid-template-columns: 1fr;
			margin: 0;
			align-self: start;
		}
		.note {
			grid-column: 2;
			margin-top: 0.4rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet,
		.backdrop {
			animation: none;
		}
	}
</style>
