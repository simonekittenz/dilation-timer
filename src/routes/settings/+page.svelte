<script lang="ts">
	import { goto } from '$app/navigation';
	import { addDays, dayNumber, formatShortDate } from '$lib/dates';
	import { phaseForDay, phaseProgress } from '$lib/schedule';
	import { wihPhases } from '$lib/defaults';
	import { PALETTE, dilatorLabel, stepsInUse, wihDilators } from '$lib/dilators';
	import { defaultMessages, parseMessages } from '$lib/messages';
	import Swatch from '$lib/Swatch.svelte';
	import { store } from '$lib/store.svelte';
	import type { Phase, Settings } from '$lib/types';

	let draft = $state<Settings>($state.snapshot(store.settings));
	let messageText = $state({
		running: store.settings.messages.running.join('\n'),
		switch: store.settings.messages.switch.join('\n'),
		done: store.settings.messages.done.join('\n')
	});
	const inUse = $derived(stepsInUse(draft));
	const day = $derived(dayNumber(draft.startDate, store.today));
	const currentPhase = $derived(phaseForDay(draft.phases, day));
	const todayLabel = $derived(
		new Date(store.now).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		})
	);

	function dateRange(from: number, to: number | null): string {
		const start = formatShortDate(addDays(draft.startDate, from - 1));
		if (to === null) return `${start} →`;
		return to === from ? start : `${start} – ${formatShortDate(addDays(draft.startDate, to - 1))}`;
	}

	function jumpToCurrent() {
		document
			.getElementById('current-phase')
			?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function resetMessages() {
		const m = defaultMessages();
		messageText = {
			running: m.running.join('\n'),
			switch: m.switch.join('\n'),
			done: m.done.join('\n')
		};
	}
	const colorOf = (id: string) => draft.dilators.find((d) => d.id === id)?.color ?? '#ff9ccb';

	function addDilator() {
		draft.dilators.push({
			id: `d-${crypto.randomUUID().slice(0, 8)}`,
			name: `Dilator ${draft.dilators.length}`,
			color: PALETTE[draft.dilators.length % PALETTE.length]
		});
	}

	function addPhase() {
		const last = draft.phases.at(-1);
		const id = crypto.randomUUID();
		if (last && last.toDay === null) last.toDay = last.fromDay;
		draft.phases.push({
			id,
			label: `Phase ${draft.phases.length + 1}`,
			fromDay: (last?.toDay ?? 0) + 1,
			toDay: null,
			slots: ['morning', 'evening'],
			steps: [{ dilatorId: draft.dilators[0]?.id ?? '', minutes: 10 }]
		});
	}

	function resetToWih() {
		if (!confirm('Replace all dilators, phases and messages with the WIH standard program?'))
			return;
		draft.dilators = wihDilators();
		draft.phases = wihPhases();
		resetMessages();
	}

	function save() {
		const phases: Phase[] = draft.phases.map((p) => ({
			...p,
			steps: p.steps.filter(
				(s) => s.minutes > 0 && draft.dilators.some((d) => d.id === s.dilatorId)
			)
		}));
		const dilators = draft.dilators.map((d) => ({
			...d,
			name: d.name.trim() || 'Dilator',
			nickname: d.nickname?.trim() || undefined,
			diameterMm: d.diameterMm ? Number(d.diameterMm) : undefined
		}));
		store.updateSettings({
			startDate: draft.startDate,
			leewayMinutes: Math.max(0, Number(draft.leewayMinutes) || 0),
			dilators,
			messages: {
				running: parseMessages(messageText.running),
				switch: parseMessages(messageText.switch),
				done: parseMessages(messageText.done)
			},
			phases
		});
		void goto('/');
	}
</script>

<h1>Settings 🎀</h1>

<section class="card here">
	<p class="muted">Today · {todayLabel}</p>
	{#if day < 1}
		<h2>Starts in {1 - day} day{1 - day === 1 ? '' : 's'}</h2>
	{:else if currentPhase}
		<h2>Day {day} · {currentPhase.label}</h2>
		<button class="btn ghost small" onclick={jumpToCurrent}>Jump to this phase ↓</button>
	{:else}
		<h2>Day {day} · no phase covers today</h2>
	{/if}
</section>

<label class="card field">
	<span>
		Day 1 (your surgery date)
		<small class="muted">
			The WIH program starts with 7 rest days, so dilation begins on day 8. Phases below count from
			this date.
		</small>
	</span>
	<input type="date" bind:value={draft.startDate} />
</label>

<label class="card field leeway">
	<span>
		Gentle switch window
		<small class="muted">
			Minutes of quiet, no-pressure time to swap to the next dilator after a timer ends, before the
			alarm starts blinking and beeping
		</small>
	</span>
	<input type="number" min="0" step="0.5" class="num" bind:value={draft.leewayMinutes} />
</label>

<details class="card phase">
	<summary
		><strong>Your dilators</strong> <span class="muted">· {draft.dilators.length}</span></summary
	>
	<p class="muted note">Set these up once. Phases below just pick a dilator and a time.</p>
	{#each draft.dilators as d, di (d.id)}
		<div class="row dilator">
			<input type="color" class="color" bind:value={d.color} aria-label="{d.name} color" />
			<input class="grow" bind:value={d.name} aria-label="Dilator name" />
			<input
				type="number"
				min="1"
				class="num"
				placeholder="mm"
				bind:value={d.diameterMm}
				aria-label="Diameter in mm"
			/>
			<span class="muted">mm</span>
			<button
				class="btn ghost small"
				onclick={() => draft.dilators.splice(di, 1)}
				disabled={inUse.has(d.id)}
				title={inUse.has(d.id) ? 'Used in a phase' : 'Remove'}
				aria-label="Remove {d.name}">✕</button
			>
			<input
				class="nickname"
				bind:value={d.nickname}
				placeholder="Nickname (optional), e.g. Sunny"
				aria-label="{d.name} nickname"
			/>
		</div>
	{/each}
	<button class="btn ghost small" onclick={addDilator}>+ Add dilator</button>
</details>

<details class="card phase">
	<summary><strong>Encouragement 💌</strong></summary>
	<p class="muted note">
		One message per line. A random one pops up in a little bubble. Use <code>{'{name}'}</code>
		to drop in the dilator's nickname (or name). Leave a box empty to turn those off.
	</p>
	<label class="stack">
		While a timer runs (changes every minute)
		<textarea rows="6" bind:value={messageText.running}></textarea>
	</label>
	<label class="stack">
		When it's time to switch
		<textarea rows="4" bind:value={messageText.switch}></textarea>
	</label>
	<label class="stack">
		When a session is finished
		<textarea rows="5" bind:value={messageText.done}></textarea>
	</label>
	<button class="btn ghost small" onclick={resetMessages}>Reset messages to defaults</button>
</details>

<h2 class="schedule-title">Your schedule</h2>
<p class="muted note">
	Each phase covers a range of days. Today's schedule is picked from the phase the date falls in.
</p>

{#each draft.phases as phase, pi (phase.id)}
	{@const progress = phaseProgress(draft.phases, phase, day)}
	<details
		class="card phase {progress}"
		id={progress === 'current' ? 'current-phase' : undefined}
		open={progress === 'current'}
	>
		<summary>
			<span class="title">
				<strong>{phase.label}</strong>
				{#if progress === 'current'}
					<span class="badge now">📍 You are here</span>
				{:else if progress === 'past'}
					<span class="badge done">Done ✓</span>
				{:else if phase.fromDay > day}
					<span class="badge soon">
						in {phase.fromDay - day} day{phase.fromDay - day === 1 ? '' : 's'}
					</span>
				{/if}
			</span>
			<span class="muted meta">
				{dateRange(phase.fromDay, phase.toDay)} · day {phase.fromDay}{phase.toDay === null
					? '+'
					: phase.toDay === phase.fromDay
						? ''
						: `–${phase.toDay}`}
				· {Math.round(phase.steps.reduce((sum, st) => sum + st.minutes, 0) * 10) / 10} min
			</span>
		</summary>
		<div class="row">
			<input class="grow" bind:value={phase.label} aria-label="Phase name" />
			<button
				class="btn ghost small"
				onclick={() => draft.phases.splice(pi, 1)}
				disabled={draft.phases.length === 1}>Remove</button
			>
		</div>
		<div class="row">
			<label>From day <input type="number" min="1" bind:value={phase.fromDay} class="num" /></label>
			<label>
				To day
				<input
					type="number"
					min="1"
					class="num"
					placeholder="∞"
					value={phase.toDay ?? ''}
					oninput={(e) =>
						(phase.toDay = e.currentTarget.value ? Number(e.currentTarget.value) : null)}
				/>
			</label>
		</div>
		<label class="stack">
			Sessions per day
			<select
				value={phase.slots.length > 1 ? 'two' : phase.slots.length === 1 ? 'one' : 'none'}
				onchange={(e) =>
					(phase.slots =
						e.currentTarget.value === 'two'
							? ['morning', 'evening']
							: e.currentTarget.value === 'one'
								? ['daily']
								: [])}
			>
				<option value="none">None (rest days)</option>
				<option value="one">Once a day</option>
				<option value="two">Morning &amp; evening</option>
			</select>
		</label>
		<div class="stack">
			Dilators, in order
			{#each phase.steps as step, si (si)}
				<div class="row">
					<Swatch color={colorOf(step.dilatorId)} size={26} />
					<select class="grow" bind:value={step.dilatorId} aria-label="Dilator">
						{#each draft.dilators as d (d.id)}
							<option value={d.id}>{dilatorLabel(d)}</option>
						{/each}
					</select>
					<input type="number" min="1" class="num" bind:value={step.minutes} aria-label="Minutes" />
					<span class="muted">min</span>
					<button
						class="btn ghost small"
						onclick={() => phase.steps.splice(si, 1)}
						disabled={phase.slots.length > 0 && phase.steps.length === 1}
						aria-label="Remove dilator">✕</button
					>
				</div>
			{/each}
			<button
				class="btn ghost small"
				onclick={() =>
					phase.steps.push({
						dilatorId: draft.dilators[phase.steps.length % draft.dilators.length]?.id ?? '',
						minutes: 10
					})}
			>
				+ Add dilator
			</button>
		</div>
	</details>
{/each}

<div class="row actions">
	<button class="btn ghost" onclick={addPhase}>+ Add phase</button>
	<button class="btn ghost" onclick={resetToWih}>Reset to WIH program</button>
	<button class="btn" onclick={save}>Save</button>
</div>

<style>
	h1 {
		margin-bottom: 1rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.leeway {
		margin-top: 0.6rem;
	}
	.field small {
		display: block;
		font-size: 0.8rem;
		margin-top: 0.15rem;
	}
	.leeway small {
		display: block;
	}
	.field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.note {
		margin: 0.8rem 0;
		font-size: 0.9rem;
	}
	summary {
		cursor: pointer;
		list-style-position: inside;
	}
	.title {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.meta {
		display: block;
		font-size: 0.85rem;
		margin-top: 0.15rem;
	}
	.badge {
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.1rem 0.6rem;
		border-radius: 999px;
	}
	.badge.now {
		background: var(--accent-strong);
		color: var(--accent-ink);
	}
	.badge.done {
		background: var(--ok);
		color: #fff;
	}
	.badge.soon {
		background: var(--accent-soft);
		color: var(--muted);
	}
	.phase.current {
		border-color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent-soft) 45%, var(--surface));
		box-shadow:
			0 4px 0 var(--accent),
			var(--shadow);
	}
	.phase.past {
		opacity: 0.7;
	}
	.here {
		display: grid;
		justify-items: start;
		gap: 0.4rem;
		margin-bottom: 0.8rem;
		border-color: var(--accent);
	}
	.here h2 {
		font-size: 1.3rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.schedule-title {
		margin-top: 1.4rem;
		font-size: 1.1rem;
		font-weight: 900;
	}
	.phase {
		margin-bottom: 0.8rem;
	}
	.phase > :not(summary) {
		margin-top: 0.8rem;
	}
	.row {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.color {
		width: 2.4rem;
		height: 2.4rem;
		padding: 0.15rem;
		border-radius: 50%;
		cursor: pointer;
	}
	.dilator {
		margin-bottom: 0.8rem;
	}
	.nickname {
		flex-basis: 100%;
	}
	textarea {
		font: inherit;
		color: var(--ink);
		background: var(--bg);
		border: 2px solid var(--line);
		border-radius: 14px;
		padding: 0.6rem 0.8rem;
		resize: vertical;
		outline: none;
	}
	textarea:focus {
		border-color: var(--accent);
	}
	.stack {
		display: grid;
		gap: 0.4rem;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.num {
		width: 4.5rem;
	}
	.actions {
		justify-content: space-between;
		margin-top: 1rem;
	}
</style>
