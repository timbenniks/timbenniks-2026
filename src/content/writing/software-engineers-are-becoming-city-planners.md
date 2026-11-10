---
title: Software engineers are becoming city planners
slug: software-engineers-are-becoming-city-planners
description: AI agents make implementation faster, exposing bottlenecks in architecture, developer experience and review. I explore why engineering must plan the environment around the code.
date: "2026-11-09T10:00:00Z"
reading_time: 5 min read
image: https://res.cloudinary.com/dwfcofnrd/image/upload/v1794298462/website/qnn6xiu9aowaar3shw28.png
tags: [performance, developer-experience, ai-engineering, craft, opinion]
canonical_url: https://timbenniks.dev/writing/software-engineers-are-becoming-city-planners
faqs:
  - question: Why does faster AI-generated implementation make engineering environments more important?
    answer: As implementation gets cheaper, the surrounding architecture, tests, documentation and workflows determine how reliably changes integrate and reach production.
  - question: How do inconsistent codebase conventions affect AI agents?
    answer: Agents infer patterns from code and documentation. When those sources conflict, agents can reproduce inconsistencies or revive approaches the team has moved away from.
  - question: What engineering work becomes more valuable as agents write more code?
    answer: Improving shared patterns, tests, documentation, validation and development environments benefits every task that passes through them, not just one implementation.
  - question: What should teams measure beyond pull request volume and autonomous completion?
    answer: Track how quickly meaningful functionality reaches production, how often changes cause regressions and whether the architecture is becoming easier or harder to evolve.
  - question: Should every software review step be automated?
    answer: No. Security and critical infrastructure changes may still need careful human judgement, and engineers need enough technical understanding to evaluate generated code and diagnose failures.
---

For most of the history of software engineering, the expensive part of building software was writing it. Languages, frameworks, IDEs and delivery processes all improved with the aim of reducing that effort, and the way we organise teams and measure their output still assumes that implementation takes a lot of human time. AI agents are starting to undermine that assumption. They can already investigate an unfamiliar codebase, implement a feature and prepare a pull request with limited supervision, and although their output still needs verification, the cost of producing an implementation is falling quickly. As it falls, the constraints elsewhere in the development process become much easier to see.

I have been thinking about this through our work at Contentstack, where we have been building an AI-powered software development lifecycle, or AI SDLC factory, in which agents, automation and engineering processes are connected across the lifecycle. Working with that setup has shifted my view of where engineering effort matters. When more of the implementation is automated, the quality of the environment surrounding that work starts to determine how well an organisation delivers software, and the comparison I find most useful for describing this is city planning.

## A city where construction is cheap

Imagine a city in which a building can be constructed in minutes rather than months. Development would accelerate dramatically, but every new building would still depend on roads, utilities and public services, the grid would still have finite capacity, and infrastructure decisions made decades earlier would remain hard to change. Without coordination, the city could end up with thousands of well-built buildings that together produce unreliable transport, overloaded utilities and an environment in which further development becomes harder rather than easier. The planners in such a city would matter more than ever, because faster construction would make the consequences of poor planning visible much sooner.

Software development is moving into a similar situation. An agent can implement a feature quickly, but the result still has to integrate with existing services, follow architectural conventions, satisfy security requirements and remain understandable to the next person who has to change it.

## What agents learn from the codebase

In the terms of the analogy, agents supply construction capacity, the development platform supplies the infrastructure, and architectural conventions and automated checks play the role of building codes and inspections. This relationship becomes most visible in mature systems that have accumulated inconsistencies over time. A codebase may contain several approaches to the same problem because different teams made different decisions over the years. An experienced engineer usually knows which approach reflects the current direction, whereas an agent has to infer it from whatever examples and documentation it encounters, and when those are inconsistent it tends to reproduce the inconsistency.

The same applies to unreliable tests, slow CI pipelines, undocumented dependencies and development environments that need manual intervention. Engineers compensate for these through experience and conversations with colleagues, but agents have little access to that institutional knowledge, so problems a person would quietly work around can lead an agent into repeated failures or implementations that follow patterns the team abandoned long ago.

This has changed how I think about developer experience. Improving a test suite or making documentation easier to find used to benefit a limited number of engineers, but when much of the implementation is automated, the same improvement affects every subsequent task that runs through the environment. The value of platform and developer experience work grows with the volume of work passing through it.

## Processes designed for human-paced implementation

Ticket workflows, architecture reviews, branch policies and release processes exist for good reasons, but they were designed around the assumption that producing a change takes considerably longer than reviewing it. When an agent can prepare an implementation in minutes, a pull request may still spend days in an approval process sized for several days of human work. Adding more agents then mostly lengthens the queue in front of the same bottleneck, leaving an organisation with a great deal of implementation capacity and little improvement in how quickly changes reach production.

Some of that friction is justified, especially for changes that affect security or critical infrastructure. A good deal of it, however, comes from relying on human reviewers to enforce conventions that could be checked automatically. Architectural boundaries, API compatibility, security policies and performance constraints can often be validated within the workflow, giving agents useful feedback before a change reaches a person. Cities manage large-scale construction in much the same way, through building codes and predictable inspections that tell builders in advance what is required. My view is that in an AI SDLC factory the governed path should also be the easiest one to follow, so that people and agents can produce acceptable changes without relying on undocumented knowledge, and reviewers can concentrate on decisions where context and accountability genuinely matter.

## How existing technical debt scales

Greater implementation capacity also magnifies decisions already embedded in a codebase. Mature systems carry abstractions that have outlived their purpose, conventions that diverged between teams and workarounds that remain because nobody had a reason to remove them. Experienced developers learn which of these to avoid, but agents treat them as context for new code, so an outdated abstraction can become the template for new work and spread technical debt into areas that were previously clean. Routine maintenance, such as consolidating patterns, improving tests and removing obsolete code, therefore has a direct effect on the quality of future development.

It also changes what is worth measuring. Pull request volume and the share of work completed autonomously say something about throughput, but little about whether the software is reliable or maintainable. I would rather know how quickly meaningful functionality reaches production, how often changes introduce regressions and whether the architecture is becoming easier or harder to evolve, in the same way that a city's health depends less on how many buildings it adds each year than on whether its infrastructure can keep up.

## The limits of the analogy

None of this means engineers are stepping away from implementation. Understanding how software behaves remains essential for evaluating generated code, defining useful constraints and diagnosing failures that automated tools cannot resolve, and a planner without that understanding would make poor decisions about the city. Nor should every review step be automated, since some changes carry enough risk that careful human judgement remains the right approach. Investment in the development environment is also less visible than shipping features, and organisations tend to postpone work whose benefits are indirect, which is a real obstacle to everything described here.

## Concluding

What I expect to change is where engineering expertise has the most impact. An experienced engineer can spend an afternoon improving a single implementation, or spend it simplifying a shared pattern or improving validation across the codebase, and as automated implementation grows, the second kind of work influences far more of what follows. That brings developer experience, platform engineering, architecture and product delivery closer together, because the quality of the development environment shapes the software produced within it.

I suspect the organisations that make the best use of AI will be the ones that invest as deliberately in their development environments as they do in their agents. Better models will keep expanding what can be built, but the surrounding architecture and engineering practices will determine how reliably that capability turns into production software, and as construction becomes faster and cheaper, I expect the work of planning the city to make up a much larger part of software engineering.