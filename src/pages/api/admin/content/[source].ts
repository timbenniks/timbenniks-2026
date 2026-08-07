import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import {
  isHubSource,
  listHubContent,
} from '../../../../lib/admin/content-index';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const source = params.source ?? '';
  if (!isHubSource(source)) {
    return new Response(JSON.stringify({ error: 'Unknown content source' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? undefined;
  const playlist = url.searchParams.get('playlist') ?? undefined;
  const limitRaw = url.searchParams.get('limit');
  const offsetRaw = url.searchParams.get('offset');
  const limit = limitRaw != null ? Number(limitRaw) : undefined;
  const offset = offsetRaw != null ? Number(offsetRaw) : undefined;

  const result = await listHubContent(source, { q, limit, offset, playlist });

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
};
