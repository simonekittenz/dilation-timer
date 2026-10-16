import { defaultSettings } from './defaults';
import { PALETTE } from './dilators';
import type { Dilator, LogEntry, Phase, Settings, SlotId } from './types';

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
	if (!Array.isArray(times) || times.length <= 1) return ['daily'];
	return ['morning', 'evening'];
}

interface LegacyStep {
	label?: string;
	dilatorId?: string;
	minutes: number;
}

/** Old steps carried their own name; hook them up to (or create) a global dilator. */
function migrateSteps(steps: LegacyStep[], dilators: Dilator[]) {
	return steps.map((st) => {
		if (st.dilatorId) return { dilatorId: st.dilatorId, minutes: st.minutes };
		const name = st.label?.trim() || 'Dilator';
		let d = dilators.find((x) => x.name.toLowerCase() === name.toLowerCase());
		if (!d) {
			d = {
				id: `d-${crypto.randomUUID().slice(0, 8)}`,
				name,
				color: PALETTE[dilators.length % PALETTE.length]
			};
			dilators.push(d);
		}
		return { dilatorId: d.id, minutes: st.minutes };
	});
}

export function migrateSettings(saved: Partial<Settings> | undefined): Settings {
	const base = defaultSettings();
	if (!saved) return base;
	const dilators = structuredClone(saved.dilators ?? base.dilators);
	const phases = (saved.phases ?? base.phases).map((p) => {
		const legacy = p as unknown as { times?: unknown; slots?: SlotId[]; steps: LegacyStep[] };
		const { times, ...rest } = legacy;
		return {
			...(rest as object),
			slots: legacy.slots ?? slotsFromTimes(times),
			steps: migrateSteps(legacy.steps ?? [], dilators)
		} as Phase;
	});
	return { ...base, ...saved, dilators, phases };
}

export function migrateLog(log: LogEntry[]): LogEntry[] {
	return log.map((e) => ({ ...e, slot: normalizeSlot(e.slot) }));
}
