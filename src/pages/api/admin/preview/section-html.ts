import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import {
  formatZodError,
  isAdminPageId,
  savePageDraft,
  validatePageData,
} from '../../../../lib/admin/pages-store';
import { isPageIdFormat, type PageId } from '../../../../lib/page-schema';

export const prerender = false;

/**
 * Stage draft + return URL for the section fragment.
 * Prefer calling `/admin/preview/:id/section/:index` directly from the client;
 * this endpoint remains for agents/tools that want JSON.
 */
export const POST: APIRoute = async ({ request, url }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const pageId = String(body.pageId ?? '');
  const sectionIndex = Number(body.sectionIndex);
  if (!isPageIdFormat(pageId) || !Number.isFinite(sectionIndex) || sectionIndex < 0) {
    return new Response(JSON.stringify({ error: 'pageId and sectionIndex required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    if (body.page) {
      const page = validatePageData(body.page);
      if (sectionIndex >= (page.sections?.length ?? 0)) {
        return new Response(JSON.stringify({ error: 'sectionIndex out of range' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      await savePageDraft(pageId as PageId, page);
    } else if (!(await isAdminPageId(pageId))) {
      return new Response(JSON.stringify({ error: 'Unknown page' }), { status: 404 });
    }

    const fragmentPath = `/admin/preview/${encodeURIComponent(pageId)}/section/${sectionIndex}`;
    const cookie = request.headers.get('cookie') || '';
    const res = await fetch(new URL(fragmentPath, url.origin), {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        accept: 'text/html',
      },
      body: JSON.stringify(body.page ? { page: body.page } : {}),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Section render failed (${res.status}): ${text.slice(0, 200)}`);
    }
    let html = await res.text();
    html = extractSectionHtml(html);
    html = remapSectionIndex(html, 0, sectionIndex);

    return new Response(JSON.stringify({ ok: true, html, sectionIndex }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: formatZodError(err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function extractSectionHtml(doc: string): string {
  const match = doc.match(/<div[^>]*data-section="[^"]*"[^>]*>[\s\S]*<\/div>\s*<\/body>/i);
  if (match) {
    return match[0].replace(/\s*<\/body>\s*$/i, '').trim();
  }
  const body = doc.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return (body?.[1] || doc).trim();
}

function remapSectionIndex(html: string, from: number, to: number): string {
  if (from === to) return html;
  const fromStr = String(from);
  const toStr = String(to);
  return html
    .replaceAll(`data-section="${fromStr}"`, `data-section="${toStr}"`)
    .replaceAll(`sections.${fromStr}.`, `sections.${toStr}.`)
    .replaceAll(`sections.${fromStr}"`, `sections.${toStr}"`)
    .replaceAll(`sections.${fromStr}'`, `sections.${toStr}'`);
}
