<script lang="ts">
	import Mascot from './Mascot.svelte';
	import MascotEars from './MascotEars.svelte';
	import DilatorName from './DilatorName.svelte';
	import Swatch from './Swatch.svelte';
	import { formatClock, formatClockTime } from './dates';
	import { pickMessage } from './messages';
	import {
		ADJUST_MS,
		estimatedFinish,
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
	const finish = $derived(estimatedFinish(s, store.now));
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

	<!-- one row: which dilator you are on, and when the session should be done -->
	<div class="top" class:solo={finish === null}>
		<ol class="steps" aria-label="Dilators" class:many={s.steps.length > 4}>
			{#each s.steps as step, i (i)}
				{@const done = i < s.stepIndex || s.phase === 'finished'}
				{@const now = i === s.stepIndex && s.phase !== 'finished'}
				{@const name = step.nickname ? `${step.label} (${step.nickname})` : step.label}
				<li
					class:done
					class:current={now}
					title={name}
					aria-label={`${name}${done ? ', done' : now ? ', now' : ''}`}
				>
					{#if done}<span class="tick" aria-hidden="true">✓</span>{:else}<Swatch
							color={step.color}
							size={14}
						/>{/if}
					{#if now}<span class="pos">{i + 1}/{s.steps.length}</span>{/if}
				</li>
			{/each}
		</ol>
		{#if finish !== null}
			<p class="eta" data-testid="eta" title="When the session should be done">
				ETA <strong>{formatClockTime(finish)}</strong>
			</p>
		{/if}
	</div>

	{#if s.phase === 'running'}
		<div class="stage">
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
					<div class="pet"><Mascot size={64} /></div>
					<p class="clock">{formatClock(left)}</p>
					<p class="label">
						{#if paused}Paused{:else}
							<DilatorName label={current.label} nickname={current.nickname} />
						{/if}
					</p>
				</div>
			</div>
			{#if bubble && !paused}<p class="bubble">{bubble}</p>{/if}
		</div>

		<div class="pad">
			<div class="row">
				<button
					class="round"
					onclick={() => store.addMinutes(-1)}
					disabled={!canShorten}
					aria-label="Remove one minute"
				>
					<span class="disc">
						<svg viewBox="0 0 24 24" aria-hidden="true"><path class="line" d="M6 12h12" /></svg>
					</span>
					<span class="cap">− 1 min</span>
				</button>
				{#if paused}
					<button class="round main" onclick={() => store.resume()}>
						<span class="disc">
							<svg viewBox="0 0 24 24" aria-hidden="true"
								><path
									class="fill"
									d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.8l-10-6.5A1 1 0 0 0 8 5.5z"
								/></svg
							>
						</span>
						<span class="cap">Continue</span>
					</button>
				{:else}
					<button class="round main" onclick={() => store.pause()}>
						<span class="disc">
							<svg viewBox="0 0 24 24" aria-hidden="true"
								><rect class="fill" x="6" y="5" width="4" height="14" rx="1.5" /><rect
									class="fill"
									x="14"
									y="5"
									width="4"
									height="14"
									rx="1.5"
								/></svg
							>
						</span>
						<span class="cap">Pause</span>
					</button>
				{/if}
				<button class="round" onclick={() => store.addMinutes(1)} aria-label="Add one minute">
					<span class="disc">
						<svg viewBox="0 0 24 24" aria-hidden="true"
							><path class="line" d="M6 12h12M12 6v12" /></svg
						>
					</span>
					<span class="cap">+ 1 min</span>
				</button>
			</div>
			<div class="row second">
				<button class="round small" onclick={() => store.skipStep()}>
					<span class="disc">
						<svg viewBox="0 0 24 24" aria-hidden="true"
							><path
								class="fill"
								d="M5 5.5v13a1 1 0 0 0 1.5.9l8-6.5a1 1 0 0 0 0-1.8l-8-6.5A1 1 0 0 0 5 5.5z"
							/><rect class="fill" x="16.5" y="5" width="3" height="14" rx="1.2" /></svg
						>
					</span>
					<span class="cap">{next ? 'Next dilator' : 'Finish now'}</span>
				</button>
				<button
					class="round small quiet"
					onclick={() => confirm('Stop this session without logging it?') && store.cancel()}
				>
					<span class="disc">
						<svg viewBox="0 0 24 24" aria-hidden="true"
							><path class="line" d="M7 7l10 10M17 7L7 17" /></svg
						>
					</span>
					<span class="cap">Cancel</span>
				</button>
			</div>
		</div>
	{:else if s.phase === 'switch'}
		<div class="stage">
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
		</div>
		<div class="pad">
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
		</div>
	{:else}
		<div class="stage">
			<Mascot mood="done" size={120} />
			<p class="title">All done, you did it! 🎉</p>
			<p class="big">Take the last one out 🌸</p>
			{#if bubble}<p class="bubble">{bubble}</p>{/if}
		</div>
	{/if}
</section>

<style>
	.timer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		text-align: center;
		padding: 1.1rem 1rem 1.4rem;
		border-radius: 36px;
		background: var(--surface);
		border: 3px solid var(--line);
		box-shadow:
			0 6px 0 var(--line),
			var(--shadow);
	}
	/* on a phone the card fills the screen: strip on top, clock in the middle, controls under the thumb */
	@media (max-width: 600px) {
		.timer {
			min-height: calc(100dvh - 4.2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
		}
	}
	.timer.alert {
		border-color: var(--warn);
		animation: glow 0.9s ease-in-out infinite;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
	}
	.top.solo {
		justify-content: center;
	}
	.eta {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		height: 1.9rem;
		padding: 0 0.6rem;
		border-radius: 999px;
		border: 2px solid var(--line);
		background: var(--accent-soft);
		color: var(--muted);
		font-size: 0.78rem;
		font-weight: 800;
		white-space: nowrap;
	}
	.eta strong {
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.stage {
		flex: 1;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}
	.pad {
		width: 100%;
		display: grid;
		justify-items: center;
		gap: 1rem;
	}
	.steps {
		display: flex;
		gap: 0.3rem;
		justify-content: flex-start;
		min-width: 0;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.steps li {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		min-width: 1.9rem;
		height: 1.9rem;
		padding: 0 0.45rem;
		border-radius: 999px;
		border: 2px solid var(--line);
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 800;
	}
	/* five or more dilators: smaller chips and no "3/4", so they and the ETA pill share the row */
	.steps.many {
		gap: 0.2rem;
	}
	.steps.many li {
		min-width: 1.5rem;
		height: 1.6rem;
		padding: 0 0.2rem;
		gap: 0;
	}
	.steps.many .pos {
		display: none;
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
		width: min(82vw, 44dvh, 350px);
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
	/* round controls: icon in a disc, its name underneath (the name hangs below, so the discs line up) */
	.row {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 1.6rem;
		padding-bottom: 1.5rem;
	}
	.row.second {
		gap: 3.2rem;
	}
	.round {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 5.4rem;
		appearance: none;
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: var(--muted);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.disc {
		display: grid;
		place-items: center;
		width: 3.7rem;
		height: 3.7rem;
		border-radius: 50%;
		border: 2px solid var(--line);
		background: var(--surface);
		color: var(--accent-strong);
		box-shadow: 0 3px 0 var(--line);
		transition:
			transform 0.12s ease,
			box-shadow 0.12s ease;
	}
	.round.main .disc {
		width: 5.4rem;
		height: 5.4rem;
		border-color: transparent;
		background: linear-gradient(180deg, var(--accent), var(--accent-strong));
		color: var(--accent-ink);
		box-shadow:
			var(--shadow),
			inset 0 2px 0 rgba(255, 255, 255, 0.45);
	}
	.round.small {
		height: 3rem;
	}
	.round.small .disc {
		width: 3rem;
		height: 3rem;
	}
	.round:active:not(:disabled) .disc {
		transform: translateY(2px);
		box-shadow: 0 1px 0 var(--line);
	}
	.round:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.round:focus-visible .disc {
		outline: 3px solid var(--accent);
		outline-offset: 3px;
	}
	.round.quiet .disc {
		color: var(--muted);
	}
	.cap {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 50%;
		transform: translateX(-50%);
		white-space: nowrap;
		font-size: 0.78rem;
		font-weight: 800;
	}
	.disc svg {
		width: 46%;
		height: 46%;
		overflow: visible;
	}
	.round.main .disc svg {
		width: 44%;
		height: 44%;
	}
	.disc .fill {
		fill: currentColor;
	}
	.disc .line {
		fill: none;
		stroke: currentColor;
		stroke-width: 3;
		stroke-linecap: round;
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
	@media (max-width: 600px) and (max-height: 820px) {
		.timer {
			gap: 0.5rem;
			padding-top: 0.8rem;
		}
		.stage {
			gap: 0.6rem;
		}
		.ring {
			width: min(70vw, 36dvh, 280px);
		}
		.pad {
			gap: 0.6rem;
		}
		.row {
			gap: 1.2rem;
			padding-bottom: 1.3rem;
		}
		.row.second {
			gap: 2.6rem;
		}
		.round {
			height: 4.4rem;
		}
		.round.main .disc {
			width: 4.4rem;
			height: 4.4rem;
		}
		.disc {
			width: 3.1rem;
			height: 3.1rem;
		}
		.round.small {
			height: 2.9rem;
		}
		.round.small .disc {
			width: 2.9rem;
			height: 2.9rem;
		}
		.bubble {
			padding: 0.45rem 0.9rem;
			font-size: 0.85rem;
		}
	}
	/* the smallest screens: the clock matters more than the bunny inside the ring */
	@media (max-width: 600px) and (max-height: 680px) {
		.pet {
			display: none;
		}
		.ring {
			width: min(64vw, 31dvh, 240px);
		}
		.clock {
			font-size: clamp(2.4rem, 13vw, 3.4rem);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.breathe,
		.timer.alert {
			animation: none;
		}
	}
</style>
