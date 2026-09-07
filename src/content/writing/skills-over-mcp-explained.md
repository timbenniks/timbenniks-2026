---
title: "Skills over MCP explained: how the new extension delivers workflows alongside tools"
slug: skills-over-mcp-explained
description: "How the new MCP Skills Extension works, from skill discovery and on-demand loading to content verification, workflow guidance, and managed profiles."
date: "2026-09-07T10:00:00Z"
canonical_url: https://timbenniks.dev/writing/skills-over-mcp-explained
reading_time: 8 min read
image: https://res.cloudinary.com/dwfcofnrd/image/upload/v1773746407/website/nfs3.png
tags:
  - composable-architecture
  - ai-engineering
  - api-design
  - developer-experience
  - product-strategy
faqs:
  - question: What is Skills over MCP?
    answer: Skills over MCP lets an MCP server distribute workflow instructions alongside its tools. Tools perform operations, while skills use SKILL.md files and supporting resources to explain how an agent should combine those operations to complete a task.
  - question: How does an agent discover and load MCP skills?
    answer: A supporting server declares the Skills Extension during initialization. The client discovers skill entries through skills/list or retrieves one entry by URI through skills/get. It then loads SKILL.md and supporting files on demand through resources/read. A listed entry already contains its metadata and manifest, so skills/get is not required after every listing.
  - question: How are remotely supplied skills verified?
    answer: Static skills include a manifest of file URIs, sizes, and SHA-256 digests. Hosts verify retrieved files against that manifest and bind persisted approval to its resource set. Changes invalidate that approval. Verification checks content integrity, not whether the instructions are safe or correct. Dynamically generated skills may declare themselves unverifiable, and hosts may refuse them.
  - question: Is SEP-2640 finalized and supported by every MCP client?
    answer: As of September 7, 2026, the core maintainers have accepted SEP-2640, but work toward final status remains. Acceptance was confirmed on September 3. Existing implementations use different discovery mechanisms, so compatibility must be checked for the server and host being used.
  - question: Do MCP skills replace deterministic workflows or grant permissions?
    answer: Skills guide an agent's decisions and can recommend an existing Automation when a process has a fixed execution path. They do not establish connections or grant platform permissions. The host still needs the relevant capabilities, and each service must authorize its operations.
draft: false
head:
  meta:
    - property: twitter:image
      content: https://res.cloudinary.com/dwfcofnrd/image/upload/v1773746407/website/nfs3.png
    - property: twitter:title
      content: "Skills over MCP explained: how the new extension delivers workflows alongside tools"
    - property: twitter:description
      content: "How the new MCP Skills Extension works, from skill discovery and on-demand loading to content verification, workflow guidance, and managed profiles."
    - property: keywords
      content: composable-architecture, ai-engineering, api-design, developer-experience, product-strategy
---

I have been writing about giving agents better tools. Tools that understand the account they connect to, expose the right capabilities, and arrive in a profile somebody can actually review.

There is another piece to this. An agent can have the correct tools and still have very little idea how your platform expects them to be used together.

Imagine asking an agent to build a localized product catalog. It can create content types, add entries, configure locales, and publish content. Every individual operation works.

It still needs to decide how to model the references, which fields should be localized, and what needs to exist before anything gets published. You have given it access to the platform and left it to reconstruct the implementation guide.

Skills over MCP gives that guide a place alongside the tools.

