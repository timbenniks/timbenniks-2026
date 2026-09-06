---
title: Nuxt Contentstack
tag: OSS · Nuxt module
description: "The Nuxt module I wish Contentstack shipped: typed composables, live preview, visual builder, personalization, and image optimization in one install."
meta: OSS · nuxt-contentstack on npm
order: 3
github: https://github.com/timbenniks/nuxt-contentstack
docs: https://nuxt-contentstack-docs.vercel.app
npm: nuxt-contentstack
---

Install the module, add your delivery token, and you have a working Contentstack setup in Nuxt. That was the whole goal. Most CMS integrations leave you to wire up the SDK, the preview mode, and the image pipeline by hand. Each of those is a small afternoon of reading docs. This module does it once so you do not have to.

This is the OSS project I get the most direct messages about. The demand for a good CMS developer experience in Nuxt is real.

## What you get after one config block

Typed composables for a single entry, a list of entries, a lookup by URL, and assets. Filtering, pagination, sorting, and a `where` clause that understands comparison, existence, and regex operators. A `useContentstack()` helper that hands you the Delivery SDK, Live Preview utils, and the Personalize SDK with types attached.

Live Preview and Visual Builder work. Personalization runs through server-side middleware so variant resolution and cookies are not a client-side afterthought. Image transforms come through `useImageTransform` and plug into `@nuxt/image`. List `nuxt-contentstack` before `@nuxt/image` and the Contentstack provider registers itself.

There is a `ContentstackModularBlocks` component for mapping block types to Vue components, with auto-fetch or pre-fetched blocks, fallback rendering, and optional SEO metadata from the entry. It supports Nuxt 4 and Nuxt 3.20.1 and up.

## How I use it

`nuxi module add nuxt-contentstack`, three required keys in `nuxt.config`, and I am fetching pages by URL. The playground on StackBlitz is there if you want to poke it before cloning.

Support runs through GitHub issues and direct channels. It is not officially maintained by Contentstack. It is maintained by me, in the open.
