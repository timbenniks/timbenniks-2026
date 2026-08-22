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
    path: '/contact',
    title: 'Contact Tim Benniks',
    description:
      'How to reach Tim Benniks for speaking, podcast bookings, corrections, and collaboration — hi@timbenniks.dev.',
    prose: `Tim Benniks welcomes speaking inquiries, podcast bookings, press questions, and corrections to published content.

Email: hi@timbenniks.dev — the fastest route for booking conferences, podcasts, workshops, and panels. Include event name, proposed dates, format (keynote, talk, workshop, podcast), audience, and location.

Press and photos: /press-kit and /press-kit.json have bios, headshots, on-stage photos, and speaker topics.

Agent booking: call request_booking via /tools.json or /api/mcp — returns a draft email for the user to confirm. Agents must not send email without human approval.

Social: LinkedIn linkedin.com/in/timbenniks, GitHub github.com/timbenniks, Bluesky bsky.app/profile/timbenniks.dev.

Tim Benniks is based in the French countryside and speaks at developer conferences worldwide on developer experience, AI-augmented engineering, composable architecture, and MCP.`,
  },
  {
    path: '/privacy',
    title: 'Privacy — Tim Benniks',
    description:
      'Privacy policy for timbenniks.dev — what Tim Benniks collects, third-party services, and your rights.',
    prose: `This privacy policy describes how Tim Benniks operates timbenniks.dev (timbenniks.dev and preview deployments).

What this site collects: timbenniks.dev is a static personal website. It does not operate user accounts, shopping carts, or comment forms on public pages. When you visit, standard web server and CDN logs (IP address, user agent, requested URL, timestamp) may be processed by the hosting provider (Vercel) for security and performance. Vercel's privacy policy applies to that processing.

Analytics: this site does not load third-party analytics trackers on public pages by default. If that changes, this page will be updated.

Email: if you email hi@timbenniks.dev, your message and address are used only to respond. Messages are not sold or shared for advertising.

Third-party content: embedded YouTube players, Cloudinary images, and outbound links to social networks may set their own cookies when you interact with them.

Agent and machine access: public endpoints (/llms.txt, /agents.md, /tools.json, /api/mcp, markdown twins) are intentionally readable by crawlers and AI agents. Do not send personal data to these endpoints.

Your rights: EU/UK visitors may request access or deletion of personal data held via email. Tim Benniks aims to respond within 30 days.

Contact: hi@timbenniks.dev or /contact. Last updated August 2026.`,
  },
  {
    path: '/developers',
    title: 'Tim Benniks Developer Resources',
    description:
      'Developer API docs for timbenniks.dev — Tim Benniks MCP server, OpenAPI spec, WebMCP tools, content indexes, and markdown content negotiation.',
    prose: `Tim Benniks Developer Resources — machine-readable API surfaces for AI agents and integrators consuming timbenniks.dev.

Discovery: /llms.txt (site map), /agents.md (agent contract), /developers (this page), /openapi.json (OpenAPI 3.1 contract).

REST API: GET /api/v1 for discovery; GET /api/v1/search?query=... to search; GET /api/v1/content to list content; GET /api/v1/content/{path} to retrieve one markdown document in JSON; GET /api/v1/press-kit for structured speaker assets. It is public, read-only, and requires no authentication.

Errors: every /api/v1 error uses RFC 9457 application/problem+json with type, title, status, detail, instance, code, and resolution. Responses advertise a 120-request / 60-second quota using RateLimit and RateLimit-Policy; 429 responses also include Retry-After.

Versioning: stable REST endpoints use major URL versions (/api/v1). Additive changes stay within a major version. Breaking changes use a new major version. Deprecations are announced with Deprecation, Sunset, and Link headers at least 90 days before shutdown.

MCP server: /.well-known/mcp (discovery handshake) → POST /api/mcp (streamable HTTP JSON-RPC). Six read-only tools: get_page_context, search_site, list_content, get_content, get_press_kit, request_booking. Tool schemas: /tools.json and /.well-known/webmcp.json.

OpenAPI: /openapi.json describes every REST operation and its typed success and RFC 9457 error responses.

Content negotiation: send Accept: text/markdown to any main page URL, or append .md to writing/video/project/static URLs. Vary: Accept, Accept-Encoding on negotiable responses.

Indexes: /content-index.json, /feed.json, /feed.xml, /sitemap.md, /sitemap-index.xml.

Auth: public surfaces require no authentication. Admin CMS at /admin is cookie-gated and not for public agents.

Author: Tim Benniks — Developer Experience Lead at Contentstack.`,
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
