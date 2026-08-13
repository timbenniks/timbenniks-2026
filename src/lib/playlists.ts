const PLAYLIST_LABELS: Record<string, string> = {
  'alive-and-kicking': 'Alive and Kicking',
  contentstack: 'Contentstack',
  'headless-creator': 'Headless Creator',
  hygraph: 'Hygraph',
  'live-contentstack': 'Live · Contentstack',
  'live-hygraph': 'Live · Hygraph',
  'live-uniform': 'Live · Uniform',
  'misc-streams': 'Misc streams',
  mp: 'MP',
  tim: 'Tim Benniks',
  uniform: 'Uniform',
};

export function playlistSlug(name: string): string {
  return name.replace(/\s+/g, '-');
}

export function playlistHref(playlist: string): string {
  return `/videos/playlist/${playlistSlug(playlist)}`;
}

export function playlistLabel(playlist: string): string {
  const slug = playlistSlug(playlist);
  return (
    PLAYLIST_LABELS[slug] ??
    playlist.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
