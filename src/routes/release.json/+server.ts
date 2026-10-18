import { json } from '@sveltejs/kit';
import release from '$lib/appRelease.json';
import type { RequestHandler } from './$types';

// What the Android app asks to find out whether a newer version exists. Published with the site.
export const prerender = true;

export const GET: RequestHandler = () => json(release);
