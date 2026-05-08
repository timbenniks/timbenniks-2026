import { createMarkdownRoute, videoEntryToMarkdown } from '../../lib/markdown';

export const { getStaticPaths, GET } = createMarkdownRoute('videos', videoEntryToMarkdown);
