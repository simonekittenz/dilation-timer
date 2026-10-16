<script lang="ts">
	import { formatClock } from './dates';
	import { isLastStep, remainingMs, stepDurationMs } from './session';
	import { store } from './store.svelte';

	const s = $derived(store.active!);
	const left = $derived(remainingMs(s, store.now));
	const progress = $derived(
		s.phase === 'running' ? Math.min(1, Math.max(0, 1 - left / stepDurationMs(s))) : 1
	);
	const nextLabel = $derived(isLastStep(s) ? null : s.steps[s.stepIndex + 1].label);
	const overtime = $derived(Math.max(0, -left));
</script>

<section class="timer" class:alert={s.phase !== 'running'}>
	<ol class="steps">
		{#each s.steps as step, i (i)}
			<li class:done={i < s.stepIndex} class:current={i === s.stepIndex}>{step.label}</li>
		{/each}
	</ol>

	{#if s.phase === 'running'}
		<p class="label">{s.steps[s.stepIndex].label}</p>
		<p class="clock" aria-live="off">{formatClock(left)}</p>
		<div class="bar"><span style:width="{progress * 100}%"></span></div>
		<p class="muted hint">
			{#if nextLabel}Next up: {nextLabel}{:else}Last one this session{/if}
		</p>
		<button
			class="btn ghost"
			onclick={() => confirm('Stop this session without logging it?') && store.cancel()}
		>
			Cancel session
		</button>
	{:else if s.phase === 'switch'}
		<p class="label">Time to switch!</p>
		<p class="big">Swap to <strong>{nextLabel}</strong></p>
		<p class="muted hint">Overtime {formatClock(overtime)}</p>
		<button class="btn huge" onclick={() => store.confirm()}>I switched ✓</button>
		<p class="muted hint">The next timer starts when you press.</p>
	{:else}
		<p class="label">All done!</p>
		<p class="big">Take the last one out 🌸</p>
		<p class="muted hint">Overtime {formatClock(overtime)}</p>
		<button class="btn huge" onclick={() => store.confirm()}>Finished ✓</button>
	{/if}
</section>

<style>
	.timer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		text-align: center;
		padding: 1.5rem 1rem;
		border-radius: 28px;
		background: var(--surface);
		border: 1px solid var(--line);
	}
	.timer.alert {
		border-color: var(--warn);
	}
	.steps {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		justify-content: center;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.steps li {
		padding: 0.2rem 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.85rem;
	}
	.steps li.done {
		background: var(--ok);
		color: var(--bg);
		border-color: var(--ok);
	}
	.steps li.current {
		border-color: var(--accent);
		color: var(--ink);
		font-weight: 700;
	}
	.label {
		font-size: 1.1rem;
		color: var(--muted);
		font-weight: 600;
	}
	.clock {
		font-size: clamp(4rem, 22vw, 6.5rem);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}
	.big {
		font-size: 1.6rem;
	}
	.bar {
		width: 100%;
		height: 10px;
		background: var(--line);
		border-radius: 999px;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
		transition: width 0.25s linear;
	}
	.hint {
		font-size: 0.9rem;
	}
	.huge {
		width: 100%;
		padding: 1.6rem 1rem;
		font-size: 1.6rem;
		background: var(--warn);
		color: #fff;
	}
</style>
