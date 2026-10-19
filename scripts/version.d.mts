export function decideVersionCode(input: {
	current: number;
	published: number | null;
	keep?: boolean;
	bump?: boolean;
}): { code: number; why: string };
