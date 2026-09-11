import { defineMiddleware } from 'astro:middleware';
import { isAdminAuthed } from './lib/admin/auth';
import { adminRequestContext } from './lib/admin/request-context';
import { NEGOTIATION_VARY } from './lib/not-found-markdown';
import {
  isNegotiablePath,
  negotiateMarkdownResponse,
  notFoundMarkdownResponse,
  wantsHtmlAccept,
} from './lib/content-negotiation';

function isSkippable(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    // The public REST API answers in JSON and carries its own RFC 9457 error
    // model; it must never be rewritten into a markdown twin or markdown 404.
    pathname.startsWith('/api/') ||
    // Discovery documents under /.well-known are never markdown twins.
    pathname.startsWith('/.well-known/') ||
    pathname.startsWith('/_astro') ||
    pathname.startsWith('/pagefind') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.xml') ||
    pathname.endsWith('.txt') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.ico')
  );
}

function withVary(response: Response): Response {
  response.headers.set('Vary', NEGOTIATION_VARY);
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi =
    pathname.startsWith('/api/admin/') &&
    pathname !== '/api/admin/login';

  if ((isAdminPage || isAdminApi) && pathname !== '/admin/login') {
    if (!isAdminAuthed(context.request)) {
      if (isAdminApi) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }

  const adminPreview = pathname.startsWith('/admin/preview');

  return adminRequestContext.run({ adminPreview }, async () => {
    const accept = context.request.headers.get('accept');

    if (!isSkippable(pathname) && !pathname.endsWith('.md')) {
      const negotiated = await negotiateMarkdownResponse(pathname, accept);
      if (negotiated) return negotiated;
    }

    const response = await next();

    // A miss must stay recoverable for a client that cannot read the HTML
    // shell: same 404 status, short markdown body with pointers to llms.txt,
    // the sitemap and the tool catalog. Browsers still get the 404 page, and
    // an endpoint that already answered in its own machine-readable format
    // (the REST API's RFC 9457 problem document) is left alone.
    if (
      response.status === 404 &&
      !wantsHtmlAccept(accept) &&
      response.headers.get('Content-Type')?.includes('text/html')
    ) {
      return notFoundMarkdownResponse(pathname);
    }

    if (!isSkippable(pathname) && isNegotiablePath(pathname)) {
      return withVary(response);
    }

    return response;
  });
});
