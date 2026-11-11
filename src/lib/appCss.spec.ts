import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');

describe('app.css', () => {
	it('turns off double-tap zoom on everything, so a missed tap on a phone does not zoom the page', () => {
		const rule = css.match(/^\*\s*\{[^}]*\}/m)?.[0] ?? '';
		expect(rule).toContain('touch-action: manipulation');
	});
});
