import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import { signUploadParams } from '../../../../lib/admin/cloudinary-mutate';
import { getCloudinarySearchScope } from '../../../../lib/admin/cloudinary-scope';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: {
    folder?: string;
    title?: string;
    description?: string;
    tags?: string[];
  } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = signUploadParams({
    folder: typeof body.folder === 'string' ? body.folder : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scope = getCloudinarySearchScope();
  return new Response(
    JSON.stringify({
      ...result,
      folders: scope.folders,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
