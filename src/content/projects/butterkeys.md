---
title: ButterKeys
tag: macOS app · Local-first
description: A menu bar app that fixes the typos your hands already know how to make (teh, writign, int he) on the machine, with no account and no network.
meta: macOS 14 · local-first
order: 11
github: https://github.com/timbenniks/butterkeys
live: https://butterkeys.vercel.app
---

I do not need a cloud spellchecker. I need something that knows I type `teh` and `writign` and `int he` because my fingers have been doing that for twenty years.

ButterKeys is a local-first macOS menu bar app for those motor-pattern slips. Everything runs on your Mac. No accounts, no analytics, no network required for correction. The rolling typing buffer lives in memory and is never persisted. It does not store full sentences, raw keystroke logs, passwords, or clipboard contents.

## Taught only, unless you ask

The default confidence policy is **Taught only**: explicit rules you add. Speculative pattern strategies (adjacent transposition, nearby-key substitution, `gn`/`ng`, early space, extra or missing characters) stay off until you turn them on. The principle is simple: when taught or confident, smooth it. When uncertain, leave it alone.

Teach a personal typo with **⌃⌥T**. Select the mistake, type what you meant. Rules live in SQLite at `~/Library/Application Support/ButterKeys/butterkeys.sqlite`, with import and export as versioned JSON.

It pauses for secure input. It excludes terminals, IDEs, password managers, and VMs by default. Input Monitoring and Accessibility are required because that is how a menu bar app sees keystrokes and applies a correction. Direct distribution, not the Mac App Store sandbox.

## Why this is on the workbench

It is not a platform SDK and it will not change how enterprises adopt agents. It is the other half of how I work: a small native tool that removes friction I hit a hundred times a day. Local-first is not a slogan here. If the network is down, ButterKeys still fixes `teh`.
