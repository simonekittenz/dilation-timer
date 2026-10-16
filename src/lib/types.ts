/** A part of the day rather than a clock time: 'daily' is a once-a-day session. */
export type SlotId = 'morning' | 'evening' | 'daily';

export interface Step {
	label: string;
	minutes: number;
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

export interface Settings {
	/** Local date (YYYY-MM-DD) that counts as day 1. */
	startDate: string;
	/** Calm grace period after a timer ends before the alarm escalates. */
	leewayMinutes: number;
	phases: Phase[];
}

export type SessionPhase = 'running' | 'switch' | 'finished';

export interface StepRecord {
	label: string;
	plannedMinutes: number;
	startedAt: number;
	endedAt: number | null;
}

export interface ActiveSession {
	id: string;
	date: string;
	slot: SlotId | null;
	startedAt: number;
	steps: Step[];
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
	steps: { label: string; plannedMinutes: number; actualSeconds: number }[];
}

export type SlotStatus = 'done' | 'skipped' | 'overdue' | 'due' | 'upcoming';

export interface SlotView {
	slot: SlotId;
	label: string;
	status: SlotStatus;
	entry?: LogEntry;
}
