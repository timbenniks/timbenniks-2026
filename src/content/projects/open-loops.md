---
title: Open Loops
tag: macOS app · MCP
description: A local-first macOS tracker for work you hand to coding agents. SQLite on your machine, git-aware tasks, and a full backlog API over MCP.
meta: Open source · macOS · MIT
order: 7
github: https://github.com/timbenniks/open-loops
---

Todo apps were not built for the way I work now. I hand tasks to Cursor and Claude Code, they open branches, push commits, and open PRs, and my tracker has no idea any of that happened. Open Loops puts the backlog somewhere the agents can read and write.

It is a native-feeling macOS app backed by a local SQLite database. No account. Nothing leaves your machine. You capture loose ideas on Home, organize them into projects and milestones, and drop into work mode when you need room to think.

## The parts that are not a todo app

Every task can link to a repo and track its branches, commits, and PRs. Home surfaces what needs a human: PRs waiting on merge, blockers, unassigned captures, and stale work that has gone quiet. There is a cards view, a table, a kanban, and an activity timeline of agent runs.

Work mode (`⌘⇧↵`) is the layout I actually use: a task rail, a workspace for notes and subtasks, and a sidebar for git work and in-app agent runs. Claude Code, Codex, and Cursor all share the same task prompt, the same linked repo, and the Open Loops MCP tools. The transcript stays in the Agent tab.

## The MCP server is the product test

The MCP server exposes the full task and project API over stdio. An agent can pick up the next task, mark it in progress, start git work, write a completion summary when it closes, and leave a blocker note when it gets stuck.

I am using that server in sessions that write pages on this site. That is the honest test for a tool like this. If I do not keep it open, it failed.