The MCP working group describes the idea as “ship the manual with the product.” That seems like a fairly sensible thing for a software platform to do. [Skills Over MCP working group](https://github.com/modelcontextprotocol/ext-skills)

## Tool descriptions have a limit

A tool description should explain an operation clearly enough for an agent to choose it and supply valid arguments. That already takes care.

Trying to squeeze an entire migration strategy into the same description creates a different problem. The instructions become enormous, several tools repeat the same advice, and the model receives workflow knowledge before it knows whether the task needs it.

The working group identifies this gap explicitly. Complex workflows need conditional instructions and supporting material that exceed what belongs in individual tool descriptions or initialization instructions. [Problem statement](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/problem-statement.md)

A skill gives that knowledge its own home. The familiar `SKILL.md` format contains instructions, with supporting files available when needed.

For the product catalog example, I would want a skill to start by inspecting the existing model. It should explain when to reuse a content type, how to handle references, and where the team needs to make a decision about localization.

The tools still perform the operations. The skill helps the agent work out which operations belong together.

That separation also gives you somewhere sensible to maintain the advice. If the recommended modeling approach changes, you should be able to update one workflow instead of hunting through twenty tool descriptions.

## How discovery and loading work

[SEP-2640](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640) defines the Skills Extension. A supporting server declares the extension during initialization.

The basic flow uses these methods:

| Method           | Purpose                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `skills/list`    | Discover skill entries, including metadata and resource manifests.    |
| `skills/get`     | Retrieve one entry by URI, including a skill absent from the listing. |
| `resources/read` | Read `SKILL.md` or a supporting file when needed.                     |

A listed entry already contains its metadata and manifest. Calling `skills/get` after every listing is unnecessary; it is useful for direct lookup or refreshing one entry.

The files remain MCP resources. `skill://` is the conventional URI scheme, although the extension permits other schemes. An optional `resources/directory/read` method supports directory navigation. [Skills Extension specification](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/refs/heads/sep/skills-extension/seps/2640-skills-extension.md)

For a CMS, the conceptual arrangement could look like this:

```text
CMS MCP server
├── Tools
│   ├── Inspect content models
│   ├── Create entries
│   └── Publish content
└── Skills
    ├── Model a product catalog
    ├── Configure localization
    └── Plan a content migration
```

These are illustrative capabilities, but the packaging is the interesting part. Connecting to the service could make its implementation knowledge discoverable through the same connection.

The host can show the model the available skills and load the relevant instructions when the work calls for them. It does not need to put the entire vendor documentation into every conversation.

## Central updates still need review

This would make distribution considerably more pleasant.

Today, a team might configure an MCP server, find a separate skills repository, install the relevant directories, and remember to update them later. Each step is manageable. Keeping all of them aligned across a team takes more effort.

Serving skills through MCP gives the provider a central place to maintain them. It also introduces a fairly obvious question: what happens when the instructions change after somebody approves them?

For static skills, the extension uses a manifest containing each file’s URI, size, and SHA-256 digest. Hosts verify retrieved content against that manifest. Persisted approval is bound to the resource set, so a changed set invalidates that approval. Dynamically generated skills can declare themselves unverifiable, and hosts may refuse them. [Skills Extension specification](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/refs/heads/sep/skills-extension/seps/2640-skills-extension.md)

A matching digest establishes that the bytes match the advertised content. It says nothing about whether the advice is good.

A perfectly verified instruction can still tell an agent to do something stupid. The working group’s threat model treats malicious instructions and unsafe execution as separate concerns from content integrity. [Threat model](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/threat-model.md)

I would want centrally maintained skills, but I would also want a team to understand which version it reviewed and when that version changed. Otherwise, updating documentation becomes an indirect way to change agent behavior without anybody noticing.

## A workflow can involve several servers

A useful workflow often crosses product boundaries. The working group includes multi-server orchestration among the reasons for this work. [Skills Over MCP use cases](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/use-cases.md)

Consider a content migration. The requirements might live in Jira, the content in a CMS, and the rendering code in GitHub. A skill could explain how those pieces fit together and what the agent should check before moving between them.

That does not establish the connections or grant access to those systems. The host still needs the relevant capabilities, and each service still needs to authorize the operation.

This is also where I would be careful about treating a skill as a workflow engine.

If a publishing process has fifteen fixed steps with known inputs and error handling, I would keep that process in an Automation and expose it as a tool. Asking a model to reproduce the sequence from prose creates more opportunities for variation.

A skill is useful when the agent needs guidance while making decisions. It can also tell the agent when an existing Automation is the appropriate tool to call.

That is a useful combination for enterprise software. Some work requires judgment. Some work already has a reviewed execution path.

## What this could mean for Contentstack's MCP Profile Hub

In my recent articles about MCP Profile Hub, I described profiles shaped around jobs. An editor, release manager, and governance specialist should receive tools relevant to their work.

Skills could extend that same idea to the instructions accompanying those tools.

A localization profile might expose tools for inspecting locales and updating entries, alongside guidance for handling missing translations. A migration profile could include modeling tools and a skill explaining how to inspect the source content before proposing a target structure.

This is a possible extension to the architecture. I am describing where the pattern could go.

The review becomes more useful because somebody can inspect both the available operations and the guidance influencing how the agent uses them. A profile that exposes publishing tools deserves particular attention if its accompanying skill recommends publishing automatically after every edit.

The skill also needs to fit the profile. Shipping migration instructions that require tools the profile deliberately excludes would send the agent straight back into a discovery problem.

I would treat those dependencies as part of the profile’s design. Curating the tools and writing the workflow separately only works if somebody checks that they still agree.

## Accepted does not mean universally supported

There is a status change worth getting right. On September 3, 2026, the proposal’s author confirmed that the core maintainers had accepted SEP-2640. The remaining work toward final status includes a reference implementation, conformance tests, and specification documentation. [Acceptance update](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640)

Existing implementations also need a closer look before assuming compatibility.

Microsoft Agent Framework already documents experimental MCP-based skills. Its documentation currently describes discovery through `skill://index.json`, followed by loading skill content on demand. That differs from the `skills/list` and `skills/get` interface described above. [Microsoft Agent Framework documentation](https://learn.microsoft.com/en-us/agent-framework/agents/skills)

Supporting “skills over MCP” therefore does not yet tell you enough. You need to check the discovery mechanism and the behavior of the host you intend to use.

Archive delivery was removed from the v1 scope. That should not be interpreted as a guarantee that remote instructions cannot cause local execution; the threat model explicitly considers that risk. [Scope decisions](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/decisions.md), [threat model](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/threat-model.md)

Those details will decide whether an integration works outside its own demo.

## Vendors have some documentation work to do

The part I find most useful is the responsibility this gives the platform provider.

A CMS vendor should be able to explain its own reference handling and publishing behavior. It should maintain those instructions when the product changes, and make them available where the agent is already working.

The customer still supplies its own rules. The vendor cannot know who approves a campaign or whether a particular team permits automatic publishing. Product knowledge and company policy both need to reach the agent.

For the Contentstack work, I can see a practical connection between AI Skills, Developer Hub, and MCP Profile Hub. The skills describe the implementation approach. The developer tooling supplies access to the platform. Profiles select the capabilities and guidance appropriate to the job.

I would start with one workflow and test it against real tasks. Can the agent discover the skill, load the relevant guidance, and complete the work using the tools in its profile? Does it recognize the decisions it needs to hand back to a person?

Shipping the manual with the product is useful when the manual helps somebody finish the job. Agents should be held to that same fairly ordinary standard.
