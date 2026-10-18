import {
	CELEBRATE_MS,
	celebrate,
	chime,
	keepAwake,
	ping,
	setVolume,
	soundReady,
	startAlarm,
	stopAlarm,
	unlock
} from './alarm';
import { toDateString, toTimeString } from './dates';
import { FALLBACK_COLOR, resolveSteps } from './dilators';
import { defaultSettings } from './defaults';
import { migrateLog, migrateSettings, normalizeSlot } from './migrate';
import {
	ADJUST_MS,
	adjust,
	alertStart,
	confirmSwitch,
	finish,
	isEscalated,
	overtimeMs,
	pause,
	resume,
	skipStep,
	startSession,
	switchWindowLeftMs,
	tick
} from './session';
import { nextOpenSlot, phaseForDate, slotsForDate } from './schedule';
import type { ActiveSession, LogEntry, Settings, SlotId } from './types';

const KEY = 'dilation-timer:v1';
/** How long the "time to switch" ears cue stays up. */
const CUE_MS = 3500;

interface Persisted {
	settings: Settings;
	log: LogEntry[];
	active: ActiveSession | null;
}

class Store {
	settings = $state<Settings>(defaultSettings());
	log = $state<LogEntry[]>([]);
	active = $state<ActiveSession | null>(null);
	now = $state(Date.now());
	cueUntil = $state(0);
	/** True once anything has been saved on this device (the start page is for brand-new visitors). */
	hasSavedData = $state(false);
	soundReady = $state(false);
	private timer: ReturnType<typeof setInterval> | null = null;

	get today() {
		return toDateString(new Date(this.now));
	}

	get switchWindowMs() {
		return Math.max(0, this.settings.switchWindowMinutes) * 60_000;
	}

	/** True once the switch window after a finished timer has run out. */
	get escalated() {
		return !!this.active && isEscalated(this.active, this.now, this.switchWindowMs);
	}

	get switchWindowLeft() {
		return this.active ? switchWindowLeftMs(this.active, this.now, this.switchWindowMs) : 0;
	}

	/** True for a few seconds after a timer ends: ping + mascot ears, no tapping needed. */
	get cueActive() {
		return this.now < this.cueUntil;
	}

	get todaySlots() {
		return slotsForDate(this.settings, this.today, toTimeString(new Date(this.now)), this.log);
	}

	get nextSlot() {
		return nextOpenSlot(this.todaySlots);
	}

	get todayPhase() {
		return phaseForDate(this.settings, this.today);
	}

	boot() {
		if (this.timer) return;
		try {
			const raw = localStorage.getItem(KEY);
			this.hasSavedData = raw !== null;
			if (raw) {
				const saved: Persisted = JSON.parse(raw);
				this.settings = migrateSettings(saved.settings);
				setVolume(this.settings.volume / 100);
				this.log = migrateLog(saved.log ?? []);
				this.active = saved.active
					? {
							...saved.active,
							slot: normalizeSlot(saved.active.slot),
							steps: saved.active.steps.map((st) => ({ ...st, color: st.color ?? FALLBACK_COLOR }))
						}
					: null;
			}
		} catch {
			// corrupt storage: fall back to defaults
		}
		this.timer = setInterval(() => this.step(), 250);
		this.step();
		// iOS only counts real taps (not pointerdown) as permission to play sound.
		for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
			addEventListener(type, unlock, { passive: true });
		}
		if (this.active) void keepAwake(true);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') this.step();
			if (this.active && document.visibilityState === 'visible') void keepAwake(true);
		});
	}

	private save() {
		const data: Persisted = {
			settings: $state.snapshot(this.settings),
			log: $state.snapshot(this.log),
			active: $state.snapshot(this.active)
		};
		localStorage.setItem(KEY, JSON.stringify(data));
		this.hasSavedData = true;
	}

	private step() {
		this.now = Date.now();
		this.soundReady = soundReady();
		const s = this.active;
		if (!s) {
			stopAlarm();
			return;
		}
		const next = tick(s, this.now);
		if (next !== s) {
			if (next.phase !== s.phase) {
				// Only cue if it just happened, not when catching up after the app was asleep.
				if (overtimeMs(next, this.now) < 10_000) {
					if (next.phase === 'finished') {
						celebrate();
					} else {
						this.cueUntil = this.now + CUE_MS;
						ping();
					}
				}
			} else if (next.warned && !s.warned) {
				chime();
			}
			this.active = next;
			this.save();
		}
		const cur = this.active!;
		if (cur.phase === 'finished' && this.now - alertStart(cur) >= CELEBRATE_MS) {
			this.complete();
			return;
		}
		if (cur.phase !== 'switch' || !this.escalated) stopAlarm();
		else startAlarm(`Switch to ${cur.steps[cur.stepIndex + 1].label}`);
	}

	/** The last dilator is done: log the session (ending when the timer ended) and clear it. */
	private complete() {
		const s = this.active;
		if (!s) return;
		this.log = [finish(s, alertStart(s)), ...this.log];
		this.active = null;
		stopAlarm();
		void keepAwake(false);
		this.save();
	}

	start(slot: SlotId | null) {
		const phase = this.todayPhase;
		if (this.active || !phase || phase.steps.length === 0) return;
		unlock();
		this.active = startSession(
			resolveSteps(this.settings.dilators, phase.steps),
			slot,
			this.today,
			Date.now()
		);
		void keepAwake(true);
		this.save();
	}

	confirm() {
		if (!this.active) return;
		unlock();
		const now = Date.now();
		if (this.active.phase === 'switch') {
			this.active = confirmSwitch(this.active, now);
		}
		this.save();
		this.step();
	}

	private change(fn: (s: ActiveSession, now: number) => ActiveSession) {
		if (!this.active) return;
		unlock();
		this.active = fn(this.active, Date.now());
		this.save();
		this.step();
	}

	pause() {
		this.change(pause);
	}

	resume() {
		this.change(resume);
	}

	/** Add (or, with a negative number, remove) minutes on the current dilator. */
	addMinutes(minutes: number) {
		this.change((s, now) => adjust(s, minutes * ADJUST_MS, now));
	}

	/** End this dilator's timer now and move on to the switch prompt. */
	skipStep() {
		this.change(skipStep);
		if (this.active?.phase === 'finished') celebrate();
	}

	cancel() {
		this.active = null;
		void keepAwake(false);
		this.save();
		this.step();
	}

	updateSettings(settings: Settings) {
		this.settings = settings;
		setVolume(settings.volume / 100);
		this.save();
	}

	skip(slot: SlotId) {
		const now = Date.now();
		this.log = [
			{
				id: crypto.randomUUID(),
				date: this.today,
				slot,
				startedAt: now,
				finishedAt: now,
				skipped: true,
				steps: []
			},
			...this.log
		];
		this.save();
	}

	/** Replaces everything on this device with a (already validated) backup. */
	restoreBackup(backup: {
		settings: Settings;
		log: LogEntry[];
	}): { ok: true } | { ok: false; error: string } {
		if (this.active) {
			return { ok: false, error: 'Finish or cancel the session that is running first.' };
		}
		this.settings = backup.settings;
		this.log = backup.log;
		setVolume(backup.settings.volume / 100);
		this.save();
		return { ok: true };
	}

	removeLog(id: string) {
		this.log = this.log.filter((e) => e.id !== id);
		this.save();
	}
}

export const store = new Store();
