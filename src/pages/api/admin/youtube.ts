import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../lib/admin/auth';
import { json } from './entries/_shared';

export const prerender = false;

const ID = /^[A-Za-z0-9_-]{11}$/;

/** Pull the 11-character video id out of any common YouTube URL shape (or a bare id). */
export function youTubeIdFrom(input: string): string | null {
  const value = input.trim();
  if (ID.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0] ?? '';
      return ID.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && ID.test(v)) return v;
      const m = /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/.exec(url.pathname);
      return m?.[1] ?? null;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

/**
 * Look up a YouTube video's title for the "New video" form (public oEmbed, no key).
 * GET ?url=<youtube url or id>  →  { videoId, title, image }
 */
export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) return json({ error: 'Unauthorized' }, 401);
  const raw = new URL(request.url).searchParams.get('url') ?? '';
  const videoId = youTubeIdFrom(raw);
  if (!videoId) return json({ error: 'Not a YouTube video URL' }, 400);

  const image = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return json({ ok: true, videoId, image, title: null, warning: `YouTube lookup failed (${res.status})` });
    const data = (await res.json()) as { title?: string };
    return json({ ok: true, videoId, image, title: data.title ?? null });
  } catch {
    return json({ ok: true, videoId, image, title: null, warning: 'YouTube lookup timed out' });
  }
};
