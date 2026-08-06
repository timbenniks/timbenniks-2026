import { defineMiddleware } from 'astro:middleware';
import { isAdminAuthed } from './lib/admin/auth';
import { adminRequestContext } from './lib/admin/request-context';

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
  return adminRequestContext.run({ adminPreview }, () => next());
});
