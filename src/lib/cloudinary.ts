// Thumbnail URL helpers for the two image hosts used by content cards:
// - res.cloudinary.com → injects f_auto,q_auto,w_<n> (variable widths)
// - i.ytimg.com / img.youtube.com → swaps the quality slug (3 fixed steps)
// Anything else passes through unchanged.

const CLOUDINARY_HOST = 'res.cloudinary.com';
const YT_THUMB = /\/\/(?:i\.ytimg\.com|img\.youtube\.com)\/vi\/[^/]+\/[^/]+\.jpg/;

export function thumbUrl(url: string | undefined, width: number): string | undefined {
  if (!url) return undefined;
  if (YT_THUMB.test(url)) {
    const quality = width >= 700 ? 'maxresdefault' : 'hqdefault';
    return url.replace(/\/[^/]+\.jpg$/, `/${quality}.jpg`);
  }
  if (url.includes(CLOUDINARY_HOST)) return cloudinaryAt(url, width);
  return url;
}

export function thumbSrcset(url: string | undefined, widths: number[]): string | undefined {
  if (!url) return undefined;
  if (url.includes(CLOUDINARY_HOST)) {
    return widths.map((w) => `${cloudinaryAt(url, w)} ${w}w`).join(', ');
  }
  if (YT_THUMB.test(url)) {
    const swap = (q: string) => url.replace(/\/[^/]+\.jpg$/, `/${q}.jpg`);
    return `${swap('mqdefault')} 320w, ${swap('hqdefault')} 480w, ${swap('maxresdefault')} 1280w`;
  }
  return undefined;
}

function cloudinaryAt(url: string, width: number): string {
  const i = url.indexOf('/upload/');
  if (i === -1) return url;
  const head = url.slice(0, i + '/upload/'.length);
  let tail = url.slice(i + '/upload/'.length);
  // Strip a leading transformation segment (e.g. "q_auto,f_auto,w_1280/") so we can replace it.
  const firstSlash = tail.indexOf('/');
  if (firstSlash > 0) {
    const seg = tail.slice(0, firstSlash);
    if (seg.includes(',') && /[a-z]_[^/]+/.test(seg)) {
      tail = tail.slice(firstSlash + 1);
    }
  }
  return `${head}f_auto,q_auto,w_${width}/${tail}`;
}
