---
title: Cursor Rules
tag: OSS · Agent workflow
description: "A reusable Cursor ruleset and command kit so the agent behaves like a senior engineer on a SaaS project: constrained, repeatable, and boring in the ways that matter."
meta: Open source · MIT
order: 12
github: https://github.com/timbenniks/timbenniks-cursor-rules
---

Cursor is not magic. It is leverage, and leverage only works when you apply constraints.

I published [timbenniks-cursor-rules](https://github.com/timbenniks/timbenniks-cursor-rules) after the novelty wore off. What I wanted was not a folder of clever prompts. I wanted the agent to behave like the senior engineer I actually want next to me on a SaaS project: plan first, small diffs, root-cause debugging, accessibility before it ships.

The longer argument is in [Cursor, rules, and my vibe engineer workflow](/writing/cursor-rules-and-my-vibe-engineer-workflow). This page is the artifact.

## What you copy

A `.cursor` folder with modular rules and slash commands. Copy it into a project and Cursor picks up `rules/*/RULE.md` and `commands/*.md`. Or copy `AGENTS.md` if you want one file.

Rules are scoped by concern:

- **nextjs-stack**: Next.js 16 App Router, TypeScript, server components, Tailwind v4
- **ui-a11y**: shadcn/ui, semantic HTML, keyboard and ARIA
- **backend-security**: validation, secrets, contained side effects
- **quality-bar**: DRY, no `any`, build/lint/typecheck must pass

Commands map to how I work: `/plan`, `/implement`, `/dod`, `/prepare-pr`, `/debug`, `/refactor`, `/cleanup`, `/audit-a11y`, `/deps`.

## How to customize without breaking it

Add project-specific rules. Add commands. Change globs. Do not remove the quality bar, weaken accessibility, or add rules that fight the existing ones. If you are not on Next, replace `nextjs-stack` and keep the rest.

Contentstack Vibe Docs are optional. Add the repo under Cursor Settings → Indexing & Docs if the project actually talks to Contentstack. They are not bundled, because not every repo needs them.

Fork it. Delete what is not yours. Keep the constraints that make the agent trustworthy at speed.
