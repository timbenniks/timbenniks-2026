---
title: Nuxt Contentstack
tag: OSS · Nuxt module
description: A Nuxt module for Contentstack with typed composables, live preview, visual builder, personalization, and image optimization out of the box.
meta: OSS · nuxt-contentstack on npm
order: 2
github: https://github.com/timbenniks/nuxt-contentstack
docs: https://nuxt-contentstack-docs.vercel.app
npm: nuxt-contentstack
---

Install the module, add your delivery token, and you have a working Contentstack setup in Nuxt. That was the whole goal. Most CMS integrations leave you to wire up the SDK, the preview mode, and the image pipeline by hand, and each of those is a small afternoon of reading docs. This module does it once so you do not have to.

You get typed composables for entries, assets, and lookups by URL, plus a `useContentstack()` helper that hands you the configured SDKs and config. Live Preview and Visual Builder work. Personalization works through server side middleware. Image transforms come through a `useImageTransform` composable and plug into `@nuxt/image` for automatic optimization. It supports Nuxt 4 and Nuxt 3.20.1 and up.

This is the OSS project I get the most direct messages about, which tells me the demand for a good CMS developer experience in Nuxt is real. It is not officially maintained by Contentstack. It is maintained by me, in the open, and support runs through GitHub issues and direct channels.
