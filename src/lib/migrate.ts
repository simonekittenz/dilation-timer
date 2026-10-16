import { defaultSettings } from './defaults';
import type { LogEntry, Settings, SlotId } from './types';

const TIME = /^(\d{1,2}):\d{2}$/;

/** Older versions stored clock times ("08:00"); map them to parts of the day. */
export function normalizeSlot(raw: unknown): SlotId | null {
	if (raw === 'morning' || raw === 'evening' || raw === 'daily') return raw;
	if (typeof raw === 'string') {
		const m = TIME.exec(raw);
		if (m) return Number(m[1]) < 12 ? 'morning' : 'evening';
	}
	return null;
}

function slotsFromTimes(times: unknown): SlotId[] {
	if (!Array.isArray(times) || times.length === 0) return ['daily'];
	if (times.length === 1) return ['daily'];
	return ['morning', 'evening'];
}

export function migrateSettings(saved: Partial<Settings> | undefined): Settings {
	const base = defaultSettings();
	if (!saved) return base;
	const merged: Settings = { ...base, ...saved };
	merged.phases = (saved.phases ?? base.phases).map((p) => {
		const legacy = p as unknown as { times?: unknown; slots?: SlotId[] };
		const { times, ...rest } = legacy;
		return {
			...(rest as object),
			slots: legacy.slots ?? slotsFromTimes(times)
		} as Settings['phases'][number];
	});
	return merged;
}

export function migrateLog(log: LogEntry[]): LogEntry[] {
	return log.map((e) => ({ ...e, slot: normalizeSlot(e.slot) }));
}
