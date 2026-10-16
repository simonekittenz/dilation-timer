import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const starts: { freq: number; t: number }[] = [];

class FakeAudioContext {
	state = 'running';
	currentTime = 10;
	destination = {};
	resume() {}
	createGain() {
		const param = {
			setValueAtTime() {},
			linearRampToValueAtTime() {},
			exponentialRampToValueAtTime() {}
		};
		return { gain: param, connect: (n: unknown) => n };
	}
	createOscillator() {
		return {
			type: '',
			frequency: { value: 0 },
			connect: (n: unknown) => n,
			start(this: { frequency: { value: number } }, t: number) {
				starts.push({ freq: this.frequency.value, t });
			},
			stop() {}
		};
	}
}

describe('switch ping', () => {
	beforeEach(() => {
		starts.length = 0;
		vi.resetModules();
		vi.stubGlobal('window', {});
		vi.stubGlobal('AudioContext', FakeAudioContext);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('plays the two-note ping three times, evenly spaced', async () => {
		const { unlock, ping, PING_GAP } = await import('./alarm');
		unlock();
		ping();
		const lows = starts.filter((s) => s.freq === 988).map((s) => s.t);
		const highs = starts.filter((s) => s.freq === 1319).map((s) => s.t);
		expect(lows).toHaveLength(3);
		expect(highs).toHaveLength(3);
		expect(lows[1] - lows[0]).toBeCloseTo(PING_GAP);
		expect(lows[2] - lows[1]).toBeCloseTo(PING_GAP);
		// the whole thing fits inside the 3.5s bunny-ears cue
		expect(highs[2] - lows[0] + 0.3).toBeLessThan(3.5);
	});

	it('can still be played once', async () => {
		const { unlock, ping } = await import('./alarm');
		unlock();
		ping(1);
		expect(starts).toHaveLength(2);
	});
});

describe('finish celebration', () => {
	beforeEach(() => {
		starts.length = 0;
		vi.resetModules();
		vi.stubGlobal('window', {});
		vi.stubGlobal('AudioContext', FakeAudioContext);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('plays the fanfare three times, evenly spaced', async () => {
		const { unlock, celebrate, FANFARE_GAP } = await import('./alarm');
		unlock();
		celebrate();
		const firstNote = starts.filter((s) => s.freq === 523).map((s) => s.t);
		expect(firstNote).toHaveLength(3);
		expect(firstNote[1] - firstNote[0]).toBeCloseTo(FANFARE_GAP);
		expect(firstNote[2] - firstNote[1]).toBeCloseTo(FANFARE_GAP);
		expect(starts.filter((s) => s.freq === 1319)).toHaveLength(3);
	});

	it('keeps the "all done" screen up until the last fanfare has finished', async () => {
		const { unlock, celebrate, CELEBRATE_MS } = await import('./alarm');
		unlock();
		celebrate();
		const lastNoteStart = Math.max(...starts.map((s) => s.t)) - 10; // context time started at 10
		// the final note lasts at most ~0.6s
		expect(CELEBRATE_MS / 1000).toBeGreaterThan(lastNoteStart + 0.6);
	});
});
