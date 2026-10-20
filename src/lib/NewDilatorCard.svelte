<script lang="ts">
	import { addDays, formatScheduleDate } from './dates';
	import DilatorName from './DilatorName.svelte';
	import Mascot from './Mascot.svelte';
	import { timesPerDay } from './newDilators';
	import { store } from './store.svelte';
	import Swatch from './Swatch.svelte';

	const intro = $derived(store.dilatorIntro);
	let pushing = $state(false);

	const many = $derived((intro?.dilators.length ?? 0) > 1);
	const ref = $derived(Number(store.settings.startDate.slice(0, 4)));
	const phaseStart = $derived(
		intro ? addDays(store.settings.startDate, intro.phase.fromDay - 1) : store.today
	);

	function pushBack(days: number) {
		store.pushBackIntro(days);
		pushing = false;
	}
</script>

{#if intro}
	<section class="card intro" data-testid="new-dilator">
		<span class="spark s1" aria-hidden="true">✦</span>
		<span class="spark s2" aria-hidden="true">✿</span>
		<Mascot size={72} />
		{#if !pushing}
			<h2>{many ? 'New dilators appear!' : 'New dilator appears!'} ✨</h2>
			<p class="muted">{intro.phase.label}</p>
			<ul class="list">
				{#each intro.dilators as n (n.dilator.id)}
					<li class="dilator">
						<Swatch color={n.dilator.color} size={64} />
						<div class="facts">
							<p class="name">
								<DilatorName label={n.dilator.name} nickname={n.dilator.nickname} />
							</p>
							<dl>
								{#if n.dilator.diameterMm}
									<div>
										<dt>Size</dt>
										<dd>{n.dilator.diameterMm} mm across</dd>
									</div>
								{/if}
								<div>
									<dt>This phase</dt>
									<dd>{n.minutes} min per session, {timesPerDay(intro.sessionsPerDay)}</dd>
								</div>
							</dl>
						</div>
					</li>
				{/each}
			</ul>
			<div class="buttons">
				<button class="btn" onclick={() => store.acknowledgeIntro()}>Okay, here we go ♡</button>
				<button class="btn ghost" onclick={() => (pushing = true)}>I'm not ready</button>
			</div>
		{:else}
			<h2>Want to push this phase back?</h2>
			<p class="muted">
				That's completely okay, there's no rush. But you've already handled every step so far, and I
				believe in you.
			</p>
			<p class="cheer">You can do it! ♡</p>
			<div class="buttons">
				<button class="btn" onclick={() => store.acknowledgeIntro()}>
					Never mind, let's try it anyway
				</button>
			</div>
			<p class="muted hint">
				Or take more time. {intro.phase.label}
				{phaseStart === store.today
					? 'starts today'
					: `started on ${formatScheduleDate(phaseStart, ref)}`}. Pushing it back moves everything
				after it too, and until then you carry on with your current routine.
			</p>
			<div class="buttons">
				<button class="btn ghost" onclick={() => pushBack(1)}>Push back 1 day</button>
				<button class="btn ghost" onclick={() => pushBack(7)}>Push back 1 week</button>
				<button class="btn ghost small" onclick={() => (pushing = false)}>Back</button>
			</div>
		{/if}
	</section>
{/if}

<style>
	.intro {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 0.7rem;
		text-align: center;
		padding: 1.3rem 1.1rem;
		margin-bottom: 1.4rem;
		border-color: var(--accent);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--accent-soft) 70%, var(--surface)),
			var(--surface)
		);
		overflow: hidden;
	}
	h2 {
		font-size: 1.35rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.7rem;
		width: 100%;
	}
	.dilator {
		display: flex;
		align-items: center;
		gap: 1rem;
		text-align: left;
		padding: 0.8rem 1rem;
		border-radius: var(--radius);
		background: var(--surface);
		border: 2px solid var(--line);
	}
	.name {
		font-size: 1.15rem;
		font-weight: 900;
	}
	dl {
		margin: 0.3rem 0 0;
		display: grid;
		gap: 0.4rem;
	}
	dt {
		font-size: 0.78rem;
		font-weight: 800;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	dd {
		margin: 0;
		font-weight: 600;
	}
	.cheer {
		font-size: 1.5rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.hint {
		font-size: 0.88rem;
	}
	.buttons {
		display: grid;
		gap: 0.55rem;
		width: 100%;
		margin-top: 0.2rem;
	}
	.spark {
		position: absolute;
		color: var(--accent);
		opacity: 0.55;
		pointer-events: none;
		animation: twinkle 3.2s ease-in-out infinite;
	}
	.s1 {
		top: 0.7rem;
		left: 1rem;
		font-size: 0.9rem;
	}
	.s2 {
		top: 1.4rem;
		right: 1.1rem;
		font-size: 0.8rem;
		animation-delay: 1.2s;
	}
	@keyframes twinkle {
		50% {
			opacity: 0.12;
			transform: scale(0.8);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spark {
			animation: none;
		}
	}
</style>
