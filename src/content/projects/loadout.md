---
title: Loadout
tag: macOS app · Skills
description: A native macOS control plane for Skills and MCP servers across Claude Code, Codex, and Cursor. It does not own your loadout. It shows you what is actually installed.
meta: Early · macOS 15 · Swift
order: 10
github: https://github.com/timbenniks/loadout
---

Every coding agent wants you to manage Skills and MCP servers in a slightly different folder, with a slightly different config file, and a slightly different idea of what "installed" means. Loadout is a native macOS app for looking at that mess in one place.

It is a control plane, not another ecosystem. Underlying tools and configuration remain the source of truth. Loadout reads them, shows the differences between Claude Code, Codex, and Cursor, and refuses to pretend those three are the same product.

## Architectural commandments I will not break

Loadout does not own your loadout. Prefer the native CLI if the ecosystem already has a command. Do not recreate package management: Skills belong to `skills`. Do not invent MCP configuration: that belongs to the harness. Read before writing. Preserve what you do not understand. Treat Terminal edits as normal. Persist convenience, not truth. Stay small.

Those rules exist because I have watched "helpful" apps rewrite `mcp.json` and take a Saturday with them.

## Status, said plainly

Phase 0 is done: app shell, models, and core services. Phase 1 is harness detection. You need macOS 15 and Xcode 16. This is early, and I am keeping it on the workbench because the problem is already real even if the UI is not finished. If you want a polished skills manager tomorrow, this is not it yet. If you want a Mac app that is honest about three incompatible harnesses, this is the start.
