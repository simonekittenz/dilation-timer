<script lang="ts">
	import { dayNumber, formatCompactDate } from '#lib/dates.ts';
	import Mascot from '#lib/Mascot.svelte';
	import MilestoneCard from '#lib/MilestoneCard.svelte';
	import Schedule from '#lib/Schedule.svelte';
	import Setup from '#lib/Setup.svelte';
	import { daysUntilDilation, isRestPhase } from '#lib/schedule.ts';
	import { store } from '#lib/store.svelte.ts';
	import DilatorName from '#lib/DilatorName.svelte';
	import Swatch from '#lib/Swatch.svelte';
	import Timer from '#lib/Timer.svelte';
	import UpdateBanner from '#lib/UpdateBanner.svelte';
	import { resolveSteps } from '#lib/dilators.ts';

	const phase = $derived(store.todayPhase);
	// first run: we don't know the surgery date yet, or haven't confirmed the week
	const settingUp = $derived((store.settings.setup ?? 'done') !== 'done');
	const day = $derived(dayNumber(store.settings.startDate, store.today));
	const dateLabel = $derived(
		new Date(store.now).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		})
	);
	// "Tue, Oct 20 · Day 48 · Week 6": built here as one string so no line-wrapping can eat a space
	const sessionMeta = $derived(
		[formatCompactDate(store.now), `Day ${day}`, phase?.label].filter(Boolean).join(' · ')
	);
	const nextSlot = $derived(store.nextSlot);
	const untilDilation = $derived(daysUntilDilation(store.settings.phases, day));
	const steps = $derived(phase ? resolveSteps(store.settings.dilators, phase.steps) : []);
</script>

{#if store.active && !settingUp}
	<!-- a session is on screen: keep the top quiet, so the timer has the focus -->
	<p class="session-meta">
		{sessionMeta}
	</p>
{:else}
	<header>
		<h1>{dateLabel} <span class="sparkle">✿</span></h1>
		<!-- while setting up, "Day N" would just be a guess, so it isn't shown yet -->
		<p class="muted">
			{#if settingUp}
				&nbsp;
			{:else if day < 1}
				Starts in {1 - day} day{1 - day === 1 ? '' : 's'}
			{:else if phase}
				Day {day} · {phase.label}
			{:else}
				Day {day} · no phase covers today
			{/if}
		</p>
	</header>
{/if}

<UpdateBanner />
{#if !settingUp && !store.active}<MilestoneCard />{/if}

{#if settingUp}
	<Setup />
{:else if store.active}
	<Timer />
{:else if phase && isRestPhase(phase)}
	<section class="rest card">
		<Mascot size={96} />
		<h2>Rest day 🌸</h2>
		<p class="muted">
			No dilation today.
			{#if untilDilation !== null}
				Dilation starts in {untilDilation} day{untilDilation === 1 ? '' : 's'}.
			{/if}
		</p>
		<a class="btn ghost small" href="/custom">✨ Do a custom session anyway</a>
	</section>
{:else if phase}
	<section class="routine card">
		<h2>Today's routine 🎀</h2>
		<ol class="steps">
			{#each steps as st, i (i)}
				<li>
					<Swatch color={st.color} size={20} />
					<DilatorName label={st.label} nickname={st.nickname} /> · {st.minutes} min
				</li>
			{/each}
		</ol>
		<div class="actions">
			<button class="btn" onclick={() => store.start(nextSlot?.slot ?? null)}>
				{nextSlot ? `Start ${nextSlot.label.toLowerCase()} session` : 'Start an extra session'}
			</button>
			<a class="btn ghost" href="/custom">✨ Custom session</a>
		</div>
	</section>
	<h2 class="sub">Schedule ♡</h2>
	<Schedule />
{:else}
	<p class="card muted">
		No routine covers today. Check the start date and phases in <a href="/settings">Settings</a>.
	</p>
{/if}

<style>
	header {
		margin-bottom: 1.2rem;
	}
	.session-meta {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
		margin-bottom: 0.6rem;
		color: var(--muted);
		font-size: 0.85rem;
		font-weight: 800;
	}
	h1 {
		font-size: 1.7rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.sparkle {
		font-size: 1.1rem;
	}
	.rest {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		text-align: center;
		padding: 1.5rem 1rem;
	}
	.routine {
		display: grid;
		gap: 0.7rem;
		justify-items: start;
		margin-bottom: 1.4rem;
	}
	/* the two ways to start sit together, the same width */
	.actions {
		display: grid;
		gap: 0.55rem;
		width: 100%;
		margin-top: 0.3rem;
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		color: var(--muted);
		font-weight: 600;
	}
	.steps li {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.sub {
		font-size: 1rem;
		font-weight: 800;
		color: var(--muted);
		margin-bottom: 0.6rem;
	}
</style>
