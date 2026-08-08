/**
 * Client-side Cloudinary delivery URL helpers (thumbs for admin UI).
 */

/**
 * Parse `https://res.cloudinary.com/{cloud}/image/upload/{tail}` and strip a
 * leading transformation segment when present.
 */
export function parseUploadUrl(url: unknown): { cloudName: string; tail: string } | null {
  if (typeof url !== 'string') return null;
  const m = url.match(/^https?:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/i);
  if (!m || !m[1] || !m[2]) return null;
  let tail = m[2];
  const slash = tail.indexOf('/');
  if (slash > 0) {
    const seg = tail.slice(0, slash);
    if (seg.includes(',') && /[a-z]_[^/]+/.test(seg)) {
      tail = tail.slice(slash + 1);
    }
  }
  return { cloudName: m[1], tail };
}

export type ThumbMode = 'fill' | 'limit';

/**
 * Square (or limited) delivery URL via transforms — never load full-res originals in grids.
 * Prefers rebuilding from publicId; falls back to injecting transforms into secure_url.
 */
export function deliveryThumbUrl(
  secureUrl: unknown,
  size = 320,
  publicId = '',
  mode: ThumbMode = 'fill',
): string {
  const w = Math.max(64, Math.round(size));
  const transform =
    mode === 'limit'
      ? `c_limit,w_${w},f_auto,q_auto`
      : `c_fill,g_auto,w_${w},h_${w},q_auto,f_auto,dpr_auto`;
  const id = String(publicId || '').replace(/^\/+/, '');
  const parsed = parseUploadUrl(secureUrl);

  if (parsed) {
    return `https://res.cloudinary.com/${parsed.cloudName}/image/upload/${transform}/${id || parsed.tail}`;
  }

  if (id && typeof secureUrl === 'string') {
    const cloud = secureUrl.match(/res\.cloudinary\.com\/([^/]+)/i)?.[1];
    if (cloud) {
      return `https://res.cloudinary.com/${cloud}/image/upload/${transform}/${id}`;
    }
  }

  if (typeof secureUrl === 'string' && secureUrl.includes('/upload/')) {
    return secureUrl.replace('/upload/', `/upload/${transform}/`);
  }

  return typeof secureUrl === 'string' ? secureUrl : '';
}
