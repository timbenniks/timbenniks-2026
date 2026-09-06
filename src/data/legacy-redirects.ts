/** Live-site URLs that must keep working after cutover. */

const VIDEO_PLAYLISTS = [
  'alive-and-kicking',
  'contentstack',
  'headless-creator',
  'hygraph',
  'live-contentstack',
  'live-hygraph',
  'live-uniform',
  'misc-streams',
  'mp',
  'tim',
  'uniform',
] as const;

export function legacyRedirectMap(): Record<string, string> {
  const out: Record<string, string> = {
    '/presskit': '/press-kit',
    '/sitemap.xml': '/sitemap-index.xml',
  };
  for (const playlist of VIDEO_PLAYLISTS) {
    out[`/videos/${playlist}`] = `/videos/playlist/${playlist}`;
  }
  return out;
}
