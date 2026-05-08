import { createMarkdownRoute, writingEntryToMarkdown } from '../../lib/markdown';

export const { getStaticPaths, GET } = createMarkdownRoute(
  'writing',
  writingEntryToMarkdown,
  ({ data }) => !data.draft,
);
