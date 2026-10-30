<script lang="ts">
	import { untrack } from 'svelte';
	import { previewSound, setVolume, testSound } from '#lib/alarm.ts';
	import { backupFileName, createBackup, describeBackup, parseBackup } from '#lib/backup.ts';
	import { saveTextFile } from '#lib/files.ts';
	import { addDays, dayNumber, formatDateRange, formatScheduleDate } from '#lib/dates.ts';
	import { phaseForDay, phaseProgress } from '#lib/schedule.ts';
	import { PROGRAMS, wihPhases } from '#lib/defaults.ts';
	import type { ProgramId } from '#lib/types.ts';
	import { PALETTE, stepsInUse, wihDilators } from '#lib/dilators.ts';
	import { defaultMessages } from '#lib/messages.ts';
	import { chainPhases, findPhaseProblems, phaseLength, resizePhase } from '#lib/phases.ts';
	import { buildSettings, messagesToText } from '#lib/settingsDraft.ts';
	import Mascot from '#lib/Mascot.svelte';
	import { isNative, nativePlatform } from '#lib/platform.ts';
	import { updates } from '#lib/updates.svelte.ts';
	import { APP_VERSION } from '#lib/version.ts';
	import ReminderTimes from '#lib/ReminderTimes.svelte';
	import { defaultReminders, slotsInSchedule } from '#lib/reminders.ts';
	import StepsEditor from '#lib/StepsEditor.svelte';
	import { store } from '#lib/store.svelte.ts';
	import type { Phase, Reminders, Settings } from '#lib/types.ts';

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
	const hasDate = $derived(draft.setup !== 'ask-date' && draft.setup !== 'ask-program');
	const day = $derived(hasDate ? dayNumber(draft.startDate, store.today) : 0);

	/** Picking the first surgery date here counts as answering the Today screen's question. */
	function setStartDate(value: string) {
		if (draft.setup === 'ask-date' || draft.setup === 'ask-program') {
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
		return formatDateRange(
			addDays(draft.startDate, from - 1),
			to === null ? null : addDays(draft.startDate, to - 1),
			Number(draft.startDate.slice(0, 4))
		);
	}

	function jumpToCurrent() {
		document
			.getElementById('current-phase')
			?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	const reminders = $derived(draft.reminders ?? { ...defaultReminders(), enabled: false });
	const reminderSlots = $derived(slotsInSchedule(draft));
	/** Changes made here also go to the store right away, so the phone's reminders follow. */
	function changeReminders(next: Reminders) {
		draft.reminders = next;
		void store.setReminders($state.snapshot(next));
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
		try {
			const result = await saveTextFile(backupFileName(), JSON.stringify(backup, null, 2));
			backupNote =
				result === 'cancelled'
					? null
					: { kind: 'ok', text: 'Backup saved. Keep the file somewhere safe ♡' };
		} catch {
			backupNote = { kind: 'error', text: "Couldn't save the backup. Please try again." };
		}
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

	function addDilator() {
		draft.dilators.push({
			id: `d-${crypto.randomUUID().slice(0, 8)}`,
			name: `Dilator ${draft.dilators.length}`,
			color: PALETTE[draft.dilators.length % PALETTE.length]
		});
	}

	/**
	 * Phases the user opened or closed by hand (the current one starts open, the rest closed). Kept
	 * here because editing a phase rebuilds the list, and the page must not forget what is unfolded.
	 */
	let folded = $state<Record<string, boolean>>({});
	function remember(id: string, open: boolean, byDefault: boolean) {
		if (open === byDefault) delete folded[id];
		else folded[id] = open;
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

	/** Phases already behind you are tucked into one folded group, so the list starts at where you are. */
	const isPast = (phase: Phase) => hasDate && phaseProgress(draft.phases, phase, day) === 'past';
	const pastCount = $derived(draft.phases.filter(isPast).length);

	let choosingProgram = $state(false);

	/** Replaces the whole schedule (and dilators and messages) with a ready-made WIH program. */
	function loadProgram(program: ProgramId) {
		draft.dilators = wihDilators();
		draft.phases = wihPhases(program);
		resetMessages();
		choosingProgram = false;
	}
</script>

<div class="head">
	<h1>Settings</h1>
	<p class="status {status}" role="status" aria-live="polite">
		{#if status === 'saved'}
			Saved ✓
		{:else}
			Not saved yet, finish the empty date or day field
		{/if}
	</p>
</div>

<section class="here">
	<p class="hint">Today · {todayLabel}</p>
	{#if !hasDate}
		<h2>Pick your surgery date</h2>
		<p class="hint">
			Then I can show where you are in the schedule. The Today screen asks for it too.
		</p>
	{:else if day < 1}
		<h2>Starts in {1 - day} day{1 - day === 1 ? '' : 's'}</h2>
	{:else if currentPhase}
		<h2>Day {day} · {currentPhase.label}</h2>
		<button class="pill" onclick={jumpToCurrent}>Jump to this phase ↓</button>
	{:else}
		<h2>Day {day} · no phase covers today</h2>
	{/if}
</section>

<!-- ───────────── About you ───────────── -->
<section class="group">
	<h2 class="group-title">About you</h2>
	<div class="panel">
		<label class="item">
			<span class="text">
				<span class="label">Day 1 (your surgery date)</span>
				<span class="hint">
					The WIH program starts with 7 packing days, so dilation typically begins on day 8. You can
					change that in the schedule below.
				</span>
			</span>
			<input
				type="date"
				value={hasDate ? draft.startDate : ''}
				oninput={(e) => setStartDate(e.currentTarget.value)}
				aria-label="Surgery date (Day 1)"
			/>
		</label>
		<fieldset class="block companion">
			<legend class="label">Your little friend</legend>
			<div class="tiles">
				{#each [{ id: 'bunny', label: 'Bunny' }, { id: 'kitty', label: 'Kitty' }] as const as option (option.id)}
					<label class="tile" class:chosen={draft.mascot === option.id}>
						<input type="radio" name="mascot" value={option.id} bind:group={draft.mascot} />
						<Mascot animal={option.id} size={56} />
						<span>{option.label}</span>
					</label>
				{/each}
			</div>
		</fieldset>
	</div>
</section>

<!-- ───────────── Sessions and alerts ───────────── -->
<section class="group">
	<h2 class="group-title">Sessions &amp; alerts</h2>
	<div class="panel">
		<label class="item">
			<span class="text">
				<span class="label">Gentle switch window</span>
				<span class="hint">
					Minutes of quiet time to swap to the next dilator after a timer ends, before the alarm
					starts blinking and beeping
				</span>
			</span>
			<input type="number" min="0" step="0.5" class="num" bind:value={draft.switchWindowMinutes} />
		</label>

		<div class="block">
			<div class="item-head">
				<span class="label">Alarm sound</span>
				<button class="pill strong" onclick={testSound}>🔔 Test</button>
			</div>
			<label class="volume">
				<span class="hint">Volume</span>
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
				<span class="value">{Number(draft.volume) === 0 ? 'Off' : `${draft.volume}%`}</span>
			</label>
			{#if Number(draft.volume) === 0}
				<p class="hint">
					Sounds are off. The screen still shows your timers, and your phone may still vibrate.
				</p>
			{:else}
				<p class="hint">
					Still too quiet? On iPhone, tap Test and use the volume buttons while it plays, because
					the alarm uses your media volume. It needs iOS 17 or newer to ring with the silent switch
					on.
				</p>
			{/if}
		</div>

		{#if isNative()}
			<div class="block">
				<div class="item-head">
					<span class="label">Locked-screen alerts</span>
					{#if store.alertsPermission === 'granted'}
						<button class="pill strong" onclick={testAlert}>Send a test</button>
					{:else if store.alertsPermission === 'prompt'}
						<button class="pill strong" onclick={() => store.enableLockedScreenAlerts()}>
							Turn on
						</button>
					{/if}
				</div>
				<p class="hint">
					When your phone is locked or the app is in the background, it still alerts you the moment
					a timer ends, then gently reminds you if you haven't switched yet.
				</p>
				{#if store.alertsPermission === 'granted'}
					<p class="hint ok">
						On ✓ Press "Send a test", then lock your phone: it arrives in 10 seconds.
					</p>
				{:else if store.alertsPermission === 'denied'}
					<p class="hint bad">
						Off. Allow notifications for Dilation timer in your phone's settings to get these.
					</p>
				{:else if store.alertsPermission === 'prompt'}
					<p class="hint">Not allowed yet. Press "Turn on" and say yes when your phone asks.</p>
				{/if}
				{#if alertNote}<p class="hint" role="status">{alertNote}</p>{/if}
				{#if settingsVolumeOff || nativePlatform() === 'ios'}
					<p class="hint">
						{#if settingsVolumeOff}Alerts are silent while the alarm volume is off.{/if}
						{#if nativePlatform() === 'ios'}
							On iPhone, alerts use your normal notification sound and follow the silent switch.
						{/if}
					</p>
				{/if}
			</div>
		{/if}

		<div class="block" id="reminders">
			<div class="item-head">
				<span class="label">Daily reminders</span>
				{#if isNative()}
					<input
						type="checkbox"
						class="toggle"
						checked={reminders.enabled}
						onchange={(e) => changeReminders({ ...reminders, enabled: e.currentTarget.checked })}
						aria-label="Daily reminders"
					/>
				{/if}
			</div>
			{#if !isNative()}
				<p class="hint">
					Daily reminders to start your session are part of the phone app, because a website can't
					reliably wake your phone up. Get the app to use them.
				</p>
			{:else}
				<p class="hint">
					Your phone reminds you at the time you pick for each session, on the days that have one.
					From the reminder you can start the session, ask to be reminded again in 30 minutes, or
					turn that one off.
				</p>
				{#if reminders.enabled}
					<ReminderTimes value={reminders} slots={reminderSlots} onchange={changeReminders} />
					{#if store.alertsPermission === 'denied'}
						<p class="hint bad">
							Allow notifications for Dilation timer in your phone's settings to get these.
						</p>
					{/if}
					<p class="hint">
						Reminders are planned two weeks ahead each time you open the app, so open it now and
						then.
					</p>
				{/if}
			{/if}
		</div>
	</div>
</section>

<!-- ───────────── Encouragement ───────────── -->
<section class="group">
	<h2 class="group-title">Encouragement</h2>
	<div class="panel">
		<label class="item">
			<span class="text">
				<span class="label">Celebrate milestones</span>
				<span class="hint">
					A small, dismissible message on Today for each month of your first year and every
					anniversary after, and a cheer on the end screen when you conquer a new dilator
				</span>
			</span>
			<input
				type="checkbox"
				class="toggle"
				checked={draft.celebrations !== false}
				onchange={(e) => (draft.celebrations = e.currentTarget.checked)}
				aria-label="Celebrate milestones"
			/>
		</label>
		<label class="item">
			<span class="text">
				<span class="label">Show my streak</span>
				<span class="hint">
					On Today, how many days in a row you did all of your sessions. Rest days don't break it, a
					skipped session does.
				</span>
			</span>
			<input
				type="checkbox"
				class="toggle"
				checked={draft.streak !== false}
				onchange={(e) => (draft.streak = e.currentTarget.checked)}
				aria-label="Show my streak"
			/>
		</label>
		<details>
			<summary><span class="label">Encouraging messages</span></summary>
			<div class="body">
				<p class="hint">
					One message per line. A random one pops up in a little bubble. Use <code>{'{name}'}</code>
					to drop in the dilator's nickname (or name). Leave a box empty to turn those off.
				</p>
				<label class="stack">
					<span class="label small">While a timer runs (changes every minute)</span>
					<textarea rows="6" bind:value={messageText.running}></textarea>
				</label>
				<label class="stack">
					<span class="label small">When a session is finished</span>
					<textarea rows="5" bind:value={messageText.done}></textarea>
				</label>
				<div class="actions-row">
					<button class="pill" onclick={resetMessages}>Reset messages to defaults</button>
				</div>
			</div>
		</details>
	</div>
</section>

<!-- ───────────── Schedule ───────────── -->
{#snippet phaseRow(phase: Phase, pi: number)}
	{@const progress = hasDate ? phaseProgress(draft.phases, phase, day) : 'upcoming'}
	<details
		class="phase {progress}"
		id={progress === 'current' ? 'current-phase' : undefined}
		open={folded[phase.id] ?? progress === 'current'}
		ontoggle={(e) => remember(phase.id, e.currentTarget.open, progress === 'current')}
	>
		<summary>
			<span class="summary-text">
				<span class="title">
					<span class="label">{phase.label}</span>
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
				<span class="hint meta">
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
			</span>
		</summary>
		<div class="body">
			<div class="row">
				<input class="grow" bind:value={phase.label} aria-label="Phase name" />
				<button
					class="pill"
					onclick={() => confirm(`Remove "${phase.label}"?`) && draft.phases.splice(pi, 1)}
					disabled={draft.phases.length === 1}>Remove</button
				>
			</div>
			<div class="stack">
				<span class="label small">
					Day {phase.fromDay}{phase.toDay === null ? ' onwards' : ` – ${phase.toDay}`}
					{#if phaseLength(phase) !== null}· {phaseLength(phase)} day{phaseLength(phase) === 1
							? ''
							: 's'}{/if}
					{#if hasDate}
						<span class="hint"
							>· starts {formatScheduleDate(
								addDays(draft.startDate, phase.fromDay - 1),
								Number(draft.startDate.slice(0, 4))
							)}</span
						>
					{/if}
				</span>
				{#if phase.toDay !== null}
					<div class="resize">
						<div class="row">
							<button class="pill" onclick={() => setEnd(phase.id, phase.toDay! + 1)}>
								+ 1 day
							</button>
							<button class="pill" onclick={() => setEnd(phase.id, phase.toDay! + 7)}>
								+ 1 week
							</button>
						</div>
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
						<div class="row">
							<button
								class="pill"
								onclick={() => setEnd(phase.id, phase.toDay! - 1)}
								disabled={phaseLength(phase) === 1}
							>
								− 1 day
							</button>
							<button
								class="pill"
								onclick={() => setEnd(phase.id, phase.toDay! - 7)}
								disabled={(phaseLength(phase) ?? 0) <= 7}
							>
								− 1 week
							</button>
						</div>
					</div>
					<p class="hint">Adding or removing days moves every later phase too.</p>
				{:else}
					<p class="hint">This phase keeps going, so there's nothing after it to move.</p>
				{/if}
			</div>
			<label class="stack">
				<span class="label small">Sessions per day</span>
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
				<span class="label small">Dilators, in order</span>
				<StepsEditor
					bind:steps={phase.steps}
					dilators={draft.dilators}
					keepOne={phase.slots.length > 0}
				/>
			</div>
		</div>
	</details>
{/snippet}

<section class="group">
	<h2 class="group-title">Your schedule</h2>
	{#if problems.length}
		<div class="warning" role="alert">
			<strong>⚠️ These phases don't line up</strong>
			<ul>
				{#each problems as problem (problem.id)}
					<li>
						{#if problem.kind === 'overlap'}
							<b>{labelOf(problem.id)}</b> overlaps <b>{labelOf(problem.after)}</b>, so some days
							are counted twice.
						{:else}
							There's a gap of uncovered days before <b>{labelOf(problem.id)}</b>.
						{/if}
					</li>
				{/each}
			</ul>
			<button
				class="pill strong"
				onclick={() => (draft.phases = chainPhases($state.snapshot(draft.phases)))}
			>
				Tidy up, keeping each phase's length
			</button>
		</div>
	{/if}
	<div class="panel">
		<details>
			<summary>
				<span class="summary-text">
					<span class="label">Your dilators</span>
					<span class="hint meta">{draft.dilators.length} in your kit</span>
				</span>
			</summary>
			<div class="body">
				<p class="hint">Set these up once. Phases below just pick a dilator and a time.</p>
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
						<span class="hint">mm</span>
						<button
							class="pill"
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
				<div class="actions-row">
					<button class="pill" onclick={addDilator}>+ Add dilator</button>
				</div>
			</div>
		</details>

		<div class="block intro">
			<p class="hint">
				Each phase covers a range of days. Today's schedule is picked from the phase the date falls
				in.
			</p>
		</div>

		{#if pastCount > 0}
			<details class="past">
				<summary>
					<span class="summary-text">
						<span class="label">Earlier phases</span>
						<span class="hint meta">{pastCount} done</span>
					</span>
				</summary>
				<div class="nested">
					{#each draft.phases as phase, pi (phase.id)}
						{#if isPast(phase)}{@render phaseRow(phase, pi)}{/if}
					{/each}
				</div>
			</details>
		{/if}
		{#each draft.phases as phase, pi (phase.id)}
			{#if !isPast(phase)}{@render phaseRow(phase, pi)}{/if}
		{/each}

		<div class="block actions-row">
			<button class="pill strong" onclick={addPhase}>+ Add phase</button>
			<button class="pill" onclick={() => (choosingProgram = !choosingProgram)}>
				Load a WIH program…
			</button>
		</div>
	</div>
	{#if choosingProgram}
		<div class="choose-program" data-testid="choose-program">
			<p>
				<strong>Which program?</strong> This replaces all your dilators, phases and messages, including
				any changes you made.
			</p>
			{#each PROGRAMS as program (program.id)}
				<button class="program" data-program={program.id} onclick={() => loadProgram(program.id)}>
					<strong>{program.label}</strong>
					<span class="hint">{program.blurb}</span>
				</button>
			{/each}
			<button class="pill" onclick={() => (choosingProgram = false)}>Cancel</button>
		</div>
	{/if}
</section>

<!-- ───────────── Your data ───────────── -->
<section class="group">
	<h2 class="group-title">Your data</h2>
	<div class="panel">
		<div class="block">
			<span class="label">Back up your data 💾</span>
			<p class="hint">
				Your history and settings live only on this device. Save a copy before switching phones, or
				before moving to the app version.
			</p>
			<div class="actions-row">
				<button class="pill strong" onclick={saveBackup}>💾 Save backup</button>
				<label class="pill file">
					📂 Restore backup
					<input type="file" accept="application/json,.json" onchange={restoreBackup} />
				</label>
			</div>
			{#if backupNote}
				<p class="hint note-{backupNote.kind}" role="status">{backupNote.text}</p>
			{/if}
		</div>
		{#if !isNative()}
			<a class="item link" href="/welcome">
				<span class="text">
					<span class="label">Get the Android app</span>
					<span class="hint">or see what the web version can't do</span>
				</span>
				<span aria-hidden="true">→</span>
			</a>
		{/if}
	</div>
</section>

<p class="version hint" data-testid="version">
	Dilation timer v{APP_VERSION}{isNative() ? ' · app' : ''}
	{#if updates.available}
		· <a href={updates.available.downloadUrl}>v{updates.available.version} is available</a>
	{/if}
	· <a href="/privacy">Privacy</a>
</p>

<style>
	/* One look for the whole page: a section title in small capitals, then a single panel whose rows are
	   told apart by thin lines. Labels, hints and values each have one size, and buttons share one shape. */
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	h1 {
		margin: 0;
		font-size: 1.7rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.status {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--ok);
		text-align: right;
	}
	.status.waiting {
		color: var(--warn);
	}

	.here {
		display: grid;
		justify-items: start;
		gap: 0.4rem;
		padding: 1rem 1.1rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--accent-soft) 55%, var(--surface));
	}
	.here h2 {
		font-size: 1.3rem;
		font-weight: 900;
		color: var(--accent-strong);
	}

	.group {
		margin-top: 1.6rem;
	}
	.group-title {
		margin: 0 0.4rem 0.5rem;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.panel {
		overflow: hidden;
		border: 2px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.panel > * + * {
		border-top: 1px solid var(--line);
	}

	/* the three kinds of row */
	.item,
	.block,
	summary {
		padding: 0.9rem 1.1rem;
	}
	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.block {
		display: grid;
		gap: 0.6rem;
		border-left: 0;
		border-right: 0;
		border-bottom: 0;
		margin: 0;
		min-width: 0;
	}
	.block.intro {
		padding-top: 0.7rem;
		padding-bottom: 0.7rem;
	}
	.item-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.text {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
	a.item {
		color: var(--ink);
		text-decoration: none;
	}

	/* the three kinds of text */
	.label {
		font-size: 1rem;
		font-weight: 700;
		color: var(--ink);
	}
	.label.small {
		font-size: 0.9rem;
		color: var(--muted);
	}
	.hint {
		font-size: 0.82rem;
		font-weight: 500;
		line-height: 1.35;
		color: var(--muted);
	}
	.hint.ok {
		color: var(--ok);
		font-weight: 700;
	}
	.hint.bad,
	.note-error {
		color: var(--warn);
		font-weight: 700;
	}
	.note-ok {
		color: var(--ok);
		font-weight: 700;
	}
	.value {
		min-width: 3rem;
		text-align: right;
		font-size: 0.95rem;
		font-weight: 700;
	}
	code {
		font: inherit;
		font-weight: 700;
		color: var(--accent-strong);
	}

	/* one kind of button */
	.pill {
		appearance: none;
		border: 0;
		border-radius: 999px;
		padding: 0.45rem 0.95rem;
		background: color-mix(in srgb, var(--accent-soft) 75%, var(--surface));
		color: var(--accent-strong);
		font: inherit;
		font-size: 0.88rem;
		font-weight: 800;
		cursor: pointer;
		text-align: center;
	}
	.pill.strong {
		background: linear-gradient(180deg, var(--accent), var(--accent-strong));
		color: var(--accent-ink);
	}
	.pill:active:not(:disabled) {
		transform: scale(0.96);
	}
	.pill:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.here .pill {
		margin-top: 0.1rem;
	}

	/* fields sit on a soft tint instead of carrying a border of their own */
	.panel :global(input:not([type='checkbox'], [type='radio'], [type='range'], [type='color'])),
	.panel :global(select),
	.panel textarea {
		border: 2px solid transparent;
		background: color-mix(in srgb, var(--accent-soft) 40%, var(--surface));
		font: inherit;
		font-size: 0.95rem;
	}
	.panel :global(input:focus),
	.panel :global(select:focus),
	.panel textarea:focus {
		border-color: var(--accent);
	}
	.panel :global(.btn.ghost) {
		border: 0;
		background: color-mix(in srgb, var(--accent-soft) 75%, var(--surface));
		font-size: 0.88rem;
	}
	.panel :global(.stack .muted) {
		font-size: 0.82rem;
	}
	textarea {
		color: var(--ink);
		border-radius: 14px;
		padding: 0.6rem 0.8rem;
		resize: vertical;
		outline: none;
	}
	.num {
		width: 4.5rem;
	}
	.toggle {
		flex: none;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		accent-color: var(--accent-strong);
	}

	/* rows that unfold */
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::after {
		content: '›';
		flex: none;
		font-size: 1.4rem;
		line-height: 1;
		color: var(--muted);
		transition: transform 0.15s ease;
	}
	details[open] > summary::after {
		transform: rotate(90deg);
	}
	.summary-text {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.title {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.2rem 0.5rem;
	}
	.body {
		display: grid;
		gap: 0.9rem;
		padding: 0.2rem 1.1rem 1.1rem;
	}
	.nested > * + * {
		border-top: 1px solid var(--line);
	}
	.past > .nested {
		background: color-mix(in srgb, var(--accent-soft) 18%, var(--surface));
	}
	.phase.current {
		background: color-mix(in srgb, var(--accent-soft) 45%, var(--surface));
		box-shadow: inset 4px 0 0 var(--accent-strong);
	}
	.phase.past .label,
	.phase.past .hint {
		opacity: 0.75;
	}
	.badge {
		font-size: 0.72rem;
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

	/* little layout helpers */
	.row,
	.actions-row {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.stack {
		display: grid;
		gap: 0.4rem;
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.inline {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.resize {
		display: grid;
		justify-items: start;
		gap: 0.5rem;
	}
	.color {
		width: 2.4rem;
		height: 2.4rem;
		padding: 0.15rem;
		border-radius: 50%;
		cursor: pointer;
	}
	.nickname {
		flex-basis: 100%;
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
	.file {
		position: relative;
	}
	.file input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	/* the friend picker */
	.companion {
		border: 0;
	}
	.companion legend {
		float: left;
		width: 100%;
		padding: 0;
		margin-bottom: 0.6rem;
	}
	.tiles {
		clear: both;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}
	.tile {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 0.2rem;
		padding: 0.6rem 0.4rem 0.5rem;
		border: 2px solid transparent;
		border-radius: 18px;
		background: color-mix(in srgb, var(--accent-soft) 35%, var(--surface));
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
	}
	.tile.chosen {
		border-color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent-soft) 70%, var(--surface));
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

	/* warnings and the program chooser sit outside the panels */
	.warning {
		display: grid;
		gap: 0.5rem;
		justify-items: start;
		margin-bottom: 0.8rem;
		padding: 0.9rem 1.1rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warn) 12%, var(--surface));
	}
	.warning ul {
		margin: 0;
		padding-left: 1.1rem;
		font-size: 0.9rem;
	}
	.choose-program {
		display: grid;
		gap: 0.7rem;
		margin-top: 0.8rem;
		padding: 1rem 1.1rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--accent-soft) 40%, var(--surface));
	}
	.program {
		display: grid;
		gap: 0.25rem;
		text-align: left;
		font: inherit;
		color: var(--ink);
		padding: 0.8rem 1rem;
		border: 0;
		border-radius: 16px;
		background: var(--surface);
		cursor: pointer;
	}
	.program strong {
		color: var(--accent-strong);
	}
	.version {
		margin-top: 1.6rem;
		text-align: center;
		font-size: 0.78rem;
		opacity: 0.8;
	}
</style>
