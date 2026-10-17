import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOUND_NAMES, scoreFor, scoreLength } from './sounds';

const read = (name: string) =>
	readFileSync(new URL(`../../static/sounds/${name}.wav`, import.meta.url));

describe('bundled alarm sound files (npm run sounds:render)', () => {
	for (const name of SOUND_NAMES) {
		it(`${name}.wav is a valid mono 16-bit WAV that matches its notes`, () => {
			const file = read(name);
			expect(file.toString('ascii', 0, 4)).toBe('RIFF');
			expect(file.toString('ascii', 8, 12)).toBe('WAVE');
			expect(file.readUInt16LE(20)).toBe(1); // PCM
			expect(file.readUInt16LE(22)).toBe(1); // mono
			const rate = file.readUInt32LE(24);
			expect(rate).toBe(22050);
			expect(file.readUInt16LE(34)).toBe(16);
			expect(file.toString('ascii', 36, 40)).toBe('data');
			const bytes = file.readUInt32LE(40);
			expect(file.length).toBe(44 + bytes);

			// as long as the notes plus the short tail, so it can't be stale or cut short
			const seconds = bytes / 2 / rate;
			expect(seconds).toBeGreaterThan(scoreLength(scoreFor(name)));
			expect(seconds).toBeLessThan(scoreLength(scoreFor(name)) + 0.5);

			// audible, and not clipping
			let peak = 0;
			let sum = 0;
			const samples = bytes / 2;
			for (let i = 0; i < samples; i++) {
				const v = file.readInt16LE(44 + i * 2) / 32768;
				peak = Math.max(peak, Math.abs(v));
				sum += v * v;
			}
			expect(Math.sqrt(sum / samples)).toBeGreaterThan(0.05);
			expect(peak).toBeLessThan(0.999);
		});
	}
});
