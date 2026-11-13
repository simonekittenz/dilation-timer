<script lang="ts">
	import { ask } from '#lib/dialog.svelte.ts';
	import DilatorName from '#lib/DilatorName.svelte';
	import Swatch from '#lib/Swatch.svelte';
	import { SLOT_LABELS } from '#lib/schedule.ts';
	import { holdSeconds } from '#lib/stats.ts';
	import { store } from '#lib/store.svelte.ts';
	import { describeSwitch } from '#lib/switchHistory.ts';

	const groups = $derived(
		Object.entries(
			store.log.reduce<Record<string, typeof store.log>>((acc, e) => {
				(acc[e.date] ??= []).push(e);
				return acc;
			}, {})
		).sort(([a], [b]) => b.localeCompare(a))
	);
	const time = (ms: number) =>
		new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	const mins = (sec: number) => `${Math.round(sec / 60)} min`;
</script>

<h1>History 📖</h1>

{#if store.log.some((e) => !e.skipped)}
	<a class="statslink" href="/history/stats" data-testid="stats-link">
		<span class="text">
			<span class="label">Statistics</span>
			<span class="hint">Time per dilator, your days and streaks, swap times</span>
		</span>
		<span class="chev" aria-hidden="true">›</span>
	</a>
{/if}

{#if groups.length === 0}
	<p class="card muted">No sessions logged yet. Your first one will show up here ✿</p>
{/if}

{#each groups as [date, entries] (date)}
	<h2>
		{date} <span class="muted">· {entries.length} session{entries.length === 1 ? '' : 's'}</span>
	</h2>
	{#each entries as e (e.id)}
		<div class="card entry">
			<div>
				{#if e.skipped}
					<strong>{e.slot ? SLOT_LABELS[e.slot] : 'Session'} skipped</strong>
					<p class="muted">Marked as skipped at {time(e.startedAt)}</p>
				{:else}
					<strong>{time(e.startedAt)}</strong>
					{#if e.custom}
						<span class="muted">
							(custom session{e.slot
								? `, counted as ${SLOT_LABELS[e.slot].toLowerCase()}`
								: ''})</span
						>
					{:else if e.slot}<span class="muted">
							({SLOT_LABELS[e.slot].toLowerCase()} session)</span
						>{/if}
					<p class="muted chips">
						{#each e.steps as st, i (i)}
							<span class="step"
								><Swatch color={st.color ?? '#ff9ccb'} size={14} />
								<DilatorName label={st.label} nickname={st.nickname} />
								{mins(holdSeconds(e.steps, i))}
								{#if i > 0 && st.switchSeconds !== undefined}<em
										class="swap"
										data-testid="swap-time"
										>(Swap time: {describeSwitch(st.switchSeconds * 1000)})</em
									>{/if}</span
							>
						{/each}
					</p>
					{#if e.steps[0]?.readySeconds !== undefined}
						<p class="muted ready">
							Ready after {describeSwitch(e.steps[0].readySeconds * 1000)}
						</p>
					{/if}
				{/if}
			</div>
			<button
				class="btn ghost small"
				onclick={async () =>
					(await ask({
						title: 'Delete this entry?',
						message: 'It will be gone from your history.',
						confirmLabel: 'Yes, delete it',
						cancelLabel: 'Keep it',
						danger: true
					})) && store.removeLog(e.id)}
			>
				Delete
			</button>
		</div>
	{/each}
{/each}

<style>
	/* a row like the ones in the Settings menu */
	.statslink {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		padding: 0.9rem 1.1rem;
		border: 2px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--ink);
		text-decoration: none;
	}
	.statslink:active {
		transform: scale(0.99);
	}
	.statslink .text {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
	.statslink .label {
		font-size: 1rem;
		font-weight: 700;
	}
	.statslink .hint {
		font-size: 0.82rem;
		line-height: 1.35;
		color: var(--muted);
	}
	.statslink .chev {
		flex: none;
		font-size: 1.4rem;
		line-height: 1;
		color: var(--muted);
	}
	h1 {
		margin-bottom: 1rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	h2 {
		font-size: 1rem;
		margin: 1.2rem 0 0.5rem;
	}
	/* one dilator per line, so its swap time has room next to it */
	.chips {
		display: grid;
		gap: 0.15rem;
	}
	/* the whole note moves to the next line when it does not fit, instead of splitting in the middle */
	/* a line that wraps lines up under the name, so a swap note stays with its own dilator */
	.step {
		display: block;
		padding-left: 1.2rem;
		text-indent: -1.2rem;
	}
	.swap {
		text-indent: 0;
		display: inline-block;
		white-space: nowrap;
		font-size: 0.85em;
		opacity: 0.85;
	}
	.entry {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}
</style>
