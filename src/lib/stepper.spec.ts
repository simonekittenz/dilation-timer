import { describe, expect, it } from 'vitest';
import { nextStep } from './stepper';

describe('nextStep', () => {
	it('moves by one when the step is one', () => {
		expect(nextStep(10, 1, 1)).toBe(11);
		expect(nextStep(10, -1, 1)).toBe(9);
	});

	it('moves along the grid when the step is bigger', () => {
		expect(nextStep(10, 1, 5)).toBe(15);
		expect(nextStep(10, -1, 5)).toBe(5);
		expect(nextStep(7, 1, 5)).toBe(10);
		expect(nextStep(7, -1, 5)).toBe(5);
		expect(nextStep(12.5, 1, 5)).toBe(15);
	});
});
