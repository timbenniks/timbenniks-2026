// Short prose summaries of the hand-built static pages, used by /llms.txt and
// /llms-full.txt. Kept here (instead of scraping the rendered Astro output) so
// the GEO endpoints have stable, parseable text regardless of how the visual
// pages evolve.

export interface StaticPage {
  path: string;
  title: string;
  description: string;
  prose: string;
}

export const STATIC_PAGES: StaticPage[] = [
  {
    path: '/',
    title: 'Home',
    description:
      'Developer Experience Lead at Contentstack. Writing, talks, and videos on developer tools, AI-accelerated engineering, and composable architecture.',
    prose: `Tim Benniks designs developer platforms and builds AI-augmented products. Currently Developer Experience Lead at Contentstack — leading product for the Developer Hub, Marketplace, MCP server, and Agent Skills. Co-chair of the MACH Alliance Enterprise AI Agents Workgroup. Twenty years building digital platforms for global brands at AKQA, Valtech, Mirabeau, Hygraph, and Uniform.`,
  },
  {
    path: '/about',
    title: 'About',
    description:
      'Developer Experience Lead at Contentstack. Co-chair, MACH Alliance Enterprise AI Agents Workgroup. Twenty years building digital platforms for global brands.',
    prose: `Beliefs that shape the work:

- Speed is solved. Direction is not. Anyone can ship faster now; the harder problem is shipping the right thing, and the way to learn what that is, is by building.
- Developer experience is product strategy. How developers feel about the tools they use becomes how their teams ship. DX is not polish on top — it is the strategy.
- Taste is a technical skill. When generation is cheap, the bottleneck moves to judgment.
- Building is how you discover. Roadmaps that survive contact with code are the ones written next to the code, not before it.

Career arc:

- 2008–2018: Frontend, then technical leadership at agencies (AKQA, Valtech, Mirabeau) — Nike, Google, CHANEL, Louis Vuitton, Procter & Gamble.
- 2019–2023: Head of Developer Relations at Hygraph and Uniform. Speaking at Vue Amsterdam, JAMstack Conf, Headless Conf, and dozens of meetups.
- 2024–now: Developer Experience at Contentstack. Developer Hub & Marketplace, MCP, and Agent Skills — the surface area where AI agents and human developers meet enterprise content systems.

Roles: Co-chair, MACH Alliance Enterprise AI Agents Workgroup. Ambassador for Nuxt, Cloudinary, Supabase, Algolia. Based in the French countryside. Off the clock: guitar, family, two corgis.`,
  },
  {
    path: '/livestreams',
    title: 'Livestreams',
    description:
      'Contentstack, Hygraph, Uniform, and personal livestreams. Tim learns in public with guests — every stream has a live coding element.',
    prose: `Four livestream series:

- Contentstack Streams (current, bi-weekly): DXP topics with a live coding element. Agent OS, Visual Builder, Edge, Automate.
- Hygraph Streams (archive): weekly headless CMS sessions.
- Uniform Streams (archive): product meetups and stack deep-dives.
- Personal / misc streams: Dare Dialogues and one-off MACH conversations.

Index: /livestreams. Playlists: /videos/playlist/live-contentstack, /videos/playlist/live-hygraph, /videos/playlist/live-uniform, /videos/playlist/misc-streams.`,
  },
  {
    path: '/alive-and-kicking',
    title: 'Alive and Kicking',
    description:
      'An interactive guitar karaoke experience in the browser. Vue, Nuxt, WebMIDI, and a live-voting audience — built to show what composable architecture can do on stage.',
    prose: `Alive and Kicking is a conference talk and browser-based rock & roll guitar karaoke experience. Vue, Nuxt, WebMIDI, Supabase, Cloudinary, Hygraph, and Vercel drive backing tracks, amp presets, and a live-voting audience. Attendees vote on the next song; votes appear on the big screen. Videos: /videos/playlist/alive-and-kicking. Booking: /press-kit.`,
  },
  {
    path: '/uses',
    title: 'Uses',
    description:
      'The hardware, software, and audio/video kit Tim Benniks uses to build, write, livestream, and ship every day.',
    prose: `A regularly-updated list of the hardware, software, and audio/video kit used for building, writing, livestreaming, and recording. See /uses for the current setup.`,
  },
  {
    path: '/projects',
    title: 'Projects',
    description: 'Platform work, MCP servers, SDKs, and the occasional weekend experiment.',
    prose: `Platform work, MCP servers, SDKs, and weekend experiments. Curated list at /projects.`,
  },
  {
    path: '/press-kit',
    title: 'Press kit',
    description:
      'Bios, headshots, on-stage photos, speaker topics, and contact details for booking Tim Benniks for conferences, podcasts, and developer events.',
    prose: `Speaker bios (short, medium, long), headshots and on-stage photos, talk topics, and contact details for booking conferences, podcasts, and developer events. Available at /press-kit.`,
  },
  {
    path: '/ai',
    title: 'AI readiness',
    description:
      'How timbenniks.dev is built for AI agents and crawlers: markdown twins, llms.txt, content indexes, and public WebMCP tools — without turning the site into a dump.',
    prose: `This site is built for humans first, and for AI agents as a first-class audience. Content is meant to be read, summarized, and quoted — with attribution.

Three principles:

1. Markdown twins — append .md to writing, video, project, and main page URLs, or send Accept: text/markdown.
2. Indexes, not scrapes — start with /llms.txt, /content-index.json, feeds, and sitemaps.
3. In-tab tools — six read-only WebMCP tools register when document.modelContext exists.

Human explainer: /ai. Agent contract: /agents.md.`,
  },
];

export const SITE_SUMMARY =
  'Personal site of Tim Benniks — Developer Experience Lead at Contentstack. Writing, talks, and videos on developer experience, AI-accelerated engineering, composable architecture, and the platform surface where AI agents meet enterprise content systems.';
