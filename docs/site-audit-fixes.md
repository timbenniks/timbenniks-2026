# September 2026 site audit

The Pulsar CSV lists title, description, and image-alt warnings across 23 distinct paths. The screenshot totals differ from the export; the CSV is the page-level scope for these changes.

- Page metadata now uses concise, descriptive titles that account for the shared ` - Tim Benniks` suffix. The homepage no longer repeats Tim's name.
- Short project names have optional `seoTitle` frontmatter, used by the page metadata while preserving project headings and card names.
- Long page and project descriptions have been edited into complete summaries. Project descriptions also appear in cards, page introductions, and structured data.
- Shared card thumbnails use the content title as alt text, and author portraits identify the person pictured.
- Decorative quote backgrounds retain empty alt attributes and `aria-hidden="true"`. The homepage and About page each contain one; an audit that flags every empty alt value may still report these. Giving decorative images redundant descriptions would not improve accessibility.

Run `npm run build`, `npm run check`, and `python3 scripts/check-site-audit.py`. The last command checks built HTML for all 23 exported paths: titles of 30–60 characters, descriptions of 120–160 characters, and nonempty image alternatives except explicitly hidden decoration. These are editorial ranges, not search-engine guarantees; the CSV does not include Pulsar's exact thresholds.

The required production Agentlint scan completed with all six reasoning tasks resolved: overall 100, surface readiness 100, bounded task success 96. It also reported a WebMCP runtime failure because `document.modelContext` was unavailable. The public script intentionally supports either `document.modelContext` or `navigator.modelContext` and exposes its catalog without registering when neither browser API exists. This browser-dependent finding does not justify changing the site's feature detection or adding a shim merely to satisfy the scanner. No deployment was performed; production and Pulsar need a new scan after publication.
