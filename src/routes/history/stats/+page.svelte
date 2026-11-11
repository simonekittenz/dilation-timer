<script lang="ts">
	import ConsistencyGrid from '#lib/ConsistencyGrid.svelte';
	import { dayNumber } from '#lib/dates.ts';
	import DayBars from '#lib/DayBars.svelte';
	import DilatorName from '#lib/DilatorName.svelte';
	import Spark from '#lib/Spark.svelte';
	import {
		consistency,
		dayCells,
		describeSeconds,
		holdStats,
		readyStats,
		swapStats,
		totals,
		weekdayIndex
	} from '#lib/stats.ts';
	import { store } from '#lib/store.svelte.ts';
	import { computeStreak } from '#lib/streak.ts';

	const WEEKS = 12;
	const RECENT_DAYS = 14;

	const log = $derived(store.log);
	const today = $derived(store.today);
	const sums = $derived(totals(log, store.now));
	const ready = $derived(readyStats(log));
	const swaps = $derived(swapStats(log));
	const holds = $derived(holdStats(log));
	const nickname = (label: string) =>
		store.settings.dilators.find((d) => d.name === label)?.nickname;

	// the grid ends on today and starts on a Monday
	const gridDays = $derived(WEEKS * 7 - (6 - weekdayIndex(today)));
	const grid = $derived(dayCells(store.settings, log, today, gridDays));
	const recent = $derived(grid.slice(-RECENT_DAYS));
	const month = $derived(consistency(grid.slice(-28)));
	// everything since Day 1, for the all-time numbers
	const sinceStart = $derived(
		Math.min(2000, Math.max(1, dayNumber(store.settings.startDate, today)))
	);
	const allTime = $derived(consistency(dayCells(store.settings, log, today, sinceStart)));
	const streak = $derived(computeStreak(store.settings, log, today, store.lateNight?.date ?? null));
	const showStreak = $derived(store.settings.streak !== false);
	const mostTime = $derived(Math.max(1, ...holds.map((d) => d.totalSeconds)));
</script>

<svelte:head><title>Statistics · Dilation timer</title></svelte:head>

<div class="head">
	<a class="back-btn" href="/history" aria-label="Back to History">‹</a>
	<h1>Statistics</h1>
</div>

