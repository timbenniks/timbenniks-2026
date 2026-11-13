import type { APIRoute } from 'astro';
import { markdownResponse } from '../lib/markdown';
import { loadProfile } from '../lib/profile';

export const GET: APIRoute = async () => markdownResponse((await loadProfile()).markdown);
