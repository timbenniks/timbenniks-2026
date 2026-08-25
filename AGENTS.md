<!-- agentlint:start -->
## Agentlint

This project uses Agentlint to test whether agents can find, understand, and safely use the deployed website.

1. Run `npm run agentlint`.
2. If reasoning is required, run `npx @timbenniks/agentlint task get <id>` and answer using only its instructions and evidence.
3. Resolve with `npx @timbenniks/agentlint task resolve <id> --result '<JSON>'`; repeat until no tasks remain.
4. Run `npx @timbenniks/agentlint fix` and use `.agentlint/fix-prompt.md` in this repository.
5. Implement evidence-backed P0/P1 fixes, rescan, and repeat until no P0/P1 findings or failed missions remain.

Do not invent pages, APIs, entities, or tools. Do not fix N/A checks. Do not authenticate, submit forms, deploy, or mutate the scanned target.
<!-- agentlint:end -->
