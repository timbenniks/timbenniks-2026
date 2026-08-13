import { SITE_URL, siteUrl } from '../data/site';

export function writingPermalink(id: string): string {
  return siteUrl(`/writing/${id}`);
}

/** Default canonical for any page: always the production host, never preview/local. */
export function pageCanonical(pathname: string): string {
  return siteUrl(pathname);
}

function isOwnSiteHost(hostname: string): boolean {
  if (hostname === 'timbenniks.dev' || hostname === 'www.timbenniks.dev') return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  return hostname.endsWith('.vercel.app');
}

/**
 * Same-site canonicals always resolve to https://timbenniks.dev/writing/<live-slug>,
 * including on preview and local hosts. Off-site originals (Uniform / Hygraph /
 * Cloudinary / etc.) stay as-is.
 */
export function writingCanonical(id: string, raw?: string | null): string {
  const live = writingPermalink(id);
  const value = raw?.trim();
  if (!value) return live;
  try {
    const canonical = new URL(value, SITE_URL);
    if (isOwnSiteHost(canonical.hostname)) return live;
    return canonical.href;
  } catch {
    return live;
  }
}
