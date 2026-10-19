import { defaultSettings } from './defaults';
import { PALETTE } from './dilators';
import type { Dilator, LogEntry, Phase, Settings, SlotId } from './types';

const TIME = /^(\d{1,2}):\d{2}$/;
const OLD_BUNNY_MESSAGE = 'The bunny is doing a happy hop for you 🐰';

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
	const messages = {
		running: saved.messages?.running ?? base.messages.running,
		// the old default named the bunny; it now follows whichever friend you pick
		done: (saved.messages?.done ?? base.messages.done).map((m) =>
			m === OLD_BUNNY_MESSAGE ? base.messages.done.at(-1)! : m
		)
	};
	const mascot = saved.mascot === 'kitty' ? 'kitty' : 'bunny';
	const { leewayMinutes, ...rest } = saved as Partial<Settings> & { leewayMinutes?: number };
	// "leeway" was the old name for the switch window; an untouched old default of 2 becomes 1.
	const legacyWindow = leewayMinutes === 2 ? base.switchWindowMinutes : leewayMinutes;
	const switchWindowMinutes = saved.switchWindowMinutes ?? legacyWindow ?? base.switchWindowMinutes;
	// anything saved before first-run setup existed is an established user: never ask them
	const setup =
		saved.setup === 'ask-program' || saved.setup === 'ask-date' || saved.setup === 'confirm'
			? saved.setup
			: 'done';
	return { ...base, ...rest, switchWindowMinutes, dilators, messages, mascot, setup, phases };
}

export function migrateLog(log: LogEntry[]): LogEntry[] {
	return log.map((e) => ({ ...e, slot: normalizeSlot(e.slot) }));
}
