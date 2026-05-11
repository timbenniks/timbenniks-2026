import { createMarkdownProcessor } from '@astrojs/markdown-remark';

const processor = await createMarkdownProcessor();

export async function renderMarkdown(markdown: string): Promise<string> {
  const rendered = await processor.render(markdown);
  return rendered.code;
}
