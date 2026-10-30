<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDuration, totalMinutes } from '#lib/customSession.ts';
	import { addDays, formatDateRange, formatScheduleDate } from '#lib/dates.ts';
	import { PROGRAMS, wihPhases } from '#lib/defaults.ts';
	import { ask } from '#lib/dialog.svelte.ts';
	import { wihDilators } from '#lib/dilators.ts';
	import {
		chainPhases,
		findPhaseProblems,
		phaseLength,
		pushBackPhase,
		resizePhase
	} from '#lib/phases.ts';
	import { phaseProgress } from '#lib/schedule.ts';
	import { useSettingsForm } from '#lib/settingsForm.svelte.ts';
	import StepsEditor from '#lib/StepsEditor.svelte';
	import Stepper from '#lib/Stepper.svelte';
	import type { Phase, ProgramId } from '#lib/types.ts';

	const form = useSettingsForm();
	const draft = form.draft;
	const hasDate = $derived(form.hasDate);
	const day = $derived(form.day);

	function dateRange(from: number, to: number | null): string {
		return formatDateRange(
			addDays(draft.startDate, from - 1),
			to === null ? null : addDays(draft.startDate, to - 1),
			Number(draft.startDate.slice(0, 4))
		);
	}

	// "Jump to this phase" from the Settings menu lands here
	onMount(() => {
		if (location.hash === '#current-phase') {
			document
				.getElementById('current-phase')
				?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	});

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

	/** What the last "push back" did, so it can be undone. Gone when this page is left. */
	let pushNote = $state<{ label: string; days: number; before: Phase[] } | null>(null);

	/** Starts a phase later: it and everything after it move back, and the phase before it carries on. */
	function pushBack(phase: Phase, days: number) {
		const before = $state.snapshot(draft.phases);
		const next = pushBackPhase(before, phase.id, days);
		if (next === before) return;
		draft.phases = next;
		pushNote = { label: phase.label, days, before };
	}

	function undoPushBack() {
		if (!pushNote) return;
		draft.phases = pushNote.before;
		pushNote = null;
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

	/** Which phase's name is being edited. The name is not shown as a field until you ask to rename. */
	let renaming = $state<string | null>(null);
	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	let choosingProgram = $state(false);

	/** Replaces the whole schedule (and dilators and messages) with a ready-made WIH program. */
	function loadProgram(program: ProgramId) {
		draft.dilators = wihDilators();
		draft.phases = wihPhases(program);
		form.resetMessages();
		choosingProgram = false;
	}
</script>

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
					· {formatDuration(totalMinutes(phase.steps))}
				</span>
			</span>
		</summary>
		<div class="body sections">
			<label class="field-row">
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

			{#if phase.toDay !== null}
				<div class="sect">
					<div class="field-row">
						<span class="label small">Ends on</span>
						<Stepper
							value={phase.toDay}
							min={phase.fromDay}
							display={hasDate
								? formatScheduleDate(
										addDays(draft.startDate, phase.toDay - 1),
										Number(draft.startDate.slice(0, 4))
									)
								: `Day ${phase.toDay}`}
							label="end day"
							onchange={(n) => setEnd(phase.id, n)}
						/>
					</div>
					<div class="row">
						<button
							class="pill"
							onclick={() => setEnd(phase.id, phase.toDay! - 7)}
							disabled={(phaseLength(phase) ?? 0) <= 7}
						>
							− 1 week
						</button>
						<button class="pill" onclick={() => setEnd(phase.id, phase.toDay! + 7)}>
							+ 1 week
						</button>
					</div>
				</div>
			{:else}
				<p class="hint">This phase keeps going, so there's nothing after it to move.</p>
			{/if}

			<div class="sect">
				<span class="label small">Dilators, in order</span>
				<StepsEditor
					bind:steps={phase.steps}
					dilators={draft.dilators}
					keepOne={phase.slots.length > 0}
					minuteStep={5}
				/>
				<div class="total" data-testid="phase-total">
					<span>Total per session</span>
					<strong>{formatDuration(totalMinutes(phase.steps))}</strong>
				</div>
			</div>

			{#if progress !== 'past'}
				<div class="sect">
					<div class="field-row">
						<span class="label small">Not ready yet?</span>
						<div class="row">
							<button class="pill" onclick={() => pushBack(phase, 1)}>Push back 1 day</button>
							<button class="pill" onclick={() => pushBack(phase, 7)}>1 week</button>
						</div>
					</div>
					<p class="hint">This phase and every one after it start later.</p>
				</div>
			{/if}

			<div class="sect row">
				{#if renaming === phase.id}
					<input
						class="grow"
						bind:value={phase.label}
						aria-label="Phase name"
						use:focusAndSelect
						onblur={() => (renaming = null)}
						onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
					/>
				{:else}
					<button class="pill" onclick={() => (renaming = phase.id)}>Rename</button>
					<button
						class="pill"
						onclick={async () =>
							(await ask({
								title: `Remove ${phase.label}?`,
								message: 'The days it covers will have no routine until you add one.',
								confirmLabel: 'Yes, remove it',
								cancelLabel: 'Keep it',
								danger: true
							})) &&
							draft.phases.splice(
								draft.phases.findIndex((p) => p.id === phase.id),
								1
							)}
						disabled={draft.phases.length === 1}>Remove</button
					>
				{/if}
			</div>
		</div>
	</details>
{/snippet}

<section class="group">
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
	{#if pushNote}
		<div class="notice" role="status">
			<span
				>Pushed back {pushNote.label} by {pushNote.days === 7
					? '1 week'
					: `${pushNote.days} day`}.</span
			>
			<button class="pill strong" onclick={undoPushBack}>Undo</button>
		</div>
	{/if}
	<div class="panel">
		<div class="block intro">
			<p class="hint">
				Each phase covers a range of days. Today's schedule is picked from the phase the date falls
				in. Your dilators are set up under About you.
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
