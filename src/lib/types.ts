/** A part of the day rather than a clock time: 'daily' is a once-a-day session. */
export type SlotId = 'morning' | 'evening' | 'daily';

/** One dilator in your kit. Defined once in Settings, referenced by id from phases. */
export interface Dilator {
	id: string;
	name: string;
	/** Optional pet name, shown next to the real one. */
	nickname?: string;
	/** CSS color, e.g. "#f2c94c". */
	color: string;
	diameterMm?: number;
}

/** A phase step: which dilator, for how long. */
export interface Step {
	dilatorId: string;
	minutes: number;
}

/** A step resolved against the dilator list when a session starts. */
export interface SessionStep {
	label: string;
	nickname?: string;
	minutes: number;
	color: string;
	diameterMm?: number;
}

/** A block of days sharing one routine. `toDay: null` means "from fromDay onwards". */
export interface Phase {
	id: string;
	label: string;
	fromDay: number;
	toDay: number | null;
	/** Parts of the day that get a session. */
	slots: SlotId[];
	steps: Step[];
}

export interface Messages {
	running: string[];
	done: string[];
}

/** Which little friend keeps you company. */
export type MascotKind = 'bunny' | 'kitty';

/**
 * First-run setup, shown on the Today screen. Saves from before this existed count as `done`.
 *  - ask-program: which ready-made schedule to start from
 *  - ask-date: we don't know the surgery date yet
 *  - ask-streak: a date was chosen; the day streak on/off question is still to be answered
 *  - confirm: the streak question was answered; "does this look right?" is still to be answered
 */
export type SetupStage = 'ask-program' | 'ask-date' | 'ask-streak' | 'confirm' | 'done';

/** The ready-made WIH schedules. Everything in a schedule can still be edited afterwards. */
export type ProgramId = 'standard' | 'size5';

/** Daily reminders to start a session (the phone app only). */
export interface Reminders {
	enabled: boolean;
	/** The clock time (HH:MM) of the reminder for each part of the day. */
	times: Record<SlotId, string>;
}

export interface Settings {
	/** Local date (YYYY-MM-DD) that counts as day 1. */
	startDate: string;
	/** How long you get to switch dilators after a timer ends before the alarm escalates. */
	switchWindowMinutes: number;
	/** Extra minutes added to the swap window the first time you use a dilator. Missing means 2. */
	newDilatorExtraMinutes?: number;
	/** Where the first-run setup is up to. Missing means done. */
	setup?: SetupStage;
	/** Alarm volume, 0 (silent) to 100. */
	volume: number;
	mascot: MascotKind;
	/** Show a small, dismissible message on each monthly and yearly milestone. Missing means yes. */
	celebrations?: boolean;
	/** Show the day streak on Today. Missing means yes. */
	streak?: boolean;
	/** Android app: keep the running session's timer on the lock screen. Missing means yes. */
	lockScreenTimer?: boolean;
	/** Show the clock (with Pause and Reset) on the start screen. It is timed either way. Missing means yes. */
	showStartTimer?: boolean;
	/** Daily reminders to start a session. Missing means never set up. */
	reminders?: Reminders;
	dilators: Dilator[];
	messages: Messages;
	phases: Phase[];
}

/** 'start': the session has begun and is waiting for "Ready" before the first timer runs. */
export type SessionPhase = 'start' | 'running' | 'switch' | 'finished';

export interface StepRecord {
	label: string;
	nickname?: string;
	color?: string;
	plannedMinutes: number;
	startedAt: number;
	endedAt: number | null;
	/** The first dilator only: how long it took from starting the session to pressing "Ready". */
	readyAfterMs?: number;
	/** How long it took to get to this dilator: from the previous timer ending to "I switched". */
	switchedAfterMs?: number;
	/** The nudge had already started when "I switched" was pressed. */
	switchNudged?: boolean;
	/** "+1 min" or "Chill out" was used during this swap. */
	switchAskedMore?: boolean;
}

export interface ActiveSession {
	id: string;
	date: string;
	slot: SlotId | null;
	/** Made up on the spot ("Custom session") instead of following the schedule. */
	custom?: boolean;
	startedAt: number;
	steps: SessionStep[];
	stepIndex: number;
	stepStartedAt: number;
	phase: SessionPhase;
	warned: boolean;
	/** When the timer was paused (null while running). Older saved sessions won't have this. */
	pausedAt?: number | null;
	/** The start screen's clock counts from here (set by Reset and Continue). Missing means `startedAt`. */
	waitSince?: number;
	/** Minutes added or removed from the current step with the +/- buttons. */
	adjustMs?: number;
	/** When the current step's timer ended (or was skipped), used for the switch window and overtime. */
	alertSince?: number | null;
	/** Extra gentle time added with "+1 min" on the switch screen. Applies to this switch only. */
	windowExtraMs?: number;
	/** "Chill out, I'm on it": no nudging before this moment. Applies to this switch only. */
	quietUntil?: number | null;
	records: StepRecord[];
}

export interface LogEntry {
	id: string;
	date: string;
	slot: SlotId | null;
	/** Made up on the spot ("Custom session") instead of following the schedule. */
	custom?: boolean;
	startedAt: number;
	finishedAt: number;
	/** Set when the slot was skipped instead of done. */
	skipped?: boolean;
	steps: {
		label: string;
		nickname?: string;
		color?: string;
		plannedMinutes: number;
		actualSeconds: number;
		/** The first dilator only: seconds from starting the session to pressing "Ready". */
		readySeconds?: number;
		/** Seconds between the previous timer ending and pressing "I switched" to start this one. */
		switchSeconds?: number;
		/** The nudge had already started when "I switched" was pressed. */
		switchNudged?: boolean;
		/** "+1 min" or "Chill out" was used during this swap. */
		switchAskedMore?: boolean;
	}[];
}

export type SlotStatus = 'done' | 'skipped' | 'overdue' | 'due' | 'upcoming';

export interface SlotView {
	slot: SlotId;
	label: string;
	status: SlotStatus;
	entry?: LogEntry;
}
