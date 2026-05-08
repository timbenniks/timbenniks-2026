// Thumbnail URL helpers for the two image hosts used by content cards:
// - res.cloudinary.com → injects f_auto,q_auto,w_<n> (variable widths)
// - i.ytimg.com / img.youtube.com → routed through Cloudinary's image/fetch
//   delivery pointed at the explicit YouTube CDN URL, so YouTube posters get
//   the same f_auto,q_auto,w_<n> pipeline. Quality slug (maxresdefault vs
//   hqdefault) is preserved from the source URL or resolved per videoId via
//   resolveYoutubePosterQuality().
// Anything else passes through unchanged.
//
// Note: the fetch route requires i.ytimg.com to be in your Cloudinary account's
// allowed fetch domains.

const CLOUDINARY_HOST = 'res.cloudinary.com';
const CLOUDINARY_CLOUD = 'dwfcofnrd';
const YT_THUMB = /\/\/(?:i\.ytimg\.com|img\.youtube\.com)\/vi\/([^/]+)\/([^/]+)\.jpg/;

export type YoutubePosterQuality = 'maxresdefault' | 'hqdefault';

export function thumbUrl(url: string | undefined, width: number): string | undefined {
  if (!url) return undefined;
  const yt = url.match(YT_THUMB);
  if (yt) return cloudinaryFetchYouTube(yt[1], yt[2], width);
  if (url.includes(CLOUDINARY_HOST)) return cloudinaryAt(url, width);
  return url;
}

export function thumbSrcset(url: string | undefined, widths: number[]): string | undefined {
  if (!url) return undefined;
  const yt = url.match(YT_THUMB);
  if (yt) {
    return widths.map((w) => `${cloudinaryFetchYouTube(yt[1], yt[2], w)} ${w}w`).join(', ');
  }
  if (url.includes(CLOUDINARY_HOST)) {
    return widths.map((w) => `${cloudinaryAt(url, w)} ${w}w`).join(', ');
  }
  return undefined;
}

export function youtubePoster(videoId: string, width: number, quality: YoutubePosterQuality = 'maxresdefault'): string {
  return cloudinaryFetchYouTube(videoId, quality, width);
}

export function youtubeThumbUrl(videoId: string, quality: YoutubePosterQuality): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

// Probe whether a video has a maxresdefault poster. YouTube auto-generates
// maxresdefault for most uploads but skips it for short or older videos, in
// which case we fall back to hqdefault (always present). Cached per videoId
// for the lifetime of the build.
const posterQualityCache = new Map<string, Promise<YoutubePosterQuality>>();

export function resolveYoutubePosterQuality(videoId: string): Promise<YoutubePosterQuality> {
  let cached = posterQualityCache.get(videoId);
  if (!cached) {
    cached = probeMaxres(videoId);
    posterQualityCache.set(videoId, cached);
  }
  return cached;
}

async function probeMaxres(videoId: string): Promise<YoutubePosterQuality> {
  try {
    const res = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, { method: 'HEAD' });
    return res.ok ? 'maxresdefault' : 'hqdefault';
  } catch {
    return 'hqdefault';
  }
}

function cloudinaryFetchYouTube(videoId: string, quality: string, width: number): string {
  const src = `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/fetch/f_auto,q_auto,w_${width}/${encodeURIComponent(src)}`;
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
