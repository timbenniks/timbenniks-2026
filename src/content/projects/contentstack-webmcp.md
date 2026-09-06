---
title: Contentstack WebMCP
tag: OSS · WebMCP
description: Framework-agnostic tools that expose published Contentstack content to in-tab agents via document.modelContext. Vanilla TypeScript first, React and Next adapters if you want them.
meta: Experimental · @timbenniks/contentstack-webmcp
order: 5
github: https://github.com/timbenniks/contentstack-webmcp
live: https://contentstack-webmcp.vercel.app
npm: "@timbenniks/contentstack-webmcp"
---

Most Contentstack MCP work assumes the agent lives in Claude Desktop or Cursor and talks to a server. WebMCP is the other direction: the agent is already in the browser tab, on your public site, and it should be able to ask the page for published content without you standing up a second stack.

`@timbenniks/contentstack-webmcp` is a framework-agnostic companion for that. It registers tools on `document.modelContext` per the [WebMCP draft](https://webmachinelearning.github.io/webmcp/). The core is vanilla TypeScript. `/react` and `/next` are thin adapters. Zero React in the default path.

This is not official Contentstack software. It complements `@contentstack/mcp`, which is for external clients and authoring workflows. Use this package when the agent is in the tab and the content is already published.

## Direct mode or same-origin proxy

Default execution is the Delivery SDK in the browser. If you do not want delivery tokens in the page, switch to proxy mode and the same-origin `/api/contentstack/*` handlers in `/server`. Same tools either way. Different place the credentials live.

You get a factory, a CDA client helper, feature detection, and a default tool set for entries and assets. Custom CDA queries and custom tools are first-class. The docs site at [contentstack-webmcp.vercel.app](https://contentstack-webmcp.vercel.app) walks the vanilla, React, and Next paths.

## Why I keep this unofficial

In-tab agents are still an emerging surface. The spec is a draft. Browser support is uneven. I would rather ship a small, honest package that public sites can try than wait for the platform to bless a pattern that visitors are already hitting. Use it knowing it is experimental. File issues when the draft moves and the package should follow.
