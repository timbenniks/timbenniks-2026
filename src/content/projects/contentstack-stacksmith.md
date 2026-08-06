---
title: Contentstack Stacksmith
tag: OSS · Models as code
description: TypeScript-first Contentstack content models, with tooling to import, compile, diff, document, type-generate, and safely promote them.
meta: OSS · @timbenniks/contentstack-stacksmith
order: 3
github: https://github.com/timbenniks/contentstack-stacksmith
docs: https://contentstack-stacksmith-docs-g1gh.vercel.app
npm: "@timbenniks/contentstack-stacksmith"
---

Content models drift. You build them in the UI, someone tweaks a field in production, and three environments later nobody knows what the source of truth is. Stacksmith answers that by treating your content types and global fields as TypeScript you commit to a repo.

The workflow is a pipeline. You either author models in TypeScript or import them from a live stack, they compile to a normalized schema artifact with stable IDs and dependency metadata, and from there you diff, plan, document, apply, and promote. The plan output is human readable, so you see exactly what will change before it touches a stack. Apply is safe by default and only makes additive, low risk changes unless you say otherwise.

It ships as two published pieces: the `@timbenniks/contentstack-stacksmith` authoring package and a `csdx` CLI plugin that runs the import, build, diff, docs, apply, promote, and type-generation commands. An import followed by an apply writes back exactly what it read, down to field level flags, text constraints, date ranges, advanced enum choices, and file extension allowlists.

This is the project I reach for when I want content modeling to feel like software instead of clicking through forms and hoping.
