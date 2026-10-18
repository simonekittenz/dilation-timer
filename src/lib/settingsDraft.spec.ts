import { describe, expect, it } from 'vitest';
import { defaultSettings } from './defaults';
import { buildSettings, clampVolume, messagesToText } from './settingsDraft';

const fresh = () => {
	const s = defaultSettings(new Date(2026, 0, 1));
	return { draft: structuredClone(s), text: messagesToText(s.messages) };
};

describe('buildSettings', () => {
	it('round-trips untouched settings', () => {
		const { draft, text } = fresh();
		const out = buildSettings(draft, text)!;
		expect(out.startDate).toBe('2026-01-01');
		expect(out.phases).toHaveLength(draft.phases.length);
		expect(out.messages).toEqual(draft.messages);
	});

	it('waits (returns null) while the date or a day number is blank', () => {
		const a = fresh();
		a.draft.startDate = '';
		expect(buildSettings(a.draft, a.text)).toBeNull();

		const b = fresh();
		(b.draft.phases[2] as { fromDay: number | null }).fromDay = null;
		expect(buildSettings(b.draft, b.text)).toBeNull();
	});

	it('drops zero-minute steps and steps pointing at deleted dilators', () => {
		const { draft, text } = fresh();
		const week2 = draft.phases.find((p) => p.id === 'wih-week-2')!;
		week2.steps[0].minutes = 0;
		week2.steps[1].dilatorId = 'gone';
		expect(buildSettings(draft, text)!.phases.find((p) => p.id === 'wih-week-2')!.steps).toEqual(
			[]
		);
	});

	it('cleans up names, nicknames, switch window and messages', () => {
		const { draft, text } = fresh();
		draft.dilators[0].name = '  ';
		draft.dilators[1].nickname = '  Pip  ';
		draft.dilators[2].nickname = '   ';
		(draft as { switchWindowMinutes: number | null }).switchWindowMinutes = null;
		text.done = 'yay\n\n  woo  \n';
		const out = buildSettings(draft, text)!;
		expect(out.dilators[0].name).toBe('Dilator');
		expect(out.dilators[1].nickname).toBe('Pip');
		expect(out.dilators[2].nickname).toBeUndefined();
		expect(out.switchWindowMinutes).toBe(0);
		expect(out.messages.done).toEqual(['yay', 'woo']);
	});

	it('treats a blank "to day" as open-ended', () => {
		const { draft, text } = fresh();
		(draft.phases[1] as { toDay: number | null | string }).toDay = '';
		expect(buildSettings(draft, text)!.phases[1].toDay).toBeNull();
	});

	it('keeps the volume between 0 and 100, and full when blank', () => {
		expect(clampVolume(70)).toBe(70);
		expect(clampVolume(0)).toBe(0); // silent is allowed
		expect(clampVolume(3)).toBe(3);
		expect(clampVolume(-20)).toBe(0);
		expect(clampVolume(250)).toBe(100);
		expect(clampVolume('55')).toBe(55);
		expect(clampVolume(null)).toBe(100);
		expect(clampVolume('')).toBe(100);
		expect(clampVolume(NaN)).toBe(100);
		const { draft, text } = fresh();
		draft.volume = 40;
		expect(buildSettings(draft, text)!.volume).toBe(40);
	});

	it('only stores a known friend', () => {
		const { draft, text } = fresh();
		draft.mascot = 'kitty';
		expect(buildSettings(draft, text)!.mascot).toBe('kitty');
		(draft as { mascot: string }).mascot = 'dragon';
		expect(buildSettings(draft, text)!.mascot).toBe('bunny');
	});
});
