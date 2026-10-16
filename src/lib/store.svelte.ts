import { chime, keepAwake, startAlarm, stopAlarm, unlock } from './alarm';
import { toDateString } from './dates';
import { defaultSettings } from './defaults';
import { confirmSwitch, finish, isEscalated, leewayLeftMs, startSession, tick } from './session';
import { phaseForDate } from './schedule';
import type { ActiveSession, LogEntry, Settings } from './types';

const KEY = 'dilation-timer:v1';

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
	private timer: ReturnType<typeof setInterval> | null = null;

	get today() {
		return toDateString(new Date(this.now));
	}

	get leewayMs() {
		return Math.max(0, this.settings.leewayMinutes) * 60_000;
	}

	/** True once the calm window after a finished timer has run out. */
	get escalated() {
		return !!this.active && isEscalated(this.active, this.now, this.leewayMs);
	}

	get leewayLeft() {
		return this.active ? leewayLeftMs(this.active, this.now, this.leewayMs) : 0;
	}

	get todayPhase() {
		return phaseForDate(this.settings, this.today);
	}

	boot() {
		if (this.timer) return;
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) {
				const saved: Persisted = JSON.parse(raw);
				this.settings = { ...defaultSettings(), ...saved.settings };
				this.log = saved.log;
				this.active = saved.active;
			}
		} catch {
			// corrupt storage: fall back to defaults
		}
		this.timer = setInterval(() => this.step(), 250);
		this.step();
		addEventListener('pointerdown', unlock);
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
	}

	private step() {
		this.now = Date.now();
		const s = this.active;
		if (!s) {
			stopAlarm();
			return;
		}
		const next = tick(s, this.now);
		if (next !== s) {
			if ((next.warned && !s.warned) || next.phase !== s.phase) chime();
			this.active = next;
			this.save();
		}
		const cur = this.active!;
		if (cur.phase === 'running' || !this.escalated) stopAlarm();
		else
			startAlarm(
				cur.phase === 'finished'
					? 'Session done — press the button'
					: `Switch to ${cur.steps[cur.stepIndex + 1].label}`
			);
	}

	start(slot: string | null) {
		const phase = this.todayPhase;
		if (this.active || !phase || phase.steps.length === 0) return;
		unlock();
		this.active = startSession(phase.steps, slot, this.today, Date.now());
		void keepAwake(true);
		this.save();
	}

	confirm() {
		if (!this.active) return;
		unlock();
		const now = Date.now();
		if (this.active.phase === 'switch') {
			this.active = confirmSwitch(this.active, now);
		} else if (this.active.phase === 'finished') {
			this.log = [finish(this.active, now), ...this.log];
			this.active = null;
			void keepAwake(false);
		}
		this.save();
		this.step();
	}

	cancel() {
		this.active = null;
		void keepAwake(false);
		this.save();
		this.step();
	}

	updateSettings(settings: Settings) {
		this.settings = settings;
		this.save();
	}

	removeLog(id: string) {
		this.log = this.log.filter((e) => e.id !== id);
		this.save();
	}
}

export const store = new Store();
