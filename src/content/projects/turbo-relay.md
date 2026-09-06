---
title: Turbo Relay
tag: MCP · Local-first
description: A local-first intelligence layer for sanctioned AI agents. Agents write evidence-backed knowledge through MCP; humans review, approve, and promote it.
meta: Open source · macOS · MCP
order: 8
github: https://github.com/timbenniks/turbo-relay
---

Agents are getting good at producing knowledge: findings, decisions, insights, proposals. The problem is trust. When a fleet of agents writes into a shared memory unchecked, you end up with a pile of confident, unverified claims. Turbo Relay puts a human review step between the agent and the record of truth.

Approved agents (Claude, Codex, Cursor, or an internal agent) write structured, evidence-backed knowledge objects through an MCP server. Those objects land in a desktop review inbox. A human approves, promotes, and exports them from there. Turbo Relay is not the agent. It is the place you decide what the agents were allowed to remember.

## How the objects land

Signals, insights, proposals, decisions, artifacts. Agents can link evidence, start and complete runs, and attach a timeline. Humans search memory, inspect an object, see what it relates to, and look at workstream rollups. Nothing becomes canon because a model said it with confidence.

It is local-first and ships as a prebuilt macOS app, so you do not need Node or a package manager to run it. Optional features like export and integrations ship as modules. An agent can build a new module from the starter prompt in the repo.

## Why I built an editor for agent memory

The more capable agents get, the more their memory needs an editor. I would rather have that editor before the pile of unverified claims becomes the default architecture. Turbo Relay is that attempt, running on my machine, with a human still holding the promote button.
