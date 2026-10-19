/**
 * Which version code `npm run apk` should build.
 *
 * The version only needs to go up once per release, so a build whose version hasn't been published
 * yet reuses it. A new version is only made when the current one is already out.
 *
 * @param {{ current: number, published: number | null, keep?: boolean, bump?: boolean }} input
 *   `published` is the version code on origin/main, or null when that can't be found out.
 * @returns {{ code: number, why: string }}
 */
export function decideVersionCode({ current, published, keep = false, bump = false }) {
	if (keep) return { code: current, why: 'kept as asked' };
	if (bump) return { code: current + 1, why: 'raised as asked' };
	if (published === null)
		return { code: current + 1, why: "couldn't tell what is published, so raised to be safe" };
	if (current > published)
		return { code: current, why: `version ${current} isn't published yet, so reused` };
	return { code: current + 1, why: `version ${current} is already published, so raised` };
}
