import { next, rewrite } from '@vercel/functions';

const STATIC_PAGES = new Set([
  '/about',
  '/press-kit',
  '/uses',
  '/projects',
  '/speaking',
  '/writing',
  '/videos',
  '/ai',
  '/contact',
  '/privacy',
  '/developers',
  '/livestreams',
  '/alive-and-kicking',
]);

/** Resolve canonical HTML paths to their pre-rendered markdown twins at the edge. */
export function markdownTwinPath(pathname: string): string | undefined {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/') return '/index.md';
  if (STATIC_PAGES.has(path)) return `${path}.md`;
  if (path.startsWith('/writing/') && !path.startsWith('/writing/tag/')) return `${path}.md`;
  if (path.startsWith('/videos/') && !path.startsWith('/videos/playlist/')) return `${path}.md`;
  if (path.startsWith('/projects/')) return `${path}.md`;
  return undefined;
}

export default function middleware(request: Request): Response {
  if (!request.headers.get('accept')?.includes('text/markdown')) return next();

  const url = new URL(request.url);
  const markdownPath = markdownTwinPath(url.pathname);
  if (!markdownPath) return next();

  url.pathname = markdownPath;
  return rewrite(url, { headers: { Vary: 'Accept, Accept-Encoding' } });
}

export const config = {
  matcher: [
    '/',
    '/about',
    '/press-kit',
    '/uses',
    '/projects/:path*',
    '/speaking',
    '/writing/:path*',
    '/videos/:path*',
    '/ai',
    '/contact',
    '/privacy',
    '/developers',
    '/livestreams',
    '/alive-and-kicking',
  ],
};
