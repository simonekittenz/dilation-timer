/**
 * Where a − or + press goes. With a step of 1 it is just one up or down; with a bigger step the value
 * lands on the grid, so 7 goes to 10 (up) or 5 (down) when the step is 5.
 */
export function nextStep(value: number, direction: 1 | -1, step: number): number {
	if (step <= 1) return value + direction;
	return direction > 0
		? (Math.floor(value / step) + 1) * step
		: (Math.ceil(value / step) - 1) * step;
}
