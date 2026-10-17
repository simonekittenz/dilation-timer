import { migrateLog, migrateSettings } from './migrate';
import type { LogEntry, Settings } from './types';

export const BACKUP_APP = 'dilation-timer';
export const BACKUP_VERSION = 1;

export interface Backup {
	app: typeof BACKUP_APP;
	version: number;
	exportedAt: string;
	settings: Settings;
	log: LogEntry[];
}

export type ParsedBackup =
	| { ok: true; settings: Settings; log: LogEntry[]; exportedAt: string }
	| { ok: false; error: string };

/** Everything worth keeping. A session that is running right now is deliberately left out. */
export function createBackup(settings: Settings, log: LogEntry[], now = new Date()): Backup {
	return {
		app: BACKUP_APP,
		version: BACKUP_VERSION,
		exportedAt: now.toISOString(),
		settings,
		log
	};
}

export function backupFileName(now = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	return `dilation-timer-backup-${stamp}.json`;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Reads a backup file's text. Nothing is applied here: this only says whether the file is
 * safe to restore, so a wrong or damaged file can never overwrite real data.
 */
export function parseBackup(text: string): ParsedBackup {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { ok: false, error: "That file isn't a backup (it couldn't be read)." };
	}
	if (!isRecord(data) || data.app !== BACKUP_APP) {
		return { ok: false, error: "That file isn't a Dilation timer backup." };
	}
	if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
		return { ok: false, error: 'That backup is from a newer version. Update the app first.' };
	}
	if (!isRecord(data.settings) || !Array.isArray(data.log)) {
		return { ok: false, error: 'That backup is missing its settings or history.' };
	}
	const brokenEntry = data.log.some(
		(e) =>
			!isRecord(e) ||
			typeof e.id !== 'string' ||
			typeof e.date !== 'string' ||
			!Array.isArray(e.steps)
	);
	if (brokenEntry) {
		return { ok: false, error: 'Some history entries in that backup are damaged.' };
	}
	const settings = migrateSettings(data.settings as Partial<Settings>);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(settings.startDate)) {
		return { ok: false, error: 'That backup has no valid Day 1 date.' };
	}
	return {
		ok: true,
		settings,
		log: migrateLog(data.log as LogEntry[]),
		exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : ''
	};
}

/** A one-line description for the "are you sure?" prompt. */
export function describeBackup(b: Extract<ParsedBackup, { ok: true }>): string {
	const done = b.log.filter((e) => !e.skipped).length;
	const when = b.exportedAt ? new Date(b.exportedAt).toLocaleDateString() : 'an unknown date';
	return `${done} logged session${done === 1 ? '' : 's'}, Day 1 on ${b.settings.startDate}, saved ${when}`;
}
