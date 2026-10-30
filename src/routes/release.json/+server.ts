import release from '#lib/appRelease.json';
import type { RequestHandler } from './$types';

// Release info published with the site: what apps before 1.9 ask to find out whether a newer version
// exists, and what newer apps fall back to when GitHub can't be asked.
export const prerender = true;

export const GET: RequestHandler = () => Response.json(release);
