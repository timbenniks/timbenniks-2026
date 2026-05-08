import type { APIRoute } from 'astro';
import {
  plainTextResponse,
  siteUrl,
  speakingLine,
  videoEntryToMarkdown,
  writingEntryToMarkdown,
} from '../lib/markdown';
import { loadAllSorted } from '../lib/collections';
import { SITE_SUMMARY, STATIC_PAGES } from '../lib/static-pages-prose';

const SEPARATOR = '\n\n---\n\n';

export const GET: APIRoute = async () => {
  const { writing, videos, speaking } = await loadAllSorted();

  const writingBlocks = writing.map(writingEntryToMarkdown);
  const videoBlocks = videos.map((entry) =>
    videoEntryToMarkdown(entry, { includeTranscript: false }),
  );
  const speakingList = speaking.map(speakingLine).join('\n');

  const pageBlocks = STATIC_PAGES.map(
    (p) => `# ${p.title}\n\nURL: ${siteUrl(p.path)}\n\n${p.description}\n\n${p.prose}`,
  );

  const header = [
    '# Tim Benniks — full corpus',
    '',
    `> ${SITE_SUMMARY}`,
    '',
    `Source: ${siteUrl('/')}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'This file inlines every non-draft writing entry, every video (metadata + description, transcripts excluded — fetch the per-video `.md` for the transcript), every speaking engagement, and short prose summaries of the static pages. Articles are separated by `---`. The canonical HTML URL appears in each block’s frontmatter as `url`.',
  ].join('\n');

  const body = [
    header,
    `## Pages${SEPARATOR}${pageBlocks.join(SEPARATOR)}`,
    `## Writing${SEPARATOR}${writingBlocks.join(SEPARATOR)}`,
    `## Videos${SEPARATOR}${videoBlocks.join(SEPARATOR)}`,
    `## Speaking\n\n${speakingList}`,
  ].join(SEPARATOR);

  return plainTextResponse(body + '\n');
};
