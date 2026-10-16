import { toDateString } from './dates';
import type { Settings } from './types';

/** Placeholder routine — replace in Settings with whatever your care team gave you. */
export function defaultSettings(today = new Date()): Settings {
	return {
		startDate: toDateString(today),
		phases: [
			{
				id: 'phase-1',
				label: 'Phase 1',
				fromDay: 1,
				toDay: 14,
				times: ['08:00', '12:00', '16:00', '20:00'],
				steps: [
					{ label: 'Dilator 1', minutes: 10 },
					{ label: 'Dilator 2', minutes: 10 }
				]
			},
			{
				id: 'phase-2',
				label: 'Phase 2',
				fromDay: 15,
				toDay: null,
				times: ['09:00', '18:00'],
				steps: [
					{ label: 'Dilator 2', minutes: 10 },
					{ label: 'Dilator 3', minutes: 10 }
				]
			}
		]
	};
}
