---
title: Contentstack OpenAPI Plugin
tag: OSS · CLI
description: A csdx plugin that introspects a Contentstack stack and writes a valid OpenAPI 3.1 spec for the Delivery or Management API, including schemas, regions, modular blocks, and security schemes.
meta: OSS · @contentstack/cli-plugin-openapi
order: 13
github: https://github.com/timbenniks/contentstack-cli-plugin-openapi
npm: "@contentstack/cli-plugin-openapi"
---

If the stack already knows its content types, an OpenAPI file should not be a separate documentation project. This `csdx` plugin introspects the stack and writes an OpenAPI 3.1 spec for the Content Delivery API or the Content Management API.

`csdx plugins:install @contentstack/cli-plugin-openapi`, then `csdx openapi:generate` with a stack API key and a management token alias. Delivery mode is read-only GET paths with `api_key` and `access_token`. Management mode is full CRUD with bearer auth. Region endpoints are filled in from the CLI config so you do not hardcode `cdn.contentstack.io` and then wonder why EU is 404ing.

## What the spec actually contains

JSON Schemas for every content type and global field. Modular blocks as arrays of `oneOf` unions with discriminators. Shared parameters for environment, locale, and the usual query flags. File, reference, group, date, and JSON RTE fields mapped instead of dumped as `object`. The spec is validated before it is written.

I use it for Swagger UI, for generating a typed client, and for handing an agent a contract instead of a wiki page. That last one is the quiet reason it exists. An agent with a current OpenAPI file guesses less. I wrote about that tension in [Do we still need SDKs in the age of AI agents?](/writing/do-we-still-need-sdks-in-the-age-of-ai-agents).

Regenerate it when the model changes. Commit the file. Treat it like any other build artifact that happens to be documentation.
