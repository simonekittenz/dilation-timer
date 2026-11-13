<script lang="ts">
	import { formatShortDate } from './dates';
	import { dayFill, dayLabel, type DayCell } from './stats';

	/**
	 * Weeks as columns (the latest on the right), Monday at the top: a day is a square that fills up as you
	 * finish what the schedule planned for that day. Days with nothing planned are only a dot, so they never
	 * look like a day you missed.
	 */
	let { cells }: { cells: DayCell[] } = $props();

	const weeks = $derived(
		Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => cells.slice(w * 7, w * 7 + 7))
	);
	const title = (c: DayCell) => `${formatShortDate(c.date)}: ${dayLabel(c)}`;
</script>

<div class="grid" role="img" aria-label="Your sessions week by week, compared with your schedule">
	<span class="side" aria-hidden="true"
		><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span
		></span></span
	>
	{#each weeks as week, w (w)}
		<div class="week">
			{#each week as c (c.date)}
				<span
					class="cell {c.kind}"
					class:today={c.isToday}
					class:bonus={c.planned === 0 && c.sessions > 0}
					style:--fill="{dayFill(c)}%"
					title={title(c)}
				></span>
			{/each}
		</div>
	{/each}
</div>
<ul class="legend muted" aria-hidden="true">
	<li><span class="cell done" style:--fill="100%"></span> all done</li>
	<li><span class="cell partial" style:--fill="50%"></span> some</li>
	<li><span class="cell missed"></span> none</li>
	<li><span class="cell skipped"></span> skipped</li>
	<li><span class="cell rest"></span> nothing planned</li>
</ul>
<p class="caption muted">A square fills up as you finish the sessions planned for that day.</p>

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
		display: grid;
		place-items: center;
		width: clamp(0.8rem, 5.4vw, 1.5rem);
		aspect-ratio: 1;
		border-radius: 6px;
		border: 2px solid transparent;
		background: transparent;
	}
	/* a day with sessions planned: an outline that fills from the bottom as they are done */
	.cell.done,
	.cell.partial,
	.cell.missed,
	.cell.skipped,
	.cell.pending {
		border-color: color-mix(in srgb, var(--muted) 45%, var(--surface));
		background: linear-gradient(
			to top,
			var(--accent-strong) var(--fill, 0%),
			transparent var(--fill, 0%)
		);
	}
	.cell.done,
	.cell.partial {
		border-color: var(--accent-strong);
	}
	.cell.bonus {
		/* an extra session on a day with nothing planned */
		border-color: var(--accent-strong);
	}
	.cell.skipped {
		border-style: dashed;
		border-color: var(--muted);
	}
	.cell.pending {
		border-style: dashed;
		border-color: var(--accent);
	}
	/* nothing planned (a rest day): just a small dot, so it never looks like a missed day */
	.cell.rest::after {
		content: '';
		width: 28%;
		height: 28%;
		border-radius: 50%;
		background: var(--accent-soft);
	}
	/* before your schedule started, or nothing covers the day: nothing at all */
	.cell.before,
	.cell.none {
		visibility: hidden;
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
	.caption {
		margin: 0.35rem 0 0;
		text-align: center;
		font-size: 0.75rem;
	}
</style>
