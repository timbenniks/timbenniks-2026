import { inferredMarkdownHref, markdownResponse } from './markdown';
import { NEGOTIATION_VARY, notFoundMarkdownBody } from './not-found-markdown';
import { resolveMarkdown } from './public-tool-handlers';

export function wantsMarkdownAccept(acceptHeader: string | null): boolean {
  return (acceptHeader ?? '').includes('text/markdown');
}

export function isNegotiablePath(pathname: string): boolean {
  if (pathname.endsWith('.md')) return true;
  return inferredMarkdownHref(pathname) !== undefined;
}

function notFoundMarkdownResponse(pathname: string): Response {
  return new Response(notFoundMarkdownBody(pathname), {
    status: 404,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      Vary: NEGOTIATION_VARY,
    },
  });
}

/** Resolve Accept: text/markdown for a pathname. Used by middleware and tests. */
export async function negotiateMarkdownResponse(
  pathname: string,
  acceptHeader: string | null,
): Promise<Response | null> {
  if (!wantsMarkdownAccept(acceptHeader)) return null;
  if (!isNegotiablePath(pathname)) return notFoundMarkdownResponse(pathname);

  try {
    const { markdown } = await resolveMarkdown(pathname);
    const response = markdownResponse(markdown);
    response.headers.set('Vary', NEGOTIATION_VARY);
    return response;
  } catch {
    return notFoundMarkdownResponse(pathname);
  }
}
