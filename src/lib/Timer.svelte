<script lang="ts">
	import Mascot from './Mascot.svelte';
	import MascotEars from './MascotEars.svelte';
	import DilatorName from './DilatorName.svelte';
	import Swatch from './Swatch.svelte';
	import { formatClock } from './dates';
	import { pickMessage } from './messages';
	import {
		ADJUST_MS,
		isLastStep,
		isPaused,
		overtimeMs,
		remainingMs,
		stepDurationMs
	} from './session';
	import { store } from './store.svelte';

	const s = $derived(store.active!);
	const left = $derived(remainingMs(s, store.now));
	const paused = $derived(isPaused(s));
	const progress = $derived(
		s.phase === 'running' ? Math.min(1, Math.max(0, 1 - left / stepDurationMs(s))) : 1
	);
	const current = $derived(s.steps[s.stepIndex]);
	const next = $derived(isLastStep(s) ? null : s.steps[s.stepIndex + 1]);
	const overtime = $derived(overtimeMs(s, store.now));
	const escalated = $derived(store.escalated);
	const canShorten = $derived(left >= ADJUST_MS + 1000);
	const bubble = $derived.by(() => {
		const m = store.settings.messages;
		const name = current.nickname || current.label;
		const pet = store.settings.mascot;
		if (s.phase === 'running') {
			const minute = Math.floor((store.now - s.stepStartedAt) / 60_000);
			return pickMessage(m.running, `${s.id}:${s.stepIndex}:${minute}`, name, pet);
		}
		if (s.phase === 'finished') return pickMessage(m.done, `${s.id}:done`, name, pet);
		return null;
	});

	const R = 88;
	const C = 2 * Math.PI * R;
</script>

