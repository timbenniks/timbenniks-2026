---
title: Contentstack Platform SDK
tag: SDK · TypeScript
description: One TypeScript surface for Contentstack (CMA, OAuth, webhooks, image transforms, and generative AI) so you stop stitching four libraries together before you write the actual product.
meta: Active · @timbenniks/contentstack-platform-sdk
order: 2
github: https://github.com/timbenniks/platform-sdk
docs: https://platform-sdk-docs.vercel.app
npm: "@timbenniks/contentstack-platform-sdk"
---

The gap between "I want to build on Contentstack" and "I shipped it" is wider than it should be. You need OAuth. You need the right regional API endpoint. You need the Content Management API. You need to serialize JSON rich text. You need webhooks that do not fall over. And you need all of that before you write a single line of the thing you actually came to build.

The Platform SDK closes that gap. One package, subpath exports, pick the altitude that fits the job.

## What you import

`/server` for middleware, proxy, and webhook handling. `/react` or `/vue` for hooks, composables, providers, and components. Drop down to `/cma`, `/rte`, `/images`, `/regions`, or `/generative-ai` when you need the lower layers. You are not forced into a framework wrapper, and you are not left assembling four unofficial clients by hand.

The repo also ships a CLI scaffold plugin for `csdx` and an installable skill package for AI coding assistants. You can bootstrap a project or hand the SDK to an agent without leaving the terminal.

## Why this still matters when agents write clients

I wrote [Do we still need SDKs in the age of AI agents?](/writing/do-we-still-need-sdks-in-the-age-of-ai-agents) because a well-specified API plus an agent can generate a typed client in seconds. That is true for "call this endpoint." It is less true for "resolve the region, exchange the OAuth code, verify the webhook, transform the image, and keep the RTE round-trip honest."

The value of this SDK is not wrapping HTTP. It is the opinionated glue that every Contentstack app ends up rewriting anyway.

## The honest caveat

This is an experimental project I maintain, not an official Contentstack package. There is no official support beyond reaching out to me. That freedom is the point. It lets me build the developer experience I think the platform deserves and prove it in code before arguing about it in a roadmap.
