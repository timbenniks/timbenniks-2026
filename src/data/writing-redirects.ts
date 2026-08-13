/** Old writing slugs that still get linked; send them to the live filename. */
export const WRITING_SLUG_REDIRECTS: Record<string, string> = {
  'ai-coding-agents-and-the-end-of-glue-software': 'we-are-thinking-too-small',
  'ai-coding-tools-and-the-new-economics-of-test-driven-development': 'tdd-finally-makes-sense',
  'ai-intuition-and-the-real-cost-of-research': 'the-best-product-decisions-were-never-analytical',
  'cursor-and-the-power-of-learning-from-real-development-loops': 'cursors-moat',
  'cursor-rules-and-the-vibe-engineer-workflow': 'cursor-rules-and-my-vibe-engineer-workflow',
  'every-string-is-now-part-of-your-ai-security-model': 'ten-ai-security-problems-hiding-in-plain-text',
  'gatsby-source-plugins-are-an-anti-pattern': 'gatsby-source-plugins-are-anti-pattern',
  'mcp-servers-need-context': 'build-context-aware-mcp-not-api-wrappers',
  'off-platform-ai-and-on-platform-ai-as-reach-and-trust-layers':
    'ai-will-not-live-in-one-place-but-trust-has-to',
  'plot-twist-ai-is-making-devs-more-valuable':
    'ai-is-not-replacing-developers-it-is-exposing-everyone-else',
  'programming-is-becoming-knitting': 'code-is-craft-now-not-labor',
  'stop-burning-tokens-on-what-a-script-can-do':
    'the-agentic-spectrum-stop-burning-tokens-on-what-a-script-can-do',
  'the-ai-advantage-of-a-middle-sized-company': 'the-biggest-risk-to-ai-is-the-enterprise-org-chart',
  'when-output-is-cheap-taste-and-rest-matter-most': 'when-output-is-cheap-taste-is-everything',
  'why-experience-is-the-real-flagship': 'the-experience-factory-01-why-experience-is-the-real-flagship',
};

export function writingRedirectMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [from, to] of Object.entries(WRITING_SLUG_REDIRECTS)) {
    out[`/writing/${from}`] = `/writing/${to}`;
    out[`/writing/${from}.md`] = `/writing/${to}.md`;
  }
  return out;
}
