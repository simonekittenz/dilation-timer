import type { Dilator, SessionStep, Settings, Step } from './types';

/** Sizes and colors from the WIH program chart. */
export const WIH_DILATORS: Dilator[] = [
	{ id: 'd0', name: 'Dilator 0', color: '#d6c9f5', diameterMm: 20 },
	{ id: 'd1', name: 'Dilator 1', color: '#5a4b9c', diameterMm: 23 },
	{ id: 'd2', name: 'Dilator 2', color: '#f2c94c', diameterMm: 26 },
	{ id: 'd3', name: 'Dilator 3', color: '#ef7f8a', diameterMm: 29 },
	{ id: 'd4', name: 'Dilator 4', color: '#b9a6ec', diameterMm: 32 },
	// Real, but not part of the standard schedule, so no phase uses it. Diameter left for you to fill in.
	{ id: 'd5', name: 'Dilator 5', color: '#6cc3b5' }
];

export function wihDilators(): Dilator[] {
	return structuredClone(WIH_DILATORS);
}

/** Pastel-ish colors to hand out to newly added dilators. */
export const PALETTE = ['#ff9ccb', '#7fd6c2', '#8ec5ff', '#ffb870', '#c3e88d', '#d7a8ff'];

export const FALLBACK_COLOR = '#ff9ccb';

export function dilatorLabel(d: Dilator): string {
	return d.nickname ? `${d.name} (${d.nickname})` : d.name;
}

export function resolveSteps(dilators: Dilator[], steps: Step[]): SessionStep[] {
	return steps.map((s) => {
		const d = dilators.find((x) => x.id === s.dilatorId);
		return {
			label: d?.name ?? 'Dilator',
			nickname: d?.nickname || undefined,
			minutes: s.minutes,
			color: d?.color ?? FALLBACK_COLOR,
			diameterMm: d?.diameterMm
		};
	});
}

export function stepsInUse(settings: Settings): Set<string> {
	return new Set(settings.phases.flatMap((p) => p.steps.map((s) => s.dilatorId)));
}
