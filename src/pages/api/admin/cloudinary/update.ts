import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import { updateAssetMeta } from '../../../../lib/admin/cloudinary-mutate';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: {
    publicId?: string;
    tags?: string[];
    title?: string | null;
    description?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const publicId = typeof body.publicId === 'string' ? body.publicId.trim() : '';
  if (!publicId) {
    return new Response(JSON.stringify({ error: 'publicId is required' }), { status: 400 });
  }

  const result = await updateAssetMeta({
    publicId,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    title: body.title === undefined ? undefined : body.title,
    description: body.description === undefined ? undefined : body.description,
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, asset: result }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
