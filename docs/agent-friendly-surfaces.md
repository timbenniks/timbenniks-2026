# Agent-friendly surfaces

The site exposes first-class surfaces for AI agents and crawlers:

- `/llms.txt` is the concise site overview and curated link index.
- `/llms-full.txt` is the larger markdown corpus with writing entries, video metadata, speaking engagements, and static page summaries.
- `/agents.md` explains how agents should ingest and attribute the site.
- `/sitemap.md` mirrors the XML sitemap in markdown.
- `/writing/<slug>.md` and `/videos/<slug>.md` expose per-entry markdown, with video transcripts included when available.

HTML pages also advertise these surfaces in the document head. Writing and video pages expose per-page markdown alternates, and video pages include `VideoObject` JSON-LD for machine-readable video metadata.
