---
title: Contentstack Stacksmith
tag: OSS · Models as code
description: Content types as TypeScript you can import, compile, diff, document, type-generate, and safely promote, so the UI is no longer the source of truth.
meta: OSS · @timbenniks/contentstack-stacksmith
order: 4
github: https://github.com/timbenniks/contentstack-stacksmith
docs: https://contentstack-stacksmith-docs-g1gh.vercel.app
npm: "@timbenniks/contentstack-stacksmith"
---

Content models drift. You build them in the UI, someone tweaks a field in production, and three environments later nobody knows what the source of truth is. Stacksmith answers that by treating content types and global fields as TypeScript you commit to a repo.

The workflow is a pipeline: author in TypeScript or import from a live stack, compile to a normalized schema artifact with stable IDs and dependency metadata, then diff, plan, document, apply, and promote. The plan output is human readable. You see exactly what will change before it touches a stack.

## The pipeline

`@timbenniks/contentstack-stacksmith` is the authoring package. `@timbenniks/contentstack-stacksmith-cli` is the `csdx` plugin that runs the commands. Lower-level packages stay internal.

An import followed by an apply writes back exactly what it read: field-level flags, text constraints, date ranges, advanced enum choices, file extension allowlists, JSON RTE plugins, taxonomy terms, modular blocks, custom field extensions, and content-type field rules. That round-trip is the whole product test.

Apply is safe by default. It will create types, add fields, and make low-risk metadata updates. It will not delete types, remove fields, add required fields, change field kinds, or tighten validations in risky ways unless you take it out of that lane. If an apply fails partway through, it writes state and resumes instead of guessing.

`stacksmith:audit-org` exists because I got tired of hitting mid-apply CMA errors for plan limits. It tells you whether taxonomy is even enabled and whether the import will fit the stack's headroom.

## Treat the DSL like source code

Model files are executable TypeScript. They can import packages, read files, and make network calls. Do not run apply against a model file you would not code-review. Commit them, review them on PRs, and keep them under the same scrutiny as backend source.

This is the project I reach for when I want content modeling to feel like software instead of clicking through forms and hoping.
