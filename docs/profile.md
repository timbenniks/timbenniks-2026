# Personal profile

`/profile` is a personal briefing for people and AI agents, inspired by the document-first approach of lauren.md. `/profile.md` exposes the same briefing as `text/markdown`. It uses the existing site fonts, colors, and article styles.

The profile uses `BaseLayout` in `standalone` mode, which omits the global site navigation and footer while retaining metadata, fonts, the skip link, and public agent tools. Other pages retain the full site layout. The profile's contents rail and anchor offsets account for the absence of the site header.

Both routes share `loadProfile()` in `src/lib/profile.ts`. Bios, facts, and speaking topics come from the press kit; career roles come from the about-page timeline. The first six projects by editorial order, three latest published essays, and four latest scheduled/recent speaking entries come from their existing collections. Nothing is scraped from the deployed site, and no extra dependencies are required. Edit the existing sources to update the profile on the next build.

The profile includes source links, attribution guidance, uncertainty rules, and direct contact links. Speaking dates are explicit and scheduled appearances are not represented as completed talks. The profile review date is an editorial date in `PROFILE_REVIEWED`, not a timestamp implying that every source was reverified at each build.

Discovery includes the site footer, `/llms.txt`, `/agents.md`, the content index, and sitemaps. Public `get_content` and REST content retrieval support `/profile` and `/profile.md`. HTML advertises its Markdown alternate. Existing middleware and the build's CDN route generator handle `Accept: text/markdown`.

## Future domain

No timbenniks.md domain, DNS, redirect, or hosting changes are made. The working routes and canonical URLs currently use timbenniks.dev. When the domain is ready, map its homepage and `/index.md` to this profile, set the corresponding canonical and alternate URLs, and retain absolute timbenniks.dev links for original source material. Do not change the entire site's `SITE_URL` to move only this profile.

## Validation

Run `npm run check`, `npm run build`, and the profile checks in `e2e/geo.spec.ts`. The production route checks also validate Markdown content negotiation. Browser QA should cover the reading layout and contents links at desktop and mobile widths.

Validation also exposed a pre-existing Astro image-service signature mismatch. The Cloudinary `getSrcSet` hook and its `getURL` call now use the installed Astro API's two arguments; image transformation behavior is unchanged.

Verified on 2026-11-12:

- `npm run check`: zero errors and warnings (27 existing hints).
- `npm run build`: passes, including the generated `/profile` Markdown negotiation route and Pagefind index.
- `E2E_BASE_URL=http://127.0.0.1:4338 npx playwright test --config=playwright.build.config.ts e2e/geo.spec.ts e2e/cdn-routing.spec.ts`: 33 tests pass.
- Desktop (1280px) and mobile (375px) browser checks: no horizontal overflow; contents links land below the sticky navigation.
- Required deployed-site Agentlint scan: all six reasoning tasks resolved from supplied evidence; overall 100, bounded task success 99, no prioritized remediation. This scan covers the deployed site, not the unpublished profile.

There are no separate `typecheck` or `lint` scripts in this repository; `check` is the Astro type check.
