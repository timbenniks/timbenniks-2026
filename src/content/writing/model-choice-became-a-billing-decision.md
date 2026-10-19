---
title: Model choice became a billing decision
slug: model-choice-became-a-billing-decision
description: Cursor's $60 Pro+ plan is now a legacy subscription, replaced by a $100 Super plan that bundles Grok and bills Claude, GPT, and Gemini at API rates from the first request. Inference is getting cheaper, but agentic workflows and ecosystem pricing are sending the bill the other way.
date: "2026-10-19T10:00:00Z"
canonical_url: https://timbenniks.dev/writing/model-choice-became-a-billing-decision
reading_time: 5 min read
image: https://res.cloudinary.com/dwfcofnrd/image/upload/v1792435638/website/price.png
tags:
  - ai-engineering
  - developer-experience
  - product-strategy
  - opinion
faqs:
  - question: What happened to Cursor's $60 Pro+ plan?
    answer: Cursor now treats the $60 a month Pro+ plan as a legacy subscription. The replacement is a $100 a month Super plan that bundles Cursor with Grok, Grok Bot, and X Premium under shared billing. That is a 67% increase in the base price, and the included usage allowance for third-party models such as Claude, GPT, and Gemini is gone. Those models are still available, but they are billed separately at raw API prices starting with the first request. Existing customers can keep their legacy subscriptions for now.
  - question: If inference is getting cheaper, why are AI tool bills going up?
    answer: Epoch AI reports that the cost of reaching a fixed level of model performance has dropped about 47% per quarter since 2023, roughly a 13-fold reduction per year. Stanford's AI Index logged a 280-fold drop in the cost of running GPT-3.5 level workloads over two years. The bill is rising because usage changed shape. A single prompt used to be the whole interaction. An agent now explores a codebase, reads documentation, runs commands and tests, fails, and retries, which can mean dozens of tool calls. If a unit of compute falls from $1 to $0.10 but a task consumes 200 units instead of 10, total spend doubles.
  - question: How does included-model pricing change which model developers pick?
    answer: Cursor still lets you use third-party models. What changed is the incentive. When Grok and Composer are covered by the subscription and Claude or GPT add a charge on every prompt, choosing a model becomes a billing decision. Developers reach for the included option because they already paid for it, even when another model fits the task better. The technical flexibility remains, but the economics favor one ecosystem, and that friction works a lot like vendor lock-in.
draft: false
---

I opened Cursor's pricing page today and noticed my $60 a month Pro+ plan had vanished. Not because my account was canceled, but because Cursor now considers it a legacy subscription. Apparently, using AI tools for a couple of years qualifies you as a senior citizen in developer years.

The new $100 a month Super plan replaces it, bundling Cursor with Grok, Grok Bot, and X Premium under a shared billing system. That represents a 67% base price increase. Worse, it strips out the included usage allowance for third-party models like Claude, GPT, and Gemini. Those models remain available, but they are now billed separately at raw API prices from request number one.

You pay $40 more per month, pay extra for the models you actually use, and receive heavier Grok allowances plus X Premium features in return. I am sure the blue checkmark will prove invaluable the next time Claude gets stuck refactoring a TypeScript application.

Existing customers can keep their legacy subscriptions for now. I intend to hold onto mine like a collector's item. But this pricing shift highlights a broader, troubling trend in how AI products are monetized.

## Economic incentives beat technical flexibility

I wrote earlier this year about [Cursor's moat](https://timbenniks.dev/writing/cursors-moat). What made Cursor special was its position inside the developer workflow. It was not a glorified chat window; it was an environment where you wrote code, ran tests, inspected errors, and switched models when one got stuck.

Choice was the feature. Some models excel at architectural planning, others at quick implementation. Being able to swap models inside the editor without rebuilding your context was the primary reason to use Cursor.

To be clear, Cursor is not blocking third-party models. The integration still exists. What changed is the financial incentive.

When Grok and Composer are covered by your subscription allowance, but Claude and GPT add a charge to your credit card on every prompt, model selection stops being an engineering decision. It becomes a billing decision. You reach for the included option because you already paid for it, even if another model is better suited to the job.

Cloud providers have used this strategy for decades. Cursor's technical flexibility remains, but its economics now favor a single ecosystem. Over time, subtle financial friction works just as well as hard vendor lock-in.

## Inference is getting 13x cheaper, so why are bills exploding?

This shift comes with a bizarre economic paradox.

According to research from Epoch AI, the cost of reaching a fixed level of model performance has dropped roughly 47% per quarter since 2023. That is a 13-fold reduction per year. Stanford's AI Index logged a 280-fold drop in running GPT-3.5 level workloads over two years. Inference is getting absurdly cheap.

So why are AI tools getting more expensive?

Because how we consume AI changed. Two years ago, an AI interaction was a single prompt: explain a function, generate a component, fix a typo. The computation was bounded and predictable.

Today, we run autonomous agents. An agent explores a codebase, reads documentation, executes terminal commands, runs tests, fails, and retries. A single task that used to consume one prompt now triggers dozens of tool calls across parallel execution loops.

If a single unit of AI computation drops from $1 to $0.10, but your agentic workflow consumes 200 units of computation to complete a task, your final bill jumps from $10 to $20. The unit cost fell 90%, but your total expenditure doubled.

Cheaper inference makes ambitious, multi-agent workflows practical. Those same workflows consume enough compute to erase the savings.

## The value moves to the plumbing

This shift reveals where the real software value lives. Raw model intelligence is commoditizing. The real value is the surrounding environment: context retrieval, tool integrations, execution infrastructure, and agent reliability.

Model intelligence only carries you so far. I saw this firsthand while testing our [MCP Profile Hub](https://timbenniks.dev/writing/building-mcp-profile-hub-part-3-when-more-reasoning-makes-the-agent-worse) at Contentstack. Giving a model a higher reasoning budget actually made it worse at straightforward tasks. It received correct data from a tool call, distrusted the output, and wasted tokens re-investigating a solved problem. A better tool definition and a deterministic workflow achieved a better result faster and cheaper than extra model reasoning.

Building that surrounding infrastructure requires serious engineering, and companies have every right to charge for it. But that infrastructure also creates heavy lock-in. Once you configure your local agents, build custom instructions, and wire up your services inside a specific tool, moving to another editor becomes painful.

When a platform knows you cannot easily leave, it gains the leverage to structure pricing around its own ecosystem.

## AI pricing is becoming a cloud bill

We are exiting the era of the flat $20 subscription that covers every task. AI pricing is morphing into something that resembles AWS or Cloudflare: a baseline entry fee paired with metered usage for heavy execution.

By 2028, basic code completion and simple queries will likely be free or bundled into local developer tooling. The commercial battleground will center entirely on autonomous agent execution.

The danger is that developers will gradually stop picking the best model for the job and default to whatever fits their prepaid quota.

I have no problem paying for software that makes me faster. But I want to pay for raw utility, not ecosystem tax. I want the freedom to run local models, swap model providers when one drops a better release, and keep my workflow portable.

If inference continues to plummet in price, developer tools should become more open and flexible, not more restrictive. Until then, I am holding onto my legacy $60 Cursor plan. It turns out flexibility is becoming an expensive luxury.
