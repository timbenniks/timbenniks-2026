export const SITE_URL = 'https://timbenniks.dev';

export function siteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}

export const seo = {
  siteName: 'Tim Benniks',
  titleSuffix: ' - Tim Benniks',
  defaultImage:
    'https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,w_1280/Presskit/tim_aug_2023_no_logo.png',
  defaultImageAlt: 'Tim Benniks',
  defaultImageWidth: 1280,
  defaultImageHeight: 800,
  twitterCreator: '@timbenniks',
  locale: 'en-US',
  authorId: '/about#Person',
} as const;

export const author = {
  name: 'Tim Benniks',
  href: '/about',
  avatar:
    'https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,w_96,h_96,c_thumb/Tim/timreal.png',
} as const;

export const social = [
  'https://linkedin.com/in/timbenniks',
  'https://github.com/timbenniks',
  'https://youtube.com/timbenniks',
  'https://bsky.app/profile/timbenniks.dev',
  'https://www.npmjs.com/~timbenniks',
  'https://twitter.com/timbenniks',
] as const;

export type { NavLink, FooterColumn, SiteChrome } from '../lib/site-schema';
