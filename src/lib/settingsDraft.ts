import { parseMessages } from './messages';
import type { Phase, Settings } from './types';

export interface MessageText {
	running: string;
	done: string;
}

export function messagesToText(m: Settings['messages']): MessageText {
	return { running: m.running.join('\n'), done: m.done.join('\n') };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Keeps the volume between 0 (silent) and 100; a blank or broken value means full volume. */
export function clampVolume(v: unknown): number {
	const n = Number(v);
	return Number.isFinite(n) && v !== null && v !== ''
		? Math.min(100, Math.max(0, Math.round(n)))
		: 100;
}

/**
 * Turns the Settings form state into settings that are safe to store.
 * Returns null while a field is mid-edit and unusable (empty date, blank day number),
 * so autosave simply waits instead of saving garbage.
 */
export function buildSettings(draft: Settings, text: MessageText): Settings | null {
	if (!DATE.test(draft.startDate)) return null;
	if (draft.phases.some((p) => typeof p.fromDay !== 'number' || !Number.isFinite(p.fromDay))) {
		return null;
	}

	const dilators = draft.dilators.map((d) => ({
		...d,
		name: d.name.trim() || 'Dilator',
		nickname: d.nickname?.trim() || undefined,
		diameterMm: d.diameterMm ? Number(d.diameterMm) : undefined
	}));

	const phases: Phase[] = draft.phases.map((p) => ({
		...p,
		toDay: typeof p.toDay === 'number' && Number.isFinite(p.toDay) ? p.toDay : null,
		steps: p.steps.filter((s) => s.minutes > 0 && dilators.some((d) => d.id === s.dilatorId))
	}));

	return {
		startDate: draft.startDate,
		switchWindowMinutes: Math.max(0, Number(draft.switchWindowMinutes) || 0),
		volume: clampVolume(draft.volume),
		mascot: draft.mascot === 'kitty' ? 'kitty' : 'bunny',
		setup: draft.setup,
		dilators,
		messages: {
			running: parseMessages(text.running),
			done: parseMessages(text.done)
		},
		phases
	};
}
