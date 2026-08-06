---
title: Open Loops
tag: macOS app · MCP
description: A native-feeling macOS project tracker for developers who work with AI coding agents. Local-first, git-aware, and readable by agents over MCP.
meta: Open source · macOS · MIT
order: 5
github: https://github.com/timbenniks/open-loops
---

Todo apps were not built for the way I work now. I hand tasks to Cursor and Claude Code, they open branches, push commits, and open PRs, and my tracker has no idea any of that happened. Open Loops fixes the disconnect by putting the backlog somewhere the agents can read and write.

It is a native macOS app backed by a local SQLite database, so there is no account and nothing leaves your machine. You capture loose ideas on the Home view, organize them into projects and milestones, and drop into a focused work mode when you need room to think. Every task can link to a repo and track its branches, commits, and PRs.

The part I care about most is the MCP server. It exposes the full task and project API over stdio, so an agent can pick up the next task, mark it in progress, write a completion summary when it closes, and leave a blocker note when it gets stuck. The Home view then surfaces what needs a human: PRs waiting on merge, blockers, unassigned captures, and stale work that has gone quiet.

I am using its MCP server right now, in the session that wrote this page. That is the honest test for a tool like this. If I do not keep it open, it failed.
