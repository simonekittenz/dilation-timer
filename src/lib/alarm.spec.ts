import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const starts: { freq: number; t: number }[] = [];
const gains: { gain: { value: number } }[] = [];

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
		const node = { gain: { ...param, value: 1 }, connect: (n: unknown) => n };
		gains.push(node);
		return node;
	}
	createBiquadFilter() {
		return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: (n: unknown) => n };
	}
	createDynamicsCompressor() {
		const p = () => ({ value: 0 });
		return {
			threshold: p(),
			knee: p(),
			ratio: p(),
			attack: p(),
			release: p(),
			connect: (n: unknown) => n
		};
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
		gains.length = 0;
		vi.resetModules();
		vi.stubGlobal('window', {});
		vi.stubGlobal('AudioContext', FakeAudioContext);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('plays the two-note ping three times, evenly spaced', async () => {
		const { unlock, ping, PING_GAP, NOTES } = await import('./alarm');
		unlock();
		ping();
		const lows = starts.filter((s) => s.freq === NOTES.G5).map((s) => s.t);
		const highs = starts.filter((s) => s.freq === NOTES.C6).map((s) => s.t);
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
		gains.length = 0;
		vi.resetModules();
		vi.stubGlobal('window', {});
		vi.stubGlobal('AudioContext', FakeAudioContext);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('plays the fanfare three times, evenly spaced', async () => {
		const { unlock, celebrate, FANFARE_GAP, NOTES } = await import('./alarm');
		unlock();
		celebrate();
		const firstNote = starts.filter((s) => s.freq === NOTES.C5).map((s) => s.t);
		expect(firstNote).toHaveLength(3);
		expect(firstNote[1] - firstNote[0]).toBeCloseTo(FANFARE_GAP);
		expect(firstNote[2] - firstNote[1]).toBeCloseTo(FANFARE_GAP);
		expect(starts).toHaveLength(3 * 7); // 7 notes per fanfare
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

describe('volume', () => {
	beforeEach(() => {
		starts.length = 0;
		gains.length = 0;
		vi.resetModules();
		vi.stubGlobal('window', {});
		vi.stubGlobal('AudioContext', FakeAudioContext);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('scales everything through one master volume, kept between 0 and 1', async () => {
		const { unlock, setVolume } = await import('./alarm');
		unlock();
		const master = gains[0]; // the first gain node is the master volume
		expect(master.gain.value).toBe(1);
		setVolume(0.4);
		expect(master.gain.value).toBeCloseTo(0.4);
		setVolume(5);
		expect(master.gain.value).toBe(1);
		setVolume(-1);
		expect(master.gain.value).toBe(0);
	});

	it('remembers a volume chosen before the first tap unlocked sound', async () => {
		const { unlock, setVolume } = await import('./alarm');
		setVolume(0.5);
		unlock();
		expect(gains[0].gain.value).toBe(0.5);
	});

	it('stays out of the shrill range', async () => {
		const { NOTES, unlock, celebrate, ping } = await import('./alarm');
		unlock();
		celebrate();
		ping();
		expect(Math.max(...starts.map((s) => s.freq))).toBeLessThanOrEqual(NOTES.C6);
	});
});
