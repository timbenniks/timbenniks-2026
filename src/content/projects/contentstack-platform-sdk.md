---
title: Contentstack Platform SDK
tag: SDK · TypeScript
description: A unified TypeScript monorepo consolidating CMA, OAuth, webhooks, image transforms, and AI content generation into one coherent surface.
meta: Active · @timbenniks/contentstack-platform-sdk
order: 1
github: https://github.com/timbenniks/platform-sdk
docs: https://platform-sdk-docs.vercel.app
npm: "@timbenniks/contentstack-platform-sdk"
---

The gap between "I want to build on Contentstack" and "I shipped it" is wider than it should be. You need OAuth, you need to resolve the right regional API endpoint, you need the Content Management API, you need to serialize JSON rich text, and you need to wire all of that together before you write a single line of your actual product. The Platform SDK closes that gap.

It is one package with subpath exports. Import `/server` for middleware, proxy, and webhook handling. Import `/react` or `/vue` for hooks, composables, providers, and components. The lower layers (`/cma`, `/rte`, `/images`, `/regions`, `/generative-ai`) are there when you need to drop down. You pick the altitude that fits the job instead of stitching four libraries together yourself.

The repo also ships a CLI scaffold plugin for `csdx` and an installable skill package for AI coding assistants, so you can bootstrap a project or hand the SDK to an agent without leaving your terminal.

One honest caveat: this is an experimental project I maintain, not an official Contentstack package. There is no official support beyond reaching out to me. That freedom is the point. It lets me build the developer experience I think the platform deserves and prove it in code before arguing about it in a roadmap.
