---
title: Developer experience needs a rethink for 2027
slug: developer-experience-needs-a-rethink-for-2027
description: "Coding agents are changing developer experience. SaaS platforms should rethink SDK investments and prioritize APIs, OpenAPI specs, documentation, and agent tooling."
date: "2026-10-29T10:00:00Z"
canonical_url: https://timbenniks.dev/writing/developer-experience-needs-a-rethink-for-2027
reading_time: 8 min read
image: https://res.cloudinary.com/dwfcofnrd/image/upload/v1793263650/website/Developer-dx.png
tags:
  - ai-engineering
  - api-design
  - developer-experience
  - product-strategy
faqs:
  - question: How do coding agents change developer experience?
    answer: "Coding agents increasingly translate a platform's APIs into application code. Developer experience therefore depends more on whether agents can discover capabilities, understand constraints, and produce reliable integrations using accurate specifications and documentation."
  - question: Do coding agents make SDKs unnecessary?
    answer: "SDKs that handle synchronization, caching, cryptography, or runtime-specific behaviour still provide substantial value. Thin HTTP wrappers have a different role when an agent can generate a client tailored to an application's architecture."
  - question: What should developer experience teams prioritize for 2027?
    answer: "Stable APIs, accurate OpenAPI specifications, architectural documentation, agent skills, and carefully designed MCP and CLI interfaces should receive more attention. SDK investment should reflect the functionality each library provides beyond convenience."
  - question: How should companies evaluate agent-driven developer onboarding?
    answer: "Evaluate whether agents can complete realistic integration tasks using public tooling. Assess the resulting code, architectural decisions, errors, and repeated corrections rather than relying only on SDK installations or first API calls."
draft: false
head:
  meta:
    - property: twitter:image
      content: https://res.cloudinary.com/dwfcofnrd/image/upload/v1793263650/website/Developer-dx.png
    - property: twitter:title
      content: Developer experience needs a rethink for 2027
    - property: twitter:description
      content: "Coding agents are changing developer experience. SaaS platforms should rethink SDK investments and prioritize APIs, OpenAPI specs, documentation, and agent tooling."
    - property: keywords
      content: developer-experience, ai-engineering, api-design, product-strategy, SDKs, OpenAPI, MCP, agent skills
---

I've spent a significant part of my career making software platforms easier for developers to use. For a long time, this meant building SDKs, CLIs, framework integrations, documentation, and all the supporting tooling that helps engineers become productive with a new technology. The ambition was always to make the simplest use case feel almost magical, ideally through a single line of code that handled enormous complexity behind the scenes, while providing enough flexibility for developers building sophisticated applications with requirements nobody had anticipated.

Achieving both was surprisingly difficult. An SDK needs sensible defaults without imposing architectural decisions on its consumers, and every convenience abstraction introduces another opportunity to restrict what a developer can accomplish. Then there's the challenge of supporting different languages, runtimes, and frameworks, each with its own conventions, expectations, release schedules, and dependency problems.

For most of my career, I considered this a perfectly reasonable investment. A good SDK makes a platform easier to adopt, provides a familiar interface, and encapsulates functionality that would otherwise have to be implemented repeatedly by customers.

My perspective has changed considerably over the last six months because the way I develop software has changed. I've been building applications, integrations, internal tools, and experiments almost entirely with coding agents, and somewhere along the way I stopped paying much attention to whether a particular service had a pleasant SDK.

I recently realised that I couldn't remember the last time I selected a technology because of the quality of its developer libraries. I still care deeply about whether the underlying platform is reliable and its APIs are well designed, but the interface between those APIs and my application has largely become something my coding agent takes care of.

This is a slightly uncomfortable observation for somebody responsible for developer experience at a SaaS company. 😅

It also raises a question worth considering before planning our investments for 2027. How much of our current developer experience strategy is based on assumptions about how developers write software that may no longer hold?

## The changing role of SDKs

Most developer platforms are designed around a predictable adoption journey. An engineer discovers a service, reads the documentation, chooses a language or framework, installs an SDK, and follows a quickstart until the first successful API call. Over time, they learn the platform's abstractions and build an integration that suits their application.

We've spent years improving every stage of that process, reducing installation steps, making APIs more intuitive, publishing framework-specific examples, and creating increasingly sophisticated libraries to hide the complexity of authentication, pagination, retries, and data transformation.

Much of this work was necessary because developers had to translate the vendor's platform into their own application's architecture. An SDK reduced that effort by offering familiar language constructs and reusable implementations of common operations.

Coding agents are increasingly performing that translation themselves.

When I start a project today, I describe the desired behaviour, architecture, and constraints, and the agent investigates the available libraries, documentation, and API contracts before deciding how to implement the integration. Sometimes it installs the official SDK, sometimes it makes direct HTTP requests, and occasionally it creates an abstraction that fits my application more naturally than the vendor's own library.

I still review the architecture and implementation, particularly where authentication and data integrity are concerned, but I rarely evaluate whether the SDK has an elegant interface. The agent can deal with awkward method names, inconsistent abstractions, and differences between programming languages, provided the underlying behaviour is documented accurately.

