---
title: Turbo Relay
tag: MCP · Local-first
description: A local-first intelligence layer for sanctioned AI agents. Agents write evidence-backed knowledge through MCP; humans review, approve, and promote it.
meta: Open source · macOS · MCP
order: 6
github: https://github.com/timbenniks/turbo-relay
---

Agents are getting good at producing knowledge: findings, decisions, insights, proposals. The problem is trust. When a fleet of agents writes into a shared memory unchecked, you end up with a pile of confident, unverified claims. Turbo Relay puts a human review step between the agent and the record of truth.

Approved agents such as Claude, Codex, Cursor, or an internal agent write structured, evidence-backed knowledge objects through an MCP server. Those objects land in a desktop review inbox. A human approves, promotes, and exports them from there. Turbo Relay is not the agent. It is the place you decide what the agents were allowed to remember.

It is local-first and ships as a prebuilt macOS app, so you do not need Node or a package manager to run it. Optional features like export and integrations ship as modules, and an agent can build a new module from the starter prompt in the repo.

This one comes from a real worry. The more capable agents get, the more their memory needs an editor. Turbo Relay is my attempt to build that editor before the pile of unverified claims becomes the norm.
