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

export type NavLink = { label: string; href: string };

export const nav: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Writing', href: '/writing' },
  { label: 'Videos', href: '/videos' },
  { label: 'Speaking', href: '/speaking' },
  { label: 'Projects', href: '/projects' },
  { label: 'Uses', href: '/uses' },
];

export const newsletter = {
  heading: 'The good stuff, occasionally.',
  body: "One email when there's something worth reading. No drip campaign, no funnel, just writing.",
};

export type FooterColumn = { heading: string; links: { label: string; href: string }[] };

export const footerColumns: FooterColumn[] = [
  {
    heading: 'Read',
    links: [
      { label: 'Writing', href: '/writing' },
      { label: 'Videos', href: '/videos' },
      { label: 'Speaking', href: '/speaking' },
    ],
  },
  {
    heading: 'About',
    links: [
      { label: 'About Tim', href: '/about' },
      { label: 'Press kit', href: '/press-kit' },
      { label: 'Uses', href: '/uses' },
      { label: 'Projects', href: '/projects' },
    ],
  },
  {
    heading: 'Elsewhere',
    links: [
      { label: 'LinkedIn', href: 'https://linkedin.com/in/timbenniks' },
      { label: 'YouTube', href: 'https://youtube.com/timbenniks' },
      { label: 'GitHub', href: 'https://github.com/timbenniks' },
      { label: 'Bluesky', href: 'https://bsky.app/profile/timbenniks.dev' },
    ],
  },
];

export const footerHuman = 'Crafted by hand. No tokens were burnt in the making of this website.';
