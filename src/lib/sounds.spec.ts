import { describe, expect, it } from 'vitest';
import { CELEBRATE_MS } from './alarm';
import {
	ALARM_INTERVAL_MS,
	NOTES,
	PING_GAP,
	SOUND_NAMES,
	fanfareScore,
	nudgeScore,
	pingScore,
	scoreFor,
	scoreLength
} from './sounds';

describe('sound definitions', () => {
	it('every named sound has notes', () => {
		for (const name of SOUND_NAMES) expect(scoreFor(name).length).toBeGreaterThan(0);
	});

	it('the switch ping is a two-note ping, three times, evenly spaced', () => {
		const notes = pingScore();
		expect(notes).toHaveLength(6);
		const firsts = notes.filter((n) => n.freq === NOTES.G5).map((n) => n.at);
		expect(firsts).toEqual([0, PING_GAP, 2 * PING_GAP].map((t) => expect.closeTo(t)));
		expect(scoreFor('ping-single')).toHaveLength(2);
	});

	it('the fanfare is seven notes, three times', () => {
		expect(fanfareScore()).toHaveLength(21);
		expect(fanfareScore(1)).toHaveLength(7);
	});

	it('stays out of the shrill range', () => {
		for (const name of SOUND_NAMES) {
			expect(Math.max(...scoreFor(name).map((n) => n.freq))).toBeLessThanOrEqual(NOTES.C6);
		}
	});

	it('the "all done" screen outlasts the whole fanfare', () => {
		expect(CELEBRATE_MS / 1000).toBeGreaterThan(scoreLength(fanfareScore()) + 0.5);
	});

	it('names are safe for the native plugins, which only accept lowercase letters, digits, dashes', () => {
		for (const name of SOUND_NAMES) expect(name).toMatch(/^[a-z0-9-]+$/);
	});
});

describe('the gentle "have you switched yet?" nudge', () => {
	const nudge = nudgeScore();

	it('is two soft falling notes that fade away, not the old four-note tune', () => {
		expect(nudge.map((n) => n.freq)).toEqual([NOTES.E5, NOTES.C5]);
		expect(nudge.every((n) => n.decay)).toBe(true);
		expect(nudge.every((n) => n.wave === 'triangle')).toBe(true);
	});

	it("stays low: nothing above E5, well under the old tune's high C", () => {
		expect(Math.max(...nudge.map((n) => n.freq))).toBeLessThanOrEqual(NOTES.E5);
		expect(NOTES.E5).toBeLessThan(NOTES.C6);
	});

	it('is quieter than the other alerts', () => {
		expect(Math.max(...nudge.map((n) => n.gain))).toBeLessThan(0.9);
	});

	it('leaves a long quiet between repeats (at least 5 seconds of silence)', () => {
		const silence = ALARM_INTERVAL_MS / 1000 - scoreLength(nudge);
		expect(silence).toBeGreaterThanOrEqual(5);
	});
});
