import type { APIRoute } from 'astro';
import { jsonResponse } from '../lib/markdown';
import { loadPage } from '../lib/page';
import { extractPressKit } from '../lib/press-kit';

export const GET: APIRoute = async () => {
  const page = await loadPage('press-kit');
  return jsonResponse(extractPressKit(page.data), true);
};