{#if store.cueActive}
	<MascotEars />
{/if}

<section class="timer" class:alert={escalated}>
	{#if !store.soundReady}
		<p class="soundhint">🔇 Tap anywhere to turn the alarm sound on</p>
	{/if}

	<ol class="steps">
		{#each s.steps as step, i (i)}
			<li
				class:done={i < s.stepIndex || s.phase === 'finished'}
				class:current={i === s.stepIndex && s.phase !== 'finished'}
			>
				<Swatch color={step.color} size={16} />
				{i < s.stepIndex || s.phase === 'finished' ? '✓ ' : ''}<DilatorName
					label={step.label}
					nickname={step.nickname}
				/>
			</li>
		{/each}
	</ol>

	{#if s.phase === 'running'}
		<div class="ring" class:paused>
			<svg viewBox="0 0 200 200" aria-hidden="true">
				<circle class="track" cx="100" cy="100" r={R} />
				<circle
					class="prog"
					cx="100"
					cy="100"
					r={R}
					stroke-dasharray={C}
					stroke-dashoffset={C * (1 - progress)}
				/>
			</svg>
			<div class="inside">
				<Mascot size={64} />
				<p class="clock">{formatClock(left)}</p>
				<p class="label">
					{#if paused}Paused{:else}
						<DilatorName label={current.label} nickname={current.nickname} />{current.diameterMm
							? ` · ${current.diameterMm} mm`
							: ''}
					{/if}
				</p>
			</div>
		</div>
		{#if bubble && !paused}<p class="bubble">{bubble}</p>{/if}

		<div class="controls">
			<button
				class="btn ghost small"
				onclick={() => store.addMinutes(-1)}
				disabled={!canShorten}
				aria-label="Remove one minute"
			>
				− 1 min
			</button>
			{#if paused}
				<button class="btn small main" onclick={() => store.resume()}>▶ Continue</button>
			{:else}
				<button class="btn small main" onclick={() => store.pause()}>⏸ Pause</button>
			{/if}
			<button
				class="btn ghost small"
				onclick={() => store.addMinutes(1)}
				aria-label="Add one minute"
			>
				+ 1 min
			</button>
		</div>
		<div class="controls">
			<button class="btn ghost small" onclick={() => store.skipStep()}>
				{next ? '⏭ Next dilator' : '⏭ Finish now'}
			</button>
			<button
				class="btn ghost small"
				onclick={() => confirm('Stop this session without logging it?') && store.cancel()}
			>
				Cancel session
			</button>
		</div>
	{:else if s.phase === 'switch'}
		<Mascot mood={escalated ? 'alert' : 'happy'} size={110} />
		<p class="title">{escalated ? 'Psst! Time to switch!' : 'Time to switch ♡'}</p>
		<p class="big swap">
			Swap to {#if next}<Swatch color={next.color} size={34} />{/if}
			<strong><DilatorName label={next?.label ?? ''} nickname={next?.nickname} /></strong>
		</p>
		{#if next?.diameterMm}<p class="muted hint">{next.diameterMm} mm</p>{/if}
		<p class="muted hint">
			{#if escalated}
				Overtime {formatClock(overtime)}
			{:else}
				No rush to swap, I'll nudge you louder in {formatClock(store.switchWindowLeft)}
			{/if}
		</p>
		<button
			class="btn huge"
			class:blink={escalated}
			class:breathe={!escalated}
			onclick={() => store.confirm()}
		>
			I switched ✓
		</button>
		{#if escalated}
			<button class="btn ghost" onclick={() => store.chill()}>Chill out, I'm on it!</button>
		{:else}
			<button
				class="btn ghost small"
				onclick={() => store.addSwitchMinute()}
				aria-label="Add one minute before the louder nudge"
			>
				+ 1 min
			</button>
		{/if}
		<p class="muted hint">The next timer starts when you press "I switched".</p>
	{:else}
		<Mascot mood="done" size={120} />
		<p class="title">All done, you did it! 🎉</p>
		<p class="big">Take the last one out 🌸</p>
		{#if bubble}<p class="bubble">{bubble}</p>{/if}
	{/if}
</section>

<style>
	.timer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		text-align: center;
		padding: 1.4rem 1rem 1.6rem;
		border-radius: 36px;
		background: var(--surface);
		border: 3px solid var(--line);
		box-shadow:
			0 6px 0 var(--line),
			var(--shadow);
	}
	.timer.alert {
		border-color: var(--warn);
		animation: glow 0.9s ease-in-out infinite;
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
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.8rem;
		border-radius: 999px;
		border: 2px solid var(--line);
		color: var(--muted);
		font-size: 0.85rem;
		font-weight: 700;
	}
	.steps li.done {
		background: var(--ok);
		color: #fff;
		border-color: var(--ok);
	}
	.steps li.current {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--ink);
	}
	.ring {
		position: relative;
		width: min(78vw, 300px);
		aspect-ratio: 1;
	}
	.ring svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	.track,
	.prog {
		fill: none;
		stroke-width: 12;
	}
	.track {
		stroke: var(--accent-soft);
	}
	.prog {
		stroke: var(--accent-strong);
		stroke-linecap: round;
		transition: stroke-dashoffset 0.25s linear;
	}
	.inside {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
	}
	.clock {
		font-size: clamp(2.8rem, 15vw, 4.2rem);
		font-weight: 900;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		color: var(--accent-strong);
	}
	.label {
		color: var(--muted);
		font-weight: 700;
	}
	.soundhint {
		width: 100%;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--ink);
		font-size: 0.85rem;
		font-weight: 800;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
	}
	.controls .main {
		min-width: 8.5rem;
	}
	.ring.paused .prog {
		opacity: 0.45;
	}
	.ring.paused .clock {
		animation: pulse 1.6s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
		}
	}
	.bubble {
		position: relative;
		max-width: 90%;
		padding: 0.6rem 1rem;
		border-radius: 18px;
		background: var(--accent-soft);
		color: var(--ink);
		font-weight: 700;
		font-size: 0.95rem;
	}
	.title {
		font-size: 1.2rem;
		font-weight: 800;
		color: var(--accent-strong);
	}
	.swap {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.big {
		font-size: 1.5rem;
	}
	.hint {
		font-size: 0.9rem;
	}
	.huge {
		width: 100%;
		padding: 1.5rem 1rem;
		font-size: 1.6rem;
	}
	.breathe {
		animation: breathe 3.5s ease-in-out infinite;
	}
	.blink {
		animation: blink 0.7s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			transform: scale(1.02);
		}
	}
	@keyframes blink {
		0%,
		100% {
			filter: none;
			transform: scale(1);
		}
		50% {
			filter: brightness(1.15) saturate(1.3);
			transform: scale(1.04);
			box-shadow: 0 0 0 10px color-mix(in srgb, var(--warn) 30%, transparent);
		}
	}
	@keyframes glow {
		50% {
			box-shadow:
				0 6px 0 var(--line),
				0 0 34px 8px color-mix(in srgb, var(--warn) 55%, transparent);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.breathe,
		.timer.alert {
			animation: none;
		}
	}
</style>
