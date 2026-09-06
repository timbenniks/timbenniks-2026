---
title: Dex
tag: TUI · Agent orchestration
description: "Local-first AI engineering orchestration for the terminal. Agents write the code. Dex runs the rest of the loop: ticket, worktree, tests, PR, review, and the human gate before merge."
meta: Active · local-first · Bun
order: 9
github: https://github.com/timbenniks/timbenniks-dex
---

Coding agents are good at changing files. They are worse at knowing which ticket to take, whether that ticket is even agent-ready, where the worktree lives, whether CI is red, and whether a human has actually approved the PR.

Dex is not a coding agent. Agents write the code. Dex runs the rest of the loop:

```
Jira task → readiness → worktree → agent → tests → PR → review → fix → human → merge
```

The TUI is the product. The CLI is the same workflow without a TTY.

## State is derived, not a field you set

Dex pulls a Jira-shaped queue, live Jira, or a built-in demo that ships MCP Profile Hub fixtures. It scores tickets for agent-readiness and can enrich thin ones. It creates an isolated worktree and branch per task, launches Claude, Codex, Pi, Cursor Agent, or a stub runtime, records tests as evidence, discovers the PR and review comments, and recommends the next action from that evidence.

If CI is red, the task is fixing. If the gates are green and you have not approved, it is human review. Dex refuses to merge until the configured gates, including human approval bound to the PR head SHA, are green.

## Five minutes without credentials

```bash
dex init --demo --yes --name "MCP Profile Hub"
dex doctor
dex start MCP-482 --runtime stub --yes
```

The stub runtime proves the whole loop without Jira, GitHub, or a harness binary. A real project is `dex init` in the repo, `dex auth jira`, and `dex start`. Config lives in `.dex/`. Tokens never go in project YAML.

I built this because I was tired of being the glue between the ticket, the agent, and the merge button. Dex is that glue, in a terminal, with a human still holding `y`.
