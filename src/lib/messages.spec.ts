import { describe, expect, it } from 'vitest';
import { DEFAULT_MESSAGES, parseMessages, pickMessage } from './messages';
import { migrateSettings } from './migrate';
import { resolveSteps } from './dilators';
import { defaultSettings } from './defaults';

describe('messages', () => {
	it('picks the same message for the same seed', () => {
		const list = ['a', 'b', 'c', 'd', 'e'];
		expect(pickMessage(list, 'seed-1', 'x')).toBe(pickMessage(list, 'seed-1', 'x'));
		const picks = new Set(Array.from({ length: 40 }, (_, i) => pickMessage(list, `s${i}`, 'x')));
		expect(picks.size).toBeGreaterThan(1);
	});

	it('fills in the dilator name and ignores blanks', () => {
		expect(pickMessage(['  ', 'Go {name}!'], 'z', 'Sunny')).toBe('Go Sunny!');
		expect(pickMessage([], 'z', 'Sunny')).toBeNull();
		expect(pickMessage(['', '  '], 'z', 'Sunny')).toBeNull();
	});

	it('parses one message per line', () => {
		expect(parseMessages(' hi \n\n  there ♡\n')).toEqual(['hi', 'there ♡']);
	});

	it('ships defaults for every moment', () => {
		for (const list of Object.values(DEFAULT_MESSAGES)) expect(list.length).toBeGreaterThan(2);
	});

	it('gives older saves the default messages, but keeps custom ones', () => {
		expect(migrateSettings({ startDate: '2026-01-01' }).messages.done.length).toBeGreaterThan(0);
		const custom = migrateSettings({
			messages: { running: ['mine'], switch: [], done: [] }
		});
		expect(custom.messages.running).toEqual(['mine']);
		expect(custom.messages.switch).toEqual([]);
	});

	it('carries nicknames into session steps', () => {
		const s = defaultSettings();
		s.dilators[2].nickname = 'Sunny';
		const steps = resolveSteps(s.dilators, [{ dilatorId: 'd2', minutes: 5 }]);
		expect(steps[0]).toMatchObject({ label: 'Dilator 2', nickname: 'Sunny' });
	});
});
