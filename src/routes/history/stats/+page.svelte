<script lang="ts">
	import DilatorName from '#lib/DilatorName.svelte';
	import Spark from '#lib/Spark.svelte';
	import { describeSeconds, holdStats, readyStats, swapStats, totals } from '#lib/stats.ts';
	import { store } from '#lib/store.svelte.ts';

	const log = $derived(store.log);
	const sums = $derived(totals(log, store.now));
	const ready = $derived(readyStats(log));
	const swaps = $derived(swapStats(log));
	const holds = $derived(holdStats(log));
	const nickname = (label: string) =>
		store.settings.dilators.find((d) => d.name === label)?.nickname;
</script>

<svelte:head><title>Statistics · Dilation timer</title></svelte:head>

<a class="back" href="/history">← History</a>
<h1>Statistics 📊</h1>

{#if sums.sessions === 0}
	<p class="card muted" data-testid="no-stats">
		Nothing to show yet. Once you've finished a session, your times will show up here ✿
	</p>
{:else}
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
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.back {
		display: inline-block;
		margin-bottom: 0.4rem;
		font-weight: 800;
		text-decoration: none;
	}
	h1 {
		font-size: 1.6rem;
		font-weight: 900;
		margin-bottom: 0.8rem;
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