{#if sums.sessions === 0}
	<p class="card muted" data-testid="no-stats">
		Nothing to show yet. Once you've finished a session, your times will show up here ✿
	</p>
{:else}
	<section class="card" data-testid="stats-holds">
		<h2>Time with each dilator</h2>
		<ul class="rows">
			{#each holds as d (d.label)}
				<li>
					<span class="name"><DilatorName label={d.label} nickname={nickname(d.label)} /></span>
					<span class="nums">
						<strong>{describeSeconds(d.averageSeconds)}</strong>
						<span class="muted">on average · {d.sessions}×</span>
					</span>
					<span class="share" aria-hidden="true">
						<span style:width="{(d.totalSeconds / mostTime) * 100}%"></span>
					</span>
					<span class="total muted">{describeSeconds(d.totalSeconds)} in total</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="card" data-testid="stats-days">
		<h2>Your sessions, day by day</h2>
		<DayBars cells={recent} />
		<h3>The last {WEEKS} weeks</h3>
		<ConsistencyGrid cells={grid} />
		<dl class="grid">
			<div>
				<dt>Days with a session</dt>
				<dd>{month.activeDays} <small>of {month.days}</small></dd>
			</div>
			{#if month.plannedSessions > 0}
				<div>
					<dt>Planned sessions done</dt>
					<dd>{month.doneSessions} <small>of {month.plannedSessions}</small></dd>
				</div>
			{/if}
		</dl>
		<p class="muted note">The last 28 days. Rest days don't count against you.</p>
	</section>

	{#if showStreak}
		<section class="card" data-testid="stats-streak">
			<h2>Streak 🔥</h2>
			<dl class="grid">
				<div>
					<dt>Current</dt>
					<dd>{streak.current} <small>day{streak.current === 1 ? '' : 's'}</small></dd>
				</div>
				<div>
					<dt>Longest</dt>
					<dd>🏆 {streak.best} <small>day{streak.best === 1 ? '' : 's'}</small></dd>
				</div>
				<div>
					<dt>Days with everything done</dt>
					<dd>{allTime.perfectDays}</dd>
				</div>
			</dl>
			<p class="muted note">
				{#if streak.current === 0}
					A streak starts with the next day you finish all of your sessions.
				{:else if streak.todayPending}
					Finish today's routine to make it {streak.current + 1}.
				{:else if streak.best > streak.current}
					Your best is {streak.best}. You're {streak.best - streak.current} day{streak.best -
						streak.current ===
					1
						? ''
						: 's'} away from it.
				{:else}
					That's your longest yet ♡
				{/if}
			</p>
		</section>
	{/if}

	<section class="card" data-testid="stats-total">
		<h2>So far</h2>
		<dl class="grid">
			<div>
				<dt>Sessions</dt>
				<dd>{sums.sessions}</dd>
			</div>
			<div>
				<dt>This week</dt>
				<dd>{sums.thisWeek}</dd>
			</div>
			<div>
				<dt>Time with the dilators</dt>
				<dd>{describeSeconds(sums.seconds)}</dd>
			</div>
		</dl>
	</section>

	<section class="card" data-testid="stats-swaps">
		<h2>Swapping dilators</h2>
		{#if swaps.all}
			<p class="muted note">
				From the timer ending to you pressing "I switched". Swaps you only made after the nudge,
				without asking for more time, are left out.
			</p>
			<dl class="grid">
				<div>
					<dt>Typical</dt>
					<dd>{describeSeconds(swaps.all.typical)}</dd>
				</div>
				<div>
					<dt>Average</dt>
					<dd>{describeSeconds(swaps.all.average)}</dd>
				</div>
				<div>
					<dt>Shortest</dt>
					<dd>{describeSeconds(swaps.all.shortest)}</dd>
				</div>
				<div>
					<dt>Longest</dt>
					<dd>{describeSeconds(swaps.all.longest)}</dd>
				</div>
			</dl>
			<div class="trend">
				<Spark values={swaps.all.values} />
				<span class="muted"
					>{swaps.all.values.length} swaps timed, the latest ones on the right</span
				>
			</div>
			{#if swaps.byLabel.length > 1}
				<h3>Per dilator</h3>
				<ul class="rows">
					{#each swaps.byLabel as d (d.label)}
						<li>
							<span class="name"><DilatorName label={d.label} nickname={nickname(d.label)} /></span>
							<span class="nums">
								<strong>{describeSeconds(d.series.typical)}</strong>
								<span class="muted">
									{describeSeconds(d.series.shortest)} to {describeSeconds(d.series.longest)} ·
									{d.series.values.length}×
								</span>
							</span>
							<Spark values={d.series.values} />
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			<p class="muted">
				No swaps timed yet. They're timed from the second dilator of a session onwards.
			</p>
		{/if}
	</section>

	<section class="card" data-testid="stats-ready">
		<h2>Time to Ready</h2>
		{#if ready}
			<p class="muted note">From pressing Start session to pressing Ready on the first dilator.</p>
			<dl class="grid">
				<div>
					<dt>Typical</dt>
					<dd>{describeSeconds(ready.typical)}</dd>
				</div>
				<div>
					<dt>Latest</dt>
					<dd>{describeSeconds(ready.latest)}</dd>
				</div>
				<div>
					<dt>Shortest</dt>
					<dd>{describeSeconds(ready.shortest)}</dd>
				</div>
				<div>
					<dt>Longest</dt>
					<dd>{describeSeconds(ready.longest)}</dd>
				</div>
			</dl>
			<div class="trend">
				<Spark values={ready.values} />
				<span class="muted">{ready.values.length} sessions, the latest on the right</span>
			</div>
		{:else}
			<p class="muted">Not timed yet. It's noted from your next session.</p>
		{/if}
	</section>
{/if}

<style>
	/* the same title row as the pages inside Settings: a big round back button, then the title */
	.head {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-bottom: 1rem;
	}
	h1 {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 1.7rem;
		font-weight: 900;
		line-height: 1.15;
		color: var(--accent-strong);
	}
	.back-btn {
		flex: none;
		display: grid;
		place-items: center;
		width: 2.7rem;
		height: 2.7rem;
		padding-bottom: 0.2rem;
		border-radius: 50%;
		border: 2px solid var(--accent);
		background: var(--surface);
		color: var(--accent-strong);
		font-size: 2rem;
		font-weight: 800;
		line-height: 1;
		text-decoration: none;
	}
	.back-btn:active {
		transform: scale(0.94);
	}
	.card {
		display: grid;
		gap: 0.7rem;
		margin-bottom: 0.9rem;
	}
	h2 {
		font-size: 1.1rem;
		font-weight: 900;
	}
	h3 {
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--muted);
	}
	.note {
		font-size: 0.85rem;
	}
	.grid {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
		gap: 0.6rem;
	}
	.grid div {
		padding: 0.5rem 0.7rem;
		border-radius: 14px;
		background: var(--bg);
	}
	dt {
		font-size: 0.78rem;
		color: var(--muted);
	}
	dd {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 900;
		color: var(--accent-strong);
		font-variant-numeric: tabular-nums;
	}
	dd small {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--muted);
	}
	.share {
		grid-column: 1 / -1;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--bg);
		overflow: hidden;
	}
	.share span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--accent);
	}
	.total {
		grid-column: 1 / -1;
		font-size: 0.78rem;
		margin-top: -0.35rem;
	}
	.trend {
		display: flex;
		align-items: flex-end;
		gap: 0.8rem;
		font-size: 0.85rem;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}
	.rows li {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0.2rem 0.8rem;
	}
	.name {
		font-weight: 800;
	}
	.nums {
		display: grid;
		justify-items: end;
		font-size: 0.85rem;
	}
	.nums strong {
		font-size: 1rem;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
</style>
