import { isAdminPreviewRequest } from './admin/request-context';

export type YoutubeQuality = 'maxresdefault' | 'hqdefault';

export function youtubeThumbnailUrl(videoId: string, quality: YoutubeQuality = 'maxresdefault'): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

// HEAD-probe whether maxresdefault.jpg exists. YouTube auto-generates it for
// most uploads but skips short/old videos — in which case we fall back to
// hqdefault, which is always present. Cached per videoId for the build.
const probeCache = new Map<string, Promise<YoutubeQuality>>();

export async function resolveYoutubeThumbnail(
  videoId: string,
): Promise<{ url: string; quality: YoutubeQuality }> {
  // Admin preview reloads often — skip outbound HEAD probes and use the
  // always-available hqdefault poster.
  if (isAdminPreviewRequest()) {
    return { url: youtubeThumbnailUrl(videoId, 'hqdefault'), quality: 'hqdefault' };
  }
  const quality = await resolveQuality(videoId);
  return { url: youtubeThumbnailUrl(videoId, quality), quality };
}

export function resolveYoutubeThumbnailQuality(videoId: string): Promise<YoutubeQuality> {
  let cached = probeCache.get(videoId);
  if (!cached) {
    cached = probeMaxres(videoId);
    probeCache.set(videoId, cached);
  }
  return cached;
}

async function resolveQuality(videoId: string): Promise<YoutubeQuality> {
  return resolveYoutubeThumbnailQuality(videoId);
}

async function probeMaxres(videoId: string): Promise<YoutubeQuality> {
  try {
    const res = await fetch(youtubeThumbnailUrl(videoId, 'maxresdefault'), { method: 'HEAD' });
    return res.ok ? 'maxresdefault' : 'hqdefault';
  } catch {
    return 'hqdefault';
  }
}
