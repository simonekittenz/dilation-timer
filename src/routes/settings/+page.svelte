<script lang="ts">
	import { untrack } from 'svelte';
	import { previewSound, setVolume, testSound } from '$lib/alarm';
	import { backupFileName, createBackup, describeBackup, parseBackup } from '$lib/backup';
	import { saveTextFile } from '$lib/files';
	import { addDays, dayNumber, formatShortDate } from '$lib/dates';
	import { phaseForDay, phaseProgress } from '$lib/schedule';
	import { wihPhases } from '$lib/defaults';
	import { PALETTE, dilatorLabel, stepsInUse, wihDilators } from '$lib/dilators';
	import { defaultMessages } from '$lib/messages';
	import { chainPhases, findPhaseProblems, phaseLength, resizePhase } from '$lib/phases';
	import { buildSettings, messagesToText } from '$lib/settingsDraft';
	import Mascot from '$lib/Mascot.svelte';
	import { isNative, nativePlatform } from '$lib/platform';
	import { updates } from '$lib/updates.svelte';
	import { APP_VERSION } from '$lib/version';
	import Swatch from '$lib/Swatch.svelte';
	import { store } from '$lib/store.svelte';
	import type { Settings } from '$lib/types';

	let draft = $state<Settings>($state.snapshot(store.settings));
	let messageText = $state(messagesToText(store.settings.messages));
	let status = $state<'saved' | 'waiting'>('saved');
	let firstRun = true;

	// Autosave: every change is validated and stored straight away.
	$effect(() => {
		const next = buildSettings($state.snapshot(draft), $state.snapshot(messageText));
		if (firstRun) {
			firstRun = false;
			return;
		}
		if (!next) {
			status = 'waiting';
			return;
		}
		// untrack: saving reads the store's settings, which would make this effect re-trigger itself.
		untrack(() => store.updateSettings(next));
		status = 'saved';
	});

	const inUse = $derived(stepsInUse(draft));
	// until the surgery date has been chosen, startDate is just a placeholder that must not be shown
	const hasDate = $derived(draft.setup !== 'ask-date');
	const day = $derived(hasDate ? dayNumber(draft.startDate, store.today) : 0);

	/** Picking the first surgery date here counts as answering the Today screen's question. */
	function setStartDate(value: string) {
		if (draft.setup === 'ask-date') {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
			draft.setup = 'confirm';
		}
		draft.startDate = value;
	}
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

	const settingsVolumeOff = $derived(Number(draft.volume) === 0);
	let alertNote = $state('');
	async function testAlert() {
		const sent = await store.testLockedScreenAlert();
		alertNote = sent
			? 'Test alert on its way. Lock your phone now ♡'
			: "Couldn't schedule it. Check that notifications are allowed for this app.";
	}

	let backupNote = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);

	async function saveBackup() {
		const backup = createBackup($state.snapshot(store.settings), $state.snapshot(store.log));
		const result = await saveTextFile(backupFileName(), JSON.stringify(backup, null, 2));
		backupNote =
			result === 'cancelled'
				? null
				: { kind: 'ok', text: 'Backup saved. Keep the file somewhere safe ♡' };
	}

	async function restoreBackup(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		input.value = ''; // so choosing the same file again still works
		if (!file) return;
		const parsed = parseBackup(await file.text());
		if (!parsed.ok) {
			backupNote = { kind: 'error', text: parsed.error };
			return;
		}
		if (
			!confirm(
				`Replace everything on this device with this backup?\n\n${describeBackup(parsed)}\n\nThis can't be undone.`
			)
		) {
			return;
		}
		const result = store.restoreBackup(parsed);
		if (!result.ok) {
			backupNote = { kind: 'error', text: result.error };
			return;
		}
		draft = $state.snapshot(store.settings);
		messageText = messagesToText(store.settings.messages);
		backupNote = { kind: 'ok', text: 'Restored ✓ Your history and settings are back.' };
	}

	function resetMessages() {
		const m = defaultMessages();
		messageText = messagesToText(m);
	}
	const colorOf = (id: string) => draft.dilators.find((d) => d.id === id)?.color ?? '#ff9ccb';

	function addDilator() {
		draft.dilators.push({
			id: `d-${crypto.randomUUID().slice(0, 8)}`,
			name: `Dilator ${draft.dilators.length}`,
			color: PALETTE[draft.dilators.length % PALETTE.length]
		});
	}

	const problems = $derived(findPhaseProblems(draft.phases));
	const labelOf = (id: string) => draft.phases.find((p) => p.id === id)?.label ?? '';

	/** Changing where a phase ends moves every later phase with it. */
	function setEnd(id: string, toDay: number) {
		draft.phases = resizePhase($state.snapshot(draft.phases), id, toDay);
	}

	function commitEnd(id: string, input: HTMLInputElement) {
		const raw = input.value.trim();
		if (raw === '') {
			// blank means "keeps going"; nothing after it to push
			draft.phases = $state
				.snapshot(draft.phases)
				.map((p) => (p.id === id ? { ...p, toDay: null } : p));
			return;
		}
		setEnd(id, Number(raw));
		// show the real value if it was adjusted (e.g. a phase can't end before it starts)
		input.value = String(draft.phases.find((p) => p.id === id)?.toDay ?? '');
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
</script>

<div class="head">
	<h1>Settings 🎀</h1>
	<p class="status {status}" role="status" aria-live="polite">
		{#if status === 'saved'}
			Saved ✓
		{:else}
			Not saved yet, finish the empty date or day field
		{/if}
	</p>
</div>

<section class="card here">
	<p class="muted">Today · {todayLabel}</p>
	{#if !hasDate}
		<h2>Pick your surgery date</h2>
		<p class="muted">
			Then I can show where you are in the schedule. The Today screen asks for it too.
		</p>
	{:else if day < 1}
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
			The WIH program starts with 7 packing days, so dilation typically begins on day 8. The
			dilation free period can be found and configured in the schedule below.
		</small>
	</span>
	<input
		type="date"
		value={hasDate ? draft.startDate : ''}
		oninput={(e) => setStartDate(e.currentTarget.value)}
		aria-label="Surgery date (Day 1)"
	/>
</label>

<fieldset class="card companion">
	<legend>Your little friend</legend>
	<div class="tiles">
		{#each [{ id: 'bunny', label: 'Bunny' }, { id: 'kitty', label: 'Kitty' }] as const as option (option.id)}
			<label class="tile" class:chosen={draft.mascot === option.id}>
				<input type="radio" name="mascot" value={option.id} bind:group={draft.mascot} />
				<Mascot animal={option.id} size={72} />
				<span>{option.label}</span>
			</label>
		{/each}
	</div>
</fieldset>

<label class="card field switch-window">
	<span>
		Gentle switch window
		<small class="muted">
			Minutes of quiet, no-pressure time to swap to the next dilator after a timer ends, before the
			alarm starts blinking and beeping
		</small>
	</span>
	<input type="number" min="0" step="0.5" class="num" bind:value={draft.switchWindowMinutes} />
</label>

<section class="card sound-test">
	<div class="sound-head">
		<span>Alarm sound</span>
		<button class="btn small" onclick={testSound}>🔔 Test</button>
	</div>
	<label class="volume">
		<span class="muted">Volume</span>
		<input
			type="range"
			min="0"
			max="100"
			step="5"
			bind:value={draft.volume}
			onchange={() => {
				setVolume(Number(draft.volume) / 100);
				previewSound();
			}}
			aria-label="Alarm volume"
		/>
		<strong>{Number(draft.volume) === 0 ? 'Off' : `${draft.volume}%`}</strong>
	</label>
	{#if Number(draft.volume) === 0}
		<small class="muted">
			Sounds are off. The screen still shows your timers, and your phone may still vibrate.
		</small>
	{:else}
		<small class="muted">
			Still too quiet? On iPhone, tap Test and use the volume buttons while it plays, because the
			alarm uses your media volume. It needs iOS 17 or newer to ring with the silent switch on.
		</small>
	{/if}
</section>

{#if isNative()}
	<section class="card alerts">
		<div class="sound-head">
			<span>Locked-screen alerts 🔔</span>
			{#if store.alertsPermission === 'granted'}
				<button class="btn small" onclick={testAlert}>Send a test</button>
			{:else if store.alertsPermission === 'prompt'}
				<button class="btn small" onclick={() => store.enableLockedScreenAlerts()}>Turn on</button>
			{/if}
		</div>
		<p class="muted">
			When your phone is locked or the app is in the background, it still alerts you the moment a
			timer ends, then gently reminds you if you haven't switched yet.
		</p>
		{#if store.alertsPermission === 'granted'}
			<small class="ok"
				>On ✓ Press "Send a test", then lock your phone: it arrives in 10 seconds.</small
			>
		{:else if store.alertsPermission === 'denied'}
			<small class="warn-text">
				Off. Allow notifications for Dilation timer in your phone's settings to get these.
			</small>
		{:else if store.alertsPermission === 'prompt'}
			<small class="muted">Not allowed yet. Press "Turn on" and say yes when your phone asks.</small
			>
		{/if}
		{#if alertNote}<small role="status">{alertNote}</small>{/if}
		<small class="muted">
			{#if settingsVolumeOff}Alerts are silent while the alarm volume is off.{/if}
			{#if nativePlatform() === 'ios'}
				On iPhone, alerts use your normal notification sound and follow the silent switch.
			{/if}
		</small>
	</section>
{/if}

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

<section class="card backup">
	<strong>Back up your data 💾</strong>
	<p class="muted">
		Your history and settings live only on this device. Save a copy before switching phones, or
		before moving to the app version.
	</p>
	<div class="row">
		<button class="btn small" onclick={saveBackup}>💾 Save backup</button>
		<label class="btn ghost small file">
			📂 Restore backup
			<input type="file" accept="application/json,.json" onchange={restoreBackup} />
		</label>
	</div>
	{#if backupNote}
		<p class="note-{backupNote.kind}" role="status">{backupNote.text}</p>
	{/if}
</section>

{#if !isNative()}
	<a class="card getapp" href="/welcome">
		<span>📲 <strong>Get the Android app</strong> or see what the web version can't do</span>
		<span aria-hidden="true">→</span>
	</a>
{/if}

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
		When a session is finished
		<textarea rows="5" bind:value={messageText.done}></textarea>
	</label>
	<button class="btn ghost small" onclick={resetMessages}>Reset messages to defaults</button>
</details>

<h2 class="schedule-title">Your schedule</h2>
{#if problems.length}
	<div class="card warn" role="alert">
		<strong>⚠️ These phases don't line up</strong>
		<ul>
			{#each problems as problem (problem.id)}
				<li>
					{#if problem.kind === 'overlap'}
						<b>{labelOf(problem.id)}</b> overlaps <b>{labelOf(problem.after)}</b>, so some days are
						counted twice.
					{:else}
						There's a gap of uncovered days before <b>{labelOf(problem.id)}</b>.
					{/if}
				</li>
			{/each}
		</ul>
		<button
			class="btn small"
			onclick={() => (draft.phases = chainPhases($state.snapshot(draft.phases)))}
		>
			Tidy up, keeping each phase's length
		</button>
	</div>
{/if}
<p class="muted note">
	Each phase covers a range of days. Today's schedule is picked from the phase the date falls in.
</p>

{#each draft.phases as phase, pi (phase.id)}
	{@const progress = hasDate ? phaseProgress(draft.phases, phase, day) : 'upcoming'}
	<details
		class="card phase {progress}"
		id={progress === 'current' ? 'current-phase' : undefined}
		open={progress === 'current'}
	>
		<summary>
			<span class="title">
				<strong>{phase.label}</strong>
				{#if !hasDate}
					<!-- no date yet, so no "you are here" or countdowns -->
				{:else if progress === 'current'}
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
				{#if hasDate}{dateRange(phase.fromDay, phase.toDay)} ·{/if} day {phase.fromDay}{phase.toDay ===
				null
					? '+'
					: phase.toDay === phase.fromDay
						? ''
						: `–${phase.toDay}`}
				{#if phaseLength(phase) !== null}· {phaseLength(phase)} day{phaseLength(phase) === 1
						? ''
						: 's'}{/if}
				· {Math.round(phase.steps.reduce((sum, st) => sum + st.minutes, 0) * 10) / 10} min
			</span>
		</summary>
		<div class="row">
			<input class="grow" bind:value={phase.label} aria-label="Phase name" />
			<button
				class="btn ghost small"
				onclick={() => confirm(`Remove "${phase.label}"?`) && draft.phases.splice(pi, 1)}
				disabled={draft.phases.length === 1}>Remove</button
			>
		</div>
		<div class="stack">
			<span>
				Day {phase.fromDay}{phase.toDay === null ? ' onwards' : ` – ${phase.toDay}`}
				{#if phaseLength(phase) !== null}· {phaseLength(phase)} day{phaseLength(phase) === 1
						? ''
						: 's'}{/if}
				{#if hasDate}
					<span class="muted"
						>· starts {formatShortDate(addDays(draft.startDate, phase.fromDay - 1))}</span
					>
				{/if}
			</span>
			{#if phase.toDay !== null}
				<div class="row">
					<button
						class="btn ghost small"
						onclick={() => setEnd(phase.id, phase.toDay! - 1)}
						disabled={phaseLength(phase) === 1}
					>
						− 1 day
					</button>
					<button class="btn ghost small" onclick={() => setEnd(phase.id, phase.toDay! + 1)}>
						+ 1 day
					</button>
					<label class="inline">
						Ends day
						<input
							type="number"
							min={phase.fromDay}
							class="num"
							placeholder="∞"
							value={phase.toDay}
							onchange={(e) => commitEnd(phase.id, e.currentTarget)}
						/>
					</label>
				</div>
				<small class="muted">Adding or removing days moves every later phase too.</small>
			{:else}
				<small class="muted">This phase keeps going, so there's nothing after it to move.</small>
			{/if}
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
</div>

<p class="version muted" data-testid="version">
	Dilation timer v{APP_VERSION}{isNative() ? ' · app' : ''}
	{#if updates.available}
		· <a href={updates.available.downloadUrl}>v{updates.available.version} is available</a>
	{/if}
</p>

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.status {
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--ok);
		text-align: right;
	}
	.status.waiting {
		color: var(--warn);
	}
	h1 {
		margin: 0;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.companion {
		margin: 0.6rem 0 0;
	}
	.companion legend {
		padding: 0 0.4rem;
		font-weight: 800;
	}
	.tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}
	.tile {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 0.3rem;
		padding: 0.8rem 0.4rem 0.6rem;
		border: 2px solid var(--line);
		border-radius: var(--radius);
		background: var(--bg);
		font-weight: 800;
		cursor: pointer;
	}
	.tile.chosen {
		border-color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent-soft) 55%, var(--surface));
		box-shadow: 0 3px 0 var(--accent);
	}
	.tile input {
		position: absolute;
		opacity: 0;
		inset: 0;
		cursor: pointer;
	}
	.tile:has(input:focus-visible) {
		outline: 3px solid var(--accent-strong);
		outline-offset: 2px;
	}
	.getapp {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin: 0.6rem 0;
		color: var(--ink);
		text-decoration: none;
		font-size: 0.95rem;
	}
	.backup {
		display: grid;
		gap: 0.6rem;
		margin: 0.6rem 0;
	}
	.backup p {
		font-size: 0.9rem;
	}
	.file {
		position: relative;
		cursor: pointer;
	}
	.file input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.note-ok {
		color: var(--ok);
		font-weight: 800;
	}
	.note-error {
		color: var(--warn);
		font-weight: 800;
	}
	.alerts {
		display: grid;
		gap: 0.6rem;
		margin: 0.6rem 0;
	}
	.alerts p,
	.alerts small {
		font-size: 0.9rem;
	}
	.alerts .ok {
		color: var(--ok);
		font-weight: 800;
	}
	.alerts .warn-text {
		color: var(--warn);
		font-weight: 800;
	}
	.sound-test {
		display: grid;
		gap: 0.6rem;
		margin-top: 0.6rem;
	}
	.sound-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-weight: 800;
	}
	.volume {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.volume input[type='range'] {
		flex: 1;
		padding: 0;
		accent-color: var(--accent-strong);
	}
	.volume strong {
		min-width: 3.2rem;
		text-align: right;
	}
	.sound-test small {
		font-size: 0.8rem;
	}
	.switch-window {
		margin-top: 0.6rem;
	}
	.field small {
		display: block;
		font-size: 0.8rem;
		margin-top: 0.15rem;
	}
	.switch-window small {
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
	.warn {
		display: grid;
		gap: 0.5rem;
		justify-items: start;
		margin-bottom: 0.8rem;
		border-color: var(--warn);
	}
	.warn ul {
		margin: 0;
		padding-left: 1.1rem;
		font-size: 0.9rem;
	}
	.inline {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--muted);
		font-size: 0.9rem;
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
	.version {
		margin-top: 1.4rem;
		text-align: center;
		font-size: 0.78rem;
		opacity: 0.8;
	}
	.actions {
		justify-content: flex-start;
		margin-top: 1rem;
	}
</style>
