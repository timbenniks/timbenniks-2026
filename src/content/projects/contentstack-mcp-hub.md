---
title: Contentstack MCP Hub
tag: MCP · Agent skills
description: A hub of agent skills with RBAC, so an agent acting for a user can only reach what that user is allowed to touch, and product managers can propose the next skill without writing it.
meta: Active · Internal + open contributions
order: 6
---

Everyone wants to bolt AI agents onto their product. Few want to do the boring part first: deciding what an agent is actually allowed to do, and for whom. The MCP Hub is my answer to that boring part.

It is a hub of agent skills that respects role based access control. An agent operating on behalf of a user can only reach the skills and data that user is permitted to touch. That single constraint is what turns "cool demo" into "thing you can ship inside an enterprise."

## Skills, not a dump of endpoints

The other half is contribution. Product managers across the Contentstack suite can propose skill ideas without writing the implementation. The people closest to the problem shape what the agents can do. I keep the guardrails; they expand the surface.

That is the same instinct as [Build context-aware MCPs, not API wrappers](/writing/build-context-aware-mcp-not-api-wrappers) and the [MCP Profile Hub](/writing/building-mcp-profile-hub-part-1-stop-making-the-agent-ask) series. A catalog of raw endpoints forces the model to reverse-engineer the tenant. A skill that already knows the content types, environments, locales, and permissions does the work on the first call.

## What "internal" means here

It runs internally today with an open contribution model around it. I am not pretending this is a public npm package you can `npx` tonight. I am saying the design (RBAC first, skills over endpoints, PMs in the loop) is the one I will keep defending in public, because it is the one that survives contact with a real org chart.
