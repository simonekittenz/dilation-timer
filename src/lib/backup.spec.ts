import { describe, expect, it } from 'vitest';
import { backupFileName, createBackup, describeBackup, parseBackup } from './backup';
import { defaultSettings } from './defaults';
import type { LogEntry } from './types';

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
	id: crypto.randomUUID(),
	date: '2026-10-10',
	slot: 'morning',
	startedAt: 1,
	finishedAt: 2,
	steps: [{ label: 'Dilator 1', plannedMinutes: 5, actualSeconds: 300 }],
	...over
});

describe('backup', () => {
	it('round-trips settings and history exactly', () => {
		const settings = defaultSettings(new Date(2026, 9, 1));
		settings.dilators[1].nickname = 'Pip';
		settings.mascot = 'kitty';
		settings.volume = 60;
		const log = [entry(), entry({ skipped: true, steps: [] })];
		const text = JSON.stringify(createBackup(settings, log, new Date('2026-10-17T10:00:00Z')));
		const parsed = parseBackup(text);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.settings).toEqual(settings);
		expect(parsed.log).toEqual(log);
		expect(parsed.exportedAt).toBe('2026-10-17T10:00:00.000Z');
	});

	it('never includes a session that is running right now', () => {
		const b = createBackup(defaultSettings(), []);
		expect('active' in b).toBe(false);
	});

	it('refuses things that are not backups, without throwing', () => {
		for (const bad of ['', 'not json', '[]', 'null', '{}', '{"app":"something-else"}', '123']) {
			const r = parseBackup(bad);
			expect(r.ok).toBe(false);
		}
	});

	it('refuses a backup from a newer version', () => {
		const text = JSON.stringify({ ...createBackup(defaultSettings(), []), version: 99 });
		const r = parseBackup(text);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/newer version/);
	});

	it('refuses damaged history or a missing/invalid Day 1', () => {
		const good = createBackup(defaultSettings(), [entry()]);
		expect(parseBackup(JSON.stringify({ ...good, log: [{ nope: 1 }] })).ok).toBe(false);
		expect(parseBackup(JSON.stringify({ ...good, log: 'x' })).ok).toBe(false);
		expect(parseBackup(JSON.stringify({ ...good, settings: null })).ok).toBe(false);
		const badDate = { ...good, settings: { ...good.settings, startDate: 'tomorrow' } };
		expect(parseBackup(JSON.stringify(badDate)).ok).toBe(false);
	});

	it('upgrades a backup made by an older build the same way a normal load does', () => {
		const old = {
			app: 'dilation-timer',
			version: 1,
			exportedAt: '2026-10-01T00:00:00Z',
			settings: {
				startDate: '2026-10-01',
				leewayMinutes: 4,
				phases: [
					{ id: 'p', label: 'P', fromDay: 1, toDay: null, times: ['08:00', '20:00'], steps: [] }
				]
			},
			log: [{ id: 'a', date: '2026-10-02', slot: '08:00', startedAt: 1, finishedAt: 2, steps: [] }]
		};
		const r = parseBackup(JSON.stringify(old));
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.settings.switchWindowMinutes).toBe(4);
		expect(r.settings.phases[0].slots).toEqual(['morning', 'evening']);
		expect(r.settings.mascot).toBe('bunny');
		expect(r.log[0].slot).toBe('morning');
	});

	it('names the file by date and describes it for the confirm prompt', () => {
		expect(backupFileName(new Date(2026, 9, 7))).toBe('dilation-timer-backup-2026-10-07.json');
		const r = parseBackup(
			JSON.stringify(
				createBackup(defaultSettings(new Date(2026, 9, 1)), [entry(), entry({ skipped: true })])
			)
		);
		expect(r.ok && describeBackup(r)).toMatch(/^1 logged session, Day 1 on 2026-10-01/);
	});
});
