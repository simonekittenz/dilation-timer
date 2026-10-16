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
	/** Suggested session times, "HH:MM" 24h. */
	times: string[];
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
	slot: string | null;
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
	slot: string | null;
	startedAt: number;
	finishedAt: number;
	steps: { label: string; plannedMinutes: number; actualSeconds: number }[];
}

export type SlotStatus = 'done' | 'overdue' | 'upcoming';

export interface SlotView {
	time: string;
	status: SlotStatus;
	entry?: LogEntry;
}
