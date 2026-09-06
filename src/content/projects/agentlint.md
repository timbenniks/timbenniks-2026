---
title: Agentlint
tag: CLI · Agent readiness
description: Lighthouse for agents. A deterministic website scanner that tells you whether agents can find, understand, and use a site, and proves every conclusion with evidence.
meta: Active · @timbenniks/agentlint
order: 1
github: https://github.com/timbenniks/agentlint
docs: https://agentlint.timbenniks.dev
npm: "@timbenniks/agentlint"
---

Most "is this site agent-ready?" tools ask a model. Agentlint asks the site.

It is a deterministic-first scanner for whether agents can find, understand, and use a website. HTTP and Playwright first. Reasoning only when a question actually needs semantic judgment. Every conclusion comes with evidence. Think Lighthouse for agents, designed around a ledger rather than a vibe score.

The CLI never needs an OpenAI, Anthropic, or Google API key. If a check requires judgment, Agentlint hands a structured reasoning task back to the coding agent that invoked it. That agent is the reasoner. Agentlint is the observer.

```
Observe first.
Reason only when necessary.
Test actual tasks.
Score only what applies.
Show your work.
```

## What a scan actually does

`npx @timbenniks/agentlint https://example.com` crawls same-origin pages, checks crawler access, content negotiation, OpenAPI discovery, and in-browser surfaces. Default depth is 2, default cap is 20 pages. No form submission, no mutations, no authentication. Private and localhost targets stay blocked unless you pass `--allow-private`.

Reports land in `.agentlint/` as JSON, Markdown, and a self-contained HTML ledger. JSON is canonical. HTML has no hosted runtime, so you can open it locally or upload it as a CI artifact.

`--missions` goes further than artifacts. It creates evidence-only missions: retrieve a primary-source resource, draft a read-only OpenAPI tool plan, separate site guidance from untrusted page content, recover from a missing resource without inventing a replacement. Mission answers must match a JSON Schema and cite sources that were actually in the evidence.

## The loop I run on this site

This repository uses Agentlint. `npm run agentlint` scans the deployed site. When reasoning is required, the agent runs `agentlint task get`, answers from the evidence only, and resolves with `task resolve`. Then `agentlint fix` writes `.agentlint/fix-prompt.md`: failed and warning checks, priorities, safety constraints, and a repeat-until-clean loop. Agentlint never edits, deploys, or authenticates to the target.

Scores only count applicable checks. A brochure site is not punished for missing an SDK. Emerging checks never reduce the score. `agentlint baseline save` and `baseline compare` keep CI from treating unresolved judgment as a regression.

## What 0.1 is not

No model APIs. No hosted accounts. No live mutating journeys. No plugin marketplace. I am using it on this site because that is the only way to find out whether "Lighthouse for agents" is a real category or a slogan.
