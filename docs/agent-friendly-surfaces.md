# Agent-friendly surfaces

The site exposes first-class surfaces for AI agents and crawlers:

- `/llms.txt` is the concise site overview and curated link index.
- `/llms-full.txt` is the larger markdown corpus with writing entries, video metadata, speaking engagements, and static page summaries.
- `/agents.md` explains how agents should ingest and attribute the site.
- `/ai` is the human-facing explainer of the same surfaces (markdown twin at `/ai.md`).
- `/sitemap.md` mirrors the XML sitemap in markdown.
- `/writing/<slug>.md` and `/videos/<slug>.md` expose per-entry markdown, with video transcripts included when available.

HTML pages also advertise these surfaces in the document head. Writing and video pages expose per-page markdown alternates, and video pages include `VideoObject` JSON-LD for machine-readable video metadata.

## Auditing with agentlint

[agentlint](https://agentlint.timbenniks.dev) scores how usable these surfaces are for agents. Config lives in `agentlint.config.json`; reports land in the git-ignored `.agentlint/`.

| Command | Target |
| ------- | ------ |
| `npm run agentlint` | `https://timbenniks.dev` — the deployed site |
| `npm run agentlint:local` | `http://127.0.0.1:4321` — a running `astro dev` |

Scan the local dev server while `timbenniks.dev` still serves the previous site: the production host has no `/llms.txt`, `/api/v1`, or `/api/mcp` yet, so a production scan under-reports this codebase by roughly ten points.

Four findings are expected against `astro dev` and are **not** defects:

- **sitemap** — `@astrojs/sitemap` only emits at build time, and `robots.txt` points at the absolute production URL.
- **markdown negotiation** — `Accept: text/markdown` is handled by `middleware.ts`, which is Vercel edge middleware and does not run under `astro dev`.
- **canonical host consistency** — canonicals are absolute `https://timbenniks.dev/…` while the scan runs on `127.0.0.1`.
- **WebMCP** — `src/scripts/public-webmcp.ts` feature-detects `document.modelContext` and no-ops when absent, which is every browser outside the Chrome origin trial. Passing this check means shipping the ~390 KB `@mcp-b/global` polyfill on every public page. That is deliberately declined: the polyfill is loaded only inside `/admin`, and the same tools stay reachable headlessly via `/api/mcp` and `/tools.json`.

### `AGENTS.md` shadows `/agents.md` in dev (macOS / Windows only)

`agentlint init` writes an `AGENTS.md` at the repo root. On a case-insensitive filesystem, Vite's root static middleware serves that file for `/agents.md` and shadows `src/pages/agents.md.ts`, so `astro dev` hands agents the wrong document and `e2e/geo.spec.ts` fails its `Vary` assertion. Linux CI and production are unaffected — the build only serves `dist/client`, and `AGENTS.md` ≠ `agents.md` on a case-sensitive filesystem. To read the real route locally, move `AGENTS.md` aside for the duration of the scan.
