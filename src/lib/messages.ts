import type { Messages } from './types';

export const DEFAULT_MESSAGES: Messages = {
	running: [
		"You're doing so well ♡",
		'As the nurses say ""',
		'Every session is a little act of self-care.',
		'Look at you, showing up for yourself!',
		'Take it slow. There is no rush.',
		'Future you says thank you ✿',
		'You and {name} make a great team.',
		'Deep breath in… and out… 🫧'
	],
	done: [
		'You did it! So proud of you 🎀',
		'Another one done. Consistency is magic ✨',
		'Go have some water and a snack, you earned it 🍓',
		'Be gentle with yourself today ♡',
		'The bunny is doing a happy hop for you 🐰'
	]
};

export function defaultMessages(): Messages {
	return structuredClone(DEFAULT_MESSAGES);
}

function hash(seed: string): number {
	let h = 5381;
	for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
	return Math.abs(h);
}

/** Stable pick: the same seed always gives the same message, so it doesn't flicker on every tick. */
export function pickMessage(list: string[], seed: string, name: string): string | null {
	const options = list.map((m) => m.trim()).filter(Boolean);
	if (options.length === 0) return null;
	return options[hash(seed) % options.length].replaceAll('{name}', name);
}

/** One message per line; blank lines are dropped. */
export function parseMessages(text: string): string[] {
	return text
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);
}
