# Agent readiness audit follow-up — 6 September 2026

## Findings and decisions

- **CLI:** keep REST, MCP, and curl; no npm package, per Tim's decision.
- **Developer discovery:** existing `/developers` title and H1 name Tim Benniks; footer, llms.txt, agents.md, OpenAPI externalDocs, and MCP manifest link the portal. Public URLs are crawlable. An empty external name search does not prove a missing site resource. Inspect `/developers` and submit `/sitemap-index.xml` in Search Console using an owner/full-user account; indexing is not guaranteed.
- **REST errors:** all six live OpenAPI operations reference typed 400/404/405/429/500 responses. Resolving `#/components/responses/*` leads to `application/problem+json` and `#/components/schemas/Problem`. This is valid OpenAPI, not a missing schema. Regression tests now resolve both reference levels.
- **MCP:** confirmed a real defect on production: initialize always selected `2024-11-05`, and `notifications/initialized` returned HTTP 200 with an Invalid Request error. Both endpoints now share the official SDK's stateless Streamable HTTP transport. Official-client tests exercise initialization and all six read-only tools at both URLs.
- **Markdown 404:** `/404.md` lost its HTTP status when prerendered. It now runs dynamically so its existing 404 response survives deployment.

## Changed behavior

`POST /api/mcp` and `POST /.well-known/mcp` negotiate protocol versions, accept notifications with an empty 202 response, validate JSON-RPC envelopes, reject unsupported protocol headers, and preserve tool execution errors as MCP `isError` results. Unknown tools return Invalid Params. No session storage is required. POST clients must include `Accept: application/json, text/event-stream` and `Content-Type: application/json`; subsequent requests include the negotiated `MCP-Protocol-Version`.

GET streaming requests return 405 because the service uses immediate JSON responses. Normal GET discovery remains available at `/.well-known/mcp`; `/api/v1` is the health/discovery endpoint. Browser Origins are restricted to the request origin and canonical site origin. Remote clients without Origin remain supported. OPTIONS advertises the protocol header. The developer curl example documents and tests the full lifecycle.

## Verification

- `npm run build`: passed.
- `npm run check`: 0 errors, 0 warnings (23 informational hints).
- 42 tests passed against a local harness serving built static files and the actual Vercel SSR function. The harness applies the relevant compiled redirects/headers/rewrites; it does not replace a post-deployment Vercel edge check.
- 428 generated public machine-readable files and eight dynamic public GET endpoints checked: no failures; JSON responses parsed successfully. Protocol tests cover both MCP endpoints, all six tools, malformed messages, notifications, versions, origins, preflight and media negotiation.
- Agentlint rerun on production before deployment: 100 overall / 100 surface / 96 bounded task success. This score did not detect the MCP lifecycle defect, so SDK integration tests are the stronger evidence here.
- Agentlint rerun against the updated local build: all reasoning tasks resolved. Remaining findings are unsupported native WebMCP in the scanner browser and local/canonical hostname mismatch. No browser API was fabricated; N/A checks were left alone.
- No authenticated actions, publishing, deployment, or messages sent.

## After deployment

Run `E2E_BASE_URL=https://timbenniks.dev npm run test:agents` for the same 42 read-only checks at the actual edge, then rerun Agentlint and the external audit. Without E2E_BASE_URL, `npm run test:agents` starts Astro dev and skips two production-only Markdown checks affected by Vite/static routing.

Search Console inspection requires the user's account access. No further CLI work is planned.

## Protocol references

- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP lifecycle/version negotiation](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0.html)
- [Google recrawl guidance](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
