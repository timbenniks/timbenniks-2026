import { defineMiddleware } from 'astro:middleware';
import { isAdminAuthed } from './lib/admin/auth';
import { adminRequestContext } from './lib/admin/request-context';
import { NEGOTIATION_VARY } from './lib/not-found-markdown';
import { isNegotiablePath, negotiateMarkdownResponse } from './lib/content-negotiation';

function isSkippable(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin') ||
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

    if (!isSkippable(pathname) && isNegotiablePath(pathname)) {
      return withVary(response);
    }

    return response;
  });
});
