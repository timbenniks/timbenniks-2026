---
title: I thought everyone was building tools for themselves
slug: i-thought-everyone-was-building-tools-for-themselves
description: At ContentCon, I realised building tools for yourself still feels unfamiliar to many developers. Coding agents help, but finding a starting point matters too.
date: "2026-10-05T10:00:00Z"
canonical_url: https://timbenniks.dev/writing/i-thought-everyone-was-building-tools-for-themselves
reading_time: 3 min read
image: https://res.cloudinary.com/dwfcofnrd/image/upload/v1791188409/website/Building_Useful_Tools_Together.png
tags:
  - ai-engineering
  - craft
  - developer-experience
  - devrel
draft: false
---

At ContentCon, I ran a developer labs session where I presented [AgentLint](https://agentlint.timbenniks.dev/), a tool I built to check whether an AI agent can actually use a website. It collects evidence from the site, gives the agent bounded tasks to reason through, and produces a fix prompt a coding agent can work with.

I thought the interesting conversation would be about how it worked. What surprised me was how few folks seemed to be building tools like this for themselves at all.

There was plenty of interest. People wanted to learn and build. Yet something I had come to consider fairly ordinary still seemed unfamiliar: noticing a problem in your own work and making a small piece of software to deal with it.

I've been doing this for months, pretty much every day. Somewhere along the way, I started assuming everyone else was doing it too. Spending enough time with your coding agents apparently gives you a slightly distorted view of the world. Who knew.

## The annoying thing can be a project

AgentLint deals with a question I care about: can an agent do something useful with this website, and what evidence supports that answer? Having a tool to investigate it is useful to me. That is already a good enough reason for the tool to exist.

A lot of the things I build have that same small justification. I want something to work differently. I can describe the problem, work through it with an agent, and get far enough to try a solution. Sometimes it takes more fiddling than the original annoyance probably deserved. I'm an engineer. We have a proud history of this.

But after doing it a few times, you start noticing opportunities you previously walked straight past. The awkward task you repeat every week becomes something you might be able to fix. You start thinking about what the tool would need to do before you start looking for somebody selling it.

That habit is what I had taken for granted at ContentCon.

## Wanting to learn doesn't tell you where to start

I think there is a growing appetite to build something that fits your own work. Folks want to get their hands on the tools and see what they can make. But an appetite doesn't come with a project brief.

For years, we've learned to work around software. Find the closest feature, adjust your process, request an improvement, wait. Even developers spend much of their day building things somebody else has prioritised. Turning an irritation into a personal project requires a different decision, and having access to a coding agent doesn't automatically make you take it.

I also have to be honest about what feels easy to me. I have years of engineering experience and months of practice working this way. I know roughly how small to make the first attempt, and I can usually investigate when it breaks. Someone watching the demo sees the working tool. They don't necessarily see all the decisions that got it there.

Maybe I need to spend more time showing those decisions.

## A lab should leave you with your own idea

The session made me think differently about what I want people to take home. Understanding AgentLint is useful. Leaving with an idea for a tool that would help with their own work would be better.

That probably means starting with a more ordinary question than what AI can build. What did you do this week that was unnecessarily awkward? Could a small tool make it easier? What would the first useful version need to do?

I still think we're going to see more people building software for themselves. The hunger is there. I'm less convinced that showing them what is possible is enough.

Next time, I'd like folks to leave the lab knowing which annoying thing they're going to try fixing first.
