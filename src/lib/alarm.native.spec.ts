import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioDuckingPlugin } from './nativeAudio';

const oscillators: number[] = [];
let contexts = 0;

class FakeAudioContext {
	state = 'running';
	currentTime = 10;
	destination = {};
	constructor() {
		contexts++;
	}
	resume() {}
	createGain() {
		const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, value: 1 };
		return { gain: param, connect: (n: unknown) => n };
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
			start(this: { frequency: { value: number } }) {
				oscillators.push(this.frequency.value);
			},
			stop() {}
		};
	}
}

function fakePlugin() {
	return {
		play: vi.fn<AudioDuckingPlugin['play']>(async () => {}),
		loop: vi.fn<AudioDuckingPlugin['loop']>(async () => {}),
		stop: vi.fn<AudioDuckingPlugin['stop']>(async () => {})
	};
}

const settle = () => new Promise((r) => setTimeout(r, 0));

async function load(plugin: ReturnType<typeof fakePlugin> | null) {
	vi.resetModules();
	const native = await import('./nativeAudio');
	native.setNativeAudioForTests(plugin);
	const alarm = await import('./alarm');
	return { alarm, native };
}

describe('alarm inside the iOS/Android app (native plugin)', () => {
	beforeEach(() => {
		oscillators.length = 0;
		contexts = 0;
		vi.stubGlobal('window', {});
		vi.stubGlobal('document', { title: '' });
		vi.stubGlobal('AudioContext', FakeAudioContext);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('plays each sound through the plugin, not Web Audio', async () => {
		const plugin = fakePlugin();
		const { alarm } = await load(plugin);
		alarm.setVolume(0.4);
		alarm.chime();
		alarm.ping();
		alarm.ping(1);
		alarm.celebrate();
		await settle();
		expect(plugin.play.mock.calls.map(([o]) => o.sound)).toEqual([
			'chime',
			'ping',
			'ping-single',
			'fanfare'
		]);
		expect(plugin.play.mock.calls.every(([o]) => o.volume === 0.4)).toBe(true);
		expect(oscillators).toEqual([]);
		expect(contexts).toBe(0);
	});

	it('does not touch Web Audio at all, so the web view cannot grab the audio session', async () => {
		const { alarm } = await load(fakePlugin());
		alarm.unlock();
		expect(contexts).toBe(0);
		expect(alarm.soundReady()).toBe(true); // no "tap to turn sound on" banner in the app
	});

	it('loops the alarm natively once, and stops it', async () => {
		const plugin = fakePlugin();
		const { alarm } = await load(plugin);
		alarm.startAlarm('Switch to Dilator 2');
		alarm.startAlarm('Switch to Dilator 2');
		await settle();
		expect(plugin.loop).toHaveBeenCalledTimes(1);
		expect(plugin.loop.mock.calls[0][0]).toMatchObject({ sound: 'arpeggio', intervalMs: 2500 });
		alarm.stopAlarm();
		await settle();
		expect(plugin.stop).toHaveBeenCalledTimes(1);
		alarm.stopAlarm();
		await settle();
		expect(plugin.stop).toHaveBeenCalledTimes(1); // nothing was looping, nothing to stop
	});

	it('falls back to Web Audio if the plugin was never installed', async () => {
		const plugin = fakePlugin();
		plugin.play.mockRejectedValue(
			Object.assign(new Error('not implemented'), { code: 'UNIMPLEMENTED' })
		);
		const { alarm, native } = await load(plugin);
		alarm.ping();
		await settle();
		expect(native.nativeAudioAvailable()).toBe(false); // a missing plugin stays missing
		// the next tap unlocks Web Audio, and from then on sounds play there
		alarm.unlock();
		expect(contexts).toBe(1);
		alarm.ping();
		await settle();
		expect(oscillators.length).toBe(6);
		expect(plugin.play).toHaveBeenCalledTimes(1);
	});

	it('keeps using the plugin after a one-off failure (e.g. during a phone call)', async () => {
		const plugin = fakePlugin();
		plugin.play.mockRejectedValueOnce(new Error('AVAudioSession is busy'));
		const { alarm, native } = await load(plugin);
		alarm.ping();
		await settle();
		expect(native.nativeAudioAvailable()).toBe(true);
		alarm.ping();
		await settle();
		expect(plugin.play).toHaveBeenCalledTimes(2);
	});

	it('switches the looping alarm to Web Audio if the plugin cannot loop', async () => {
		vi.useFakeTimers();
		try {
			const plugin = fakePlugin();
			plugin.loop.mockRejectedValue(Object.assign(new Error('nope'), { code: 'UNIMPLEMENTED' }));
			const { alarm } = await load(plugin);
			alarm.startAlarm('x');
			await vi.advanceTimersByTimeAsync(0);
			alarm.unlock(); // a later tap unlocks Web Audio
			await vi.advanceTimersByTimeAsync(2600);
			expect(plugin.loop).toHaveBeenCalledTimes(1);
			expect(oscillators.length).toBeGreaterThan(0);
			alarm.stopAlarm();
		} finally {
			vi.useRealTimers();
		}
	});

	it("never treats the plugin like a promise (Capacitor's real plugin objects answer to `then`)", async () => {
		const calls: string[] = [];
		// like Capacitor's plugin proxy: every property is a "native method", including `then`
		const capacitorLike = new Proxy(
			{},
			{
				get(_, name: string) {
					return (options?: unknown) => {
						if (name === 'then') {
							throw new Error(
								'the plugin was used as a promise: Capacitor would say "not implemented"'
							);
						}
						calls.push(`${name}:${JSON.stringify(options)}`);
						return Promise.resolve();
					};
				}
			}
		) as unknown as ReturnType<typeof fakePlugin>;
		const { alarm, native } = await load(capacitorLike);
		alarm.ping();
		alarm.startAlarm('x');
		await settle();
		expect(native.nativeAudioAvailable()).toBe(true);
		expect(calls).toEqual([
			'play:{"sound":"ping","volume":1}',
			'loop:{"sound":"arpeggio","volume":1,"intervalMs":2500}'
		]);
		alarm.stopAlarm();
	});
});
