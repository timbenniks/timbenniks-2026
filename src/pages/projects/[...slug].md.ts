import { createMarkdownRoute, projectEntryToMarkdown } from '../../lib/markdown';

export const { getStaticPaths, GET } = createMarkdownRoute('projects', projectEntryToMarkdown);
