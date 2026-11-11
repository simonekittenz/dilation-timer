<script lang="ts">
	import { formatShortDate } from './dates';
	import { describeSeconds, type DayCell } from './stats';

	/** Weeks as columns (the latest on the right), Monday at the top: a day is a square, darker the longer you were with the dilators. */
	let { cells }: { cells: DayCell[] } = $props();

	const weeks = $derived(
		Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => cells.slice(w * 7, w * 7 + 7))
	);
	const top = $derived(Math.max(1, ...cells.map((c) => c.seconds)));
	/** 1 (a little) to 4 (your longest days). */
	const level = (c: DayCell) => (c.seconds > 0 ? Math.min(4, Math.ceil((c.seconds / top) * 4)) : 0);
	const title = (c: DayCell) =>
		`${formatShortDate(c.date)}: ${
			c.sessions > 0
				? `${c.sessions} session${c.sessions === 1 ? '' : 's'}, ${describeSeconds(c.seconds)}`
				: {
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

<div class="grid" role="img" aria-label="Your sessions week by week">
	<span class="side" aria-hidden="true"
		><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span
		></span></span
	>
	{#each weeks as week, w (w)}
		<div class="week">
			{#each week as c (c.date)}
				<span class="cell {c.kind}" class:today={c.isToday} data-level={level(c)} title={title(c)}
				></span>
			{/each}
		</div>
	{/each}
</div>
<ul class="legend muted" aria-hidden="true">
	<li><span class="cell done" data-level="4"></span> done</li>
	<li><span class="cell partial" data-level="1"></span> some</li>
	<li><span class="cell missed"></span> none</li>
	<li><span class="cell skipped"></span> skipped</li>
	<li><span class="cell rest"></span> rest</li>
</ul>

<style>
	.grid {
		display: flex;
		gap: 4px;
		justify-content: center;
	}
	.side {
		display: grid;
		grid-template-rows: repeat(7, 1fr);
		gap: 4px;
		font-size: 0.62rem;
		font-weight: 800;
		color: var(--muted);
		align-items: center;
		padding-right: 2px;
	}
	.week {
		display: grid;
		grid-template-rows: repeat(7, 1fr);
		gap: 4px;
	}
	.cell {
		display: block;
		width: clamp(0.8rem, 5.4vw, 1.5rem);
		aspect-ratio: 1;
		border-radius: 6px;
		background: transparent;
		border: 2px solid var(--line);
	}
	.cell.before,
	.cell.none {
		border-color: transparent;
	}
	.cell.rest {
		border-style: dotted;
		border-color: var(--accent-soft);
	}
	.cell.missed {
		border-color: var(--line);
	}
	.cell.skipped {
		border-style: dashed;
		border-color: var(--muted);
	}
	.cell.pending {
		border-style: dashed;
		border-color: var(--accent);
	}
	.cell.done,
	.cell.partial {
		border-color: transparent;
		background: var(--accent-strong);
	}
	.cell.partial {
		opacity: 0.55;
	}
	.cell[data-level='1'] {
		background: color-mix(in srgb, var(--accent-strong) 30%, var(--surface));
	}
	.cell[data-level='2'] {
		background: color-mix(in srgb, var(--accent-strong) 55%, var(--surface));
	}
	.cell[data-level='3'] {
		background: color-mix(in srgb, var(--accent-strong) 80%, var(--surface));
	}
	.cell[data-level='4'] {
		background: var(--accent-strong);
	}
	.cell.partial[data-level] {
		opacity: 1;
		border: 2px dashed var(--accent-strong);
	}
	.cell.today {
		outline: 2px solid var(--ink);
		outline-offset: 1px;
	}
	.legend {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.3rem 0.9rem;
		font-size: 0.75rem;
	}
	.legend li {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.legend .cell {
		width: 0.9rem;
	}
</style>
