/**
 * The alarm sounds, described once. The web app plays these live with Web Audio, and
 * `npm run sounds:render` turns the very same notes into the WAV files the iOS/Android app plays.
 * This file must stay free of browser-only or app-only imports.
 */

/**
 * Pitches in Hz. They sit in the middle of the range on purpose: a phone speaker still carries
 * the square wave's overtones, so low notes stay audible without being shrill.
 */
export const NOTES = { C5: 523, E5: 659, G5: 784, C6: 1047 };

/** Seconds between repeats of the switch ping; three fit inside the ears cue. */
export const PING_GAP = 1.1;
/** One fanfare is about 2s long; the gap leaves a beat of silence before it repeats. */
export const FANFARE_LENGTH = 2.0;
export const FANFARE_GAP = 2.3;
export const CELEBRATE_TIMES = 3;
/** How often the gentle "have you switched yet?" nudge repeats until you respond. */
export const ALARM_INTERVAL_MS = 8000;

export interface Note {
	freq: number;
	/** Waveform; the default square wave is the old-school one. Triangle is softer. */
	wave?: 'square' | 'triangle';
	/** A ping that fades away, instead of a note that holds its level and then stops. */
	decay?: boolean;
	/** Seconds after the start of the sound. */
	at: number;
	length: number;
	gain: number;
}

export const SOUND_NAMES = ['ping', 'ping-single', 'chime', 'nudge', 'fanfare'] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

/** Single clear note, e.g. "10 seconds left". */
export function chimeScore(): Note[] {
	return [{ freq: NOTES.E5, at: 0, length: 0.4, gain: 0.6 }];
}

/** Short bright two-note ping, repeated: "your timer just ended, time to switch". */
export function pingScore(times = 3): Note[] {
	const notes: Note[] = [];
	for (let i = 0; i < times; i++) {
		const at = i * PING_GAP;
		notes.push({ freq: NOTES.G5, at, length: 0.18, gain: 0.9 });
		notes.push({ freq: NOTES.C6, at: at + 0.16, length: 0.3, gain: 0.9 });
	}
	return notes;
}

/**
 * The gentle "have you switched yet?" nudge: two soft falling notes that fade away like a small
 * bell, then a long quiet. It stays in the lower, friendlier part of the range on purpose.
 */
export function nudgeScore(): Note[] {
	return [
		{ freq: NOTES.E5, at: 0, length: 0.7, gain: 0.8, wave: 'triangle', decay: true },
		{ freq: NOTES.C5, at: 0.3, length: 0.9, gain: 0.8, wave: 'triangle', decay: true }
	];
}

/** Happy fanfare for the end of a session, played three times by default. */
export function fanfareScore(times = CELEBRATE_TIMES): Note[] {
	const notes: Note[] = [];
	for (let i = 0; i < times; i++) {
		const t = i * FANFARE_GAP;
		[NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6].forEach((freq, k) =>
			notes.push({ freq, at: t + k * 0.18, length: k === 3 ? 0.5 : 0.25, gain: 0.9 })
		);
		[NOTES.E5, NOTES.G5, NOTES.C6].forEach((freq, k) =>
			notes.push({ freq, at: t + 1.0 + k * 0.2, length: k === 2 ? 0.7 : 0.3, gain: 0.9 })
		);
	}
	return notes;
}

export function scoreFor(name: SoundName): Note[] {
	switch (name) {
		case 'ping':
			return pingScore();
		case 'ping-single':
			return pingScore(1);
		case 'chime':
			return chimeScore();
		case 'nudge':
			return nudgeScore();
		case 'fanfare':
			return fanfareScore();
	}
}

/** When the last note of a sound has finished, in seconds. */
export function scoreLength(notes: Note[]): number {
	return Math.max(0, ...notes.map((n) => n.at + n.length));
}

export interface Chain {
	/** Connect notes here. */
	bus: AudioNode;
	/** The master volume (0 to 1). */
	master: GainNode;
}

/**
 * lowpass -> limiter -> master volume -> speakers. Notes are sustained square waves for the
 * old-school feel; the lowpass rounds off their sharp top end, and the limiter stops
 * overlapping notes from distorting.
 */
export function buildChain(c: BaseAudioContext, volume: number): Chain {
	const lowpass = c.createBiquadFilter();
	lowpass.type = 'lowpass';
	lowpass.frequency.value = 2200;
	lowpass.Q.value = 0.5;
	const limiter = c.createDynamicsCompressor();
	limiter.threshold.value = -8;
	limiter.knee.value = 0;
	limiter.ratio.value = 20;
	limiter.attack.value = 0.002;
	limiter.release.value = 0.1;
	const master = c.createGain();
	master.gain.value = volume;
	lowpass.connect(limiter);
	limiter.connect(master);
	master.connect(c.destination);
	return { bus: lowpass, master };
}

/** A note that holds its level and then drops away, so it stays loud for its whole length. */
export function playNote(c: BaseAudioContext, bus: AudioNode, note: Note, startAt: number) {
	const start = startAt + note.at;
	const osc = c.createOscillator();
	const amp = c.createGain();
	osc.type = note.wave ?? 'square';
	osc.frequency.value = note.freq;
	if (note.decay) {
		// a ping: a quick start, then a smooth fade
		amp.gain.setValueAtTime(0.0001, start);
		amp.gain.linearRampToValueAtTime(note.gain, start + 0.012);
		amp.gain.exponentialRampToValueAtTime(0.001, start + note.length);
	} else {
		const release = Math.min(0.1, note.length / 2);
		amp.gain.setValueAtTime(0, start);
		amp.gain.linearRampToValueAtTime(note.gain, start + 0.015);
		amp.gain.setValueAtTime(note.gain, start + note.length - release);
		amp.gain.linearRampToValueAtTime(0, start + note.length);
	}
	osc.connect(amp).connect(bus);
	osc.start(start);
	osc.stop(start + note.length + 0.02);
}

export function playScore(c: BaseAudioContext, bus: AudioNode, notes: Note[], startAt: number) {
	for (const note of notes) playNote(c, bus, note, startAt);
}
