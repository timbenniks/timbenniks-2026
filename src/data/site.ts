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

export const hero = {
  headlineLead: 'I used to build',
  headlineEm: 'websites.',
  headlineTail: 'Now I build what builds them.',
  subline:
    'Developer Experience Lead at Contentstack. Co-chair, MACH Alliance Enterprise AI Agents Workgroup. Ambassador for Nuxt, Cloudinary, Supabase, and Algolia.',
  primary: { label: 'Read the writing', href: '/writing' },
  secondary: { label: 'More about Tim', href: '/about' },
};

export const thesis = {
  lead: 'When output is cheap,',
  em: 'taste',
  tail: 'is everything.',
  attribution:
    'This article elaborates how AI-generated, scale-built content collapses everything from blogs to other building blocks. AI-generated, scaled-built content collapses everything from blogs to other building blocks.',
  cta: { label: 'Read the essay', href: '/writing' },
};

export const about = {
  lead: 'Twenty years building digital platforms for global brands. Now leading Developer Experience at Contentstack, shaping the future of developer-facing products and AI-driven workflows.',
  body: 'Tim Benniks is a Developer Experience and Product leader at Contentstack, where he drives DX, Developer Hub & Marketplace, MCP, and Agent Skills. Tim is a frequent speaker, content creator, ambassador for Cloudinary, Supabase, Nuxt, Algolia and Co-chair of the Enterprise AI Agents Workgroup at the MACH Alliance.',
};

export const booking = {
  text: 'Got a stage, a podcast, or a developer team that needs sharpening?',
  em: "Let's talk.",
  cta: { label: 'Press kit & booking', href: '/press-kit' },
};

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

export const footerHuman = 'Guitar. Family. Two corgis that run the house.';
