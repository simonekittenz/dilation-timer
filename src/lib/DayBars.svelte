<script lang="ts">
	import { formatShortDate } from './dates';
	import { describeSeconds, weekdayIndex, type DayCell } from './stats';

	/** The latest days, oldest first: a bar for how long you were with the dilators each day. */
	let { cells }: { cells: DayCell[] } = $props();

	const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
	const top = $derived(Math.max(1, ...cells.map((c) => c.seconds)));
	const minutes = (seconds: number) => `${Math.round(seconds / 60)}`;
	const name = (c: DayCell) =>
		c.sessions > 0
			? `${formatShortDate(c.date)}: ${c.sessions} session${c.sessions === 1 ? '' : 's'}, ${describeSeconds(c.seconds)}`
			: `${formatShortDate(c.date)}: ${
					{
						missed: 'no session',
						skipped: 'skipped',
						rest: 'rest day',
						pending: 'not yet',
						none: 'nothing planned',
						before: '',
						done: '',
						partial: ''
					}[c.kind]
				}`;
</script>

<div class="bars" role="img" aria-label="Minutes with the dilators, day by day">
	{#each cells as c (c.date)}
		<div class="day" class:today={c.isToday} title={name(c)}>
			<span class="value">{c.seconds > 0 ? minutes(c.seconds) : ''}</span>
			<span class="well">
				<span
					class="bar {c.kind}"
					style:height={c.seconds > 0 ? `${Math.max(8, (c.seconds / top) * 100)}%` : undefined}
				></span>
			</span>
			<span class="mark" aria-hidden="true">
				{#if c.kind === 'skipped'}×{:else if c.kind === 'missed'}·{:else if c.kind === 'rest'}z{/if}
			</span>
			<span class="letter">{LETTERS[weekdayIndex(c.date)]}</span>
			<span class="num">{Number(c.date.slice(8))}</span>
		</div>
	{/each}
</div>
<p class="unit muted">Minutes with the dilators each day</p>

<style>
	.bars {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 3px;
		align-items: end;
	}
	.day {
		display: grid;
		justify-items: center;
		gap: 1px;
		min-width: 0;
		font-size: 0.68rem;
		color: var(--muted);
	}
	.value {
		min-height: 1em;
		font-weight: 800;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.well {
		display: flex;
		align-items: flex-end;
		width: 100%;
		height: 4.5rem;
		justify-content: center;
	}
	.bar {
		width: 70%;
		max-width: 1.2rem;
		min-height: 3px;
		border-radius: 5px 5px 2px 2px;
		background: var(--line);
	}
	.bar.done {
		background: var(--accent-strong);
	}
	.bar.partial {
		background: var(--accent);
	}
	.mark {
		min-height: 1em;
		line-height: 1;
	}
	.letter {
		font-weight: 800;
	}
	.today .letter,
	.today .num {
		color: var(--accent-strong);
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
	.unit {
		margin-top: 0.3rem;
		font-size: 0.78rem;
		text-align: center;
	}
</style>
