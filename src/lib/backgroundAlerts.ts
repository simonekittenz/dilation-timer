import { alertStart, plannedEnd } from './session';
import type { ActiveSession, SessionStep } from './types';

/** Alerts get ids in this range, so they can all be found and cancelled again. */
export const ALERT_ID = 41_000;
/** How many "still waiting" reminders to send after the first alert, and how far apart. */
export const MAX_NUDGES = 8;
export const NUDGE_EVERY_MS = 60_000;

export type AlertKind = 'switch' | 'nudge' | 'done';

export interface BackgroundAlert {
	id: number;
	/** When to show it, as a timestamp. */
	at: number;
	kind: AlertKind;
	title: string;
	body: string;
}

const who = (step: SessionStep) =>
	step.nickname ? `${step.label} “${step.nickname}”` : step.label;

function nudges(next: SessionStep, firstAt: number, now: number): BackgroundAlert[] {
	const alerts: BackgroundAlert[] = [];
	for (let k = 0; k < MAX_NUDGES; k++) {
		const at = firstAt + k * NUDGE_EVERY_MS;
		if (at <= now) continue;
		alerts.push({
			id: ALERT_ID + 1 + k,
			at,
			kind: 'nudge',
			title: 'Psst! Time to switch',
			body: `Still waiting on ${who(next)}. Swap, then press “I switched ✓” in the app.`
		});
	}
	return alerts;
}

/**
 * What the phone's alarm clock should do while the app can't: the alerts to schedule when the app
 * goes to the background or the screen locks. Everything is worked out from the session's saved
 * timestamps, so it is the same plan the app itself would have followed.
 */
export function planBackgroundAlerts(
	s: ActiveSession | null,
	now: number,
	switchWindowMs: number
): BackgroundAlert[] {
	if (!s || s.phase === 'finished') return [];
	if (s.phase === 'running' && s.pausedAt != null) return [];

	const next = s.steps[s.stepIndex + 1];

	if (s.phase === 'running') {
		const end = plannedEnd(s);
		if (end <= now) return []; // the app itself is about to move on
		if (!next) {
			return [
				{
					id: ALERT_ID,
					at: end,
					kind: 'done',
					title: 'All done! 🎉',
					body: 'Take the last one out. Open the app to save your session.'
				}
			];
		}
		return [
			{
				id: ALERT_ID,
				at: end,
				kind: 'switch',
				title: 'Time to switch ♡',
				body: `Swap to ${who(next)}, then open the app and press “I switched ✓”.`
			},
			...nudges(next, end + switchWindowMs, now)
		];
	}

	// 'switch': the timer is over and we're waiting for "I switched"
	if (!next) return [];
	return nudges(next, Math.max(alertStart(s) + switchWindowMs, now + 2_000), now);
}