There is an important distinction between an SDK's convenience and the functionality it provides. A library handling complicated synchronization, caching, cryptographic operations, or runtime-specific behaviour can deliver enormous value regardless of who writes the application code. A thin wrapper around an HTTP API has a different proposition when an agent can generate an equivalent implementation with very little effort.

I suspect a substantial proportion of SaaS SDKs fall into that second category.

## The economics are changing

Consider a SaaS platform supporting ten programming languages and several popular frontend frameworks. Each SDK requires compatibility work, dependency updates, testing, documentation, release management, and support. New API capabilities need to be exposed consistently, while breaking changes must be managed carefully because customers depend on these packages in production.

Historically, this investment made sense because developers generally preferred an officially maintained library over implementing API interactions themselves. Supporting more languages made the platform accessible to more engineers.

An engineer can now ask an agent to inspect an OpenAPI specification and implement the required operations using the conventions of an existing codebase. The resulting client can expose precisely the capabilities the application needs, avoid unnecessary dependencies, and fit naturally into an architecture the vendor could never have predicted.

I explored this earlier in 2026 when I built an agent skill that generates SDKs from OpenAPI specifications. At the time, I was interested in whether we still needed to distribute prebuilt clients for every programming language. After another nine months of working with agents, the broader implications seem more interesting than the original experiment.

The cost of generating integration code is falling, while the cost of maintaining officially supported libraries across multiple ecosystems remains substantial.

Generated code isn't automatically better, of course. An agent might mishandle authentication, retries, rate limits, or error conditions that an official SDK handles correctly. These are serious concerns, particularly in enterprise environments where integrations survive for years.

Nevertheless, vendors should reconsider which SDKs provide meaningful functionality and which exist primarily because developers historically expected an official package for their preferred language.

## What should we invest in instead?

If coding agents are going to take responsibility for more integration work, they need reliable ways to understand a platform's capabilities, constraints, and intended usage. This makes the quality of APIs and the information surrounding them considerably more important.

An accurate OpenAPI specification should become a foundational product asset, with complete descriptions of operations, authentication, errors, pagination, rate limits, and expected responses. It needs to evolve alongside the API rather than being generated occasionally as a documentation afterthought.

Documentation remains essential, particularly the parts explaining architectural decisions and workflows. An API specification can describe how to create a content type, but it cannot adequately explain the considerations involved in designing a multilingual content model or managing environments.

This is where agent skills become interesting. They allow vendors to package procedural knowledge, implementation guidance, and platform-specific conventions into something an agent can use while performing a task, rather than reconstructing best practices from scattered documentation.

I've spent considerable time working on this type of tooling at Contentstack, alongside MCP and improvements to developer onboarding. One lesson from building MCP Profile Hub was that exposing API operations to agents is relatively straightforward, but helping them understand when and how to use those operations requires substantially more thought.

MCP is useful for agents interacting with live systems, although I don't think every API operation needs to become an MCP tool. Direct API access often makes more sense for application code, while a CLI can provide deterministic, scriptable operations for workflows, validation, and deployment.

These capabilities point towards a developer platform built around stable APIs, trustworthy specifications, useful documentation, agent skills, and carefully designed interfaces for interacting with live systems. SDKs can remain part of that platform without carrying so much of the responsibility for making it usable.

## Developer experience in 2027

Developer onboarding has traditionally been measured through milestones such as completing a quickstart, installing an SDK, or making the first successful API call. These remain useful indicators, but they tell us relatively little about what happens when an engineer delegates the integration to an agent.

An agent might integrate a CMS into an existing Nuxt application, implement live preview, and model content around existing components without the engineer visiting the developer portal or consciously selecting an SDK. The experience depends on whether the agent can discover the correct capabilities, make appropriate architectural decisions, and produce an implementation that works without repeated corrections.

I'd like to see more SaaS companies evaluate whether agents can complete realistic integration tasks using their public tooling, including the quality of the resulting code and the errors encountered along the way.

This shift also has financial implications. If a company has a fixed developer tooling budget, maintaining and expanding every existing SDK and framework integration leaves less capacity for improving API contracts, agent tooling, and automated onboarding.

The right allocation will differ between platforms. Some SDKs encapsulate critical functionality that should remain under vendor control, while others primarily offer convenience methods over straightforward HTTP endpoints. Understanding that difference should influence where developer experience teams invest.

My own priorities have already shifted towards onboarding, MCP tooling, agent skills, and OpenAPI specifications because these are increasingly the interfaces through which my software projects interact with external platforms. Our existing SDKs remain useful, and I have no desire to remove them, but they occupy a considerably smaller part of my thinking than they did even a year ago.

I suspect more engineers will have a similar experience throughout 2027, although the pace will vary between organizations and industries.

For SaaS companies planning their developer strategies, it's worth considering that the next generation of developers may spend much less time interacting directly with the interfaces we've spent years perfecting.

I'd rather invest in making the underlying platform exceptionally understandable, predictable, and safe to integrate than continue expanding abstractions that an increasing number of developers may never consciously use.

And considering how much of my career I've spent making those abstractions delightful, that's a fairly strange conclusion to arrive at.
