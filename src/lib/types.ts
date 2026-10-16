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
	switch: string[];
	done: string[];
}

export interface Settings {
	/** Local date (YYYY-MM-DD) that counts as day 1. */
	startDate: string;
	/** Calm grace period after a timer ends before the alarm escalates. */
	leewayMinutes: number;
	dilators: Dilator[];
	messages: Messages;
	phases: Phase[];
}

export type SessionPhase = 'running' | 'switch' | 'finished';

export interface StepRecord {
	label: string;
	nickname?: string;
	color?: string;
	plannedMinutes: number;
	startedAt: number;
	endedAt: number | null;
}

export interface ActiveSession {
	id: string;
	date: string;
	slot: SlotId | null;
	startedAt: number;
	steps: SessionStep[];
	stepIndex: number;
	stepStartedAt: number;
	phase: SessionPhase;
	warned: boolean;
	records: StepRecord[];
}

export interface LogEntry {
	id: string;
	date: string;
	slot: SlotId | null;
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
	}[];
}

export type SlotStatus = 'done' | 'skipped' | 'overdue' | 'due' | 'upcoming';

export interface SlotView {
	slot: SlotId;
	label: string;
	status: SlotStatus;
	entry?: LogEntry;
}
