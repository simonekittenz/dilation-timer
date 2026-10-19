import { describe, expect, it } from 'vitest';
import { decideVersionCode } from '../../scripts/version.mjs';

describe('which version npm run apk builds', () => {
	it('raises the version once the current one has been published', () => {
		expect(decideVersionCode({ current: 2, published: 2 }).code).toBe(3);
	});

	it('reuses a version that has not been published yet, however many builds it takes', () => {
		expect(decideVersionCode({ current: 3, published: 2 }).code).toBe(3);
		expect(decideVersionCode({ current: 5, published: 2 }).code).toBe(5);
	});

	it('--keep never changes it and --bump always raises it', () => {
		expect(decideVersionCode({ current: 3, published: 3, keep: true }).code).toBe(3);
		expect(decideVersionCode({ current: 3, published: 2, bump: true }).code).toBe(4);
	});

	it('raises it to be safe when what is published cannot be found out', () => {
		const r = decideVersionCode({ current: 3, published: null });
		expect(r.code).toBe(4);
		expect(r.why).toMatch(/safe/);
	});

	it('says why', () => {
		expect(decideVersionCode({ current: 3, published: 2 }).why).toMatch(/isn't published yet/);
		expect(decideVersionCode({ current: 2, published: 2 }).why).toMatch(/already published/);
	});
});
