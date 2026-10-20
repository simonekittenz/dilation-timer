import { describe, expect, it } from 'vitest';
import { migrateLog, migrateSettings, normalizeSlot } from './migrate';
import type { LogEntry, Settings } from './types';

describe('migrate', () => {
	it('maps clock times to parts of the day', () => {
		expect(normalizeSlot('08:00')).toBe('morning');
		expect(normalizeSlot('20:00')).toBe('evening');
		expect(normalizeSlot('evening')).toBe('evening');
		expect(normalizeSlot(null)).toBeNull();
	});

	it('converts phases that still have times and named steps', () => {
		const legacy = {
			startDate: '2026-01-01',
			phases: [
				{ id: 'a', label: 'A', fromDay: 1, toDay: 7, times: ['09:00'], steps: [] },
				{
					id: 'b',
					label: 'B',
					fromDay: 8,
					toDay: null,
					times: ['08:00', '20:00'],
					steps: [
						{ label: 'Dilator 2', minutes: 10 },
						{ label: 'My special one', minutes: 5 }
					]
				}
			]
		} as unknown as Settings;
		const out = migrateSettings(legacy);
		expect(out.phases.map((p) => p.slots)).toEqual([['daily'], ['morning', 'evening']]);
		expect('times' in out.phases[0]).toBe(false);
		expect(out.switchWindowMinutes).toBe(1);
		const [known, custom] = out.phases[1].steps;
		expect(known.dilatorId).toBe('d2');
		const created = out.dilators.find((d) => d.id === custom.dilatorId);
		expect(created?.name).toBe('My special one');
		expect(out.dilators).toHaveLength(7);
	});

	it('renames leeway to switch window, keeping a custom value', () => {
		const custom = migrateSettings({ leewayMinutes: 4 } as unknown as Settings);
		expect(custom.switchWindowMinutes).toBe(4);
		expect('leewayMinutes' in custom).toBe(false);
		const untouchedOldDefault = migrateSettings({ leewayMinutes: 2 } as unknown as Settings);
		expect(untouchedOldDefault.switchWindowMinutes).toBe(1);
		const already = migrateSettings({ switchWindowMinutes: 3 });
		expect(already.switchWindowMinutes).toBe(3);
	});

	it('gives older saves full volume, and keeps a chosen one', () => {
		expect(migrateSettings({ startDate: '2026-01-01' }).volume).toBe(100);
		expect(migrateSettings({ volume: 60 }).volume).toBe(60);
	});

	it('defaults to the bunny, and keeps a chosen kitty', () => {
		expect(migrateSettings({ startDate: '2026-01-01' }).mascot).toBe('bunny');
		expect(migrateSettings({ mascot: 'kitty' }).mascot).toBe('kitty');
		expect(migrateSettings({ mascot: 'dragon' } as never).mascot).toBe('bunny');
	});

	it('updates the old bunny-only finish message but leaves your own alone', () => {
		const old = 'The bunny is doing a happy hop for you 🐰';
		const out = migrateSettings({ messages: { running: [], done: [old, 'my own message'] } });
		expect(out.messages.done).toContain('my own message');
		expect(out.messages.done).not.toContain(old);
		expect(out.messages.done.join(' ')).toContain('{pet}');
	});

	it('converts old log slots', () => {
		const log = [{ id: '1', slot: '08:00' }] as unknown as LogEntry[];
		expect(migrateLog(log)[0].slot).toBe('morning');
	});

	it('keeps reminders that were set up, tidies them, and leaves them unset otherwise', () => {
		expect(migrateSettings({}).reminders).toBeUndefined();
		const kept = migrateSettings({
			reminders: { enabled: true, times: { morning: '07:00', evening: 'bad', daily: '09:30' } }
		} as never).reminders;
		expect(kept).toEqual({
			enabled: true,
			times: { morning: '07:00', evening: '20:00', daily: '09:30' }
		});
	});
});
