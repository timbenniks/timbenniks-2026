import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import { siteUrl } from '../data/site';

export { siteUrl };

function isoDate(d: Date | string): string {
  return (d instanceof Date ? d : new Date(d)).toISOString();
}

function yamlString(value: string): string {
  // Double-quoted YAML scalar. Escape backslashes, double quotes, and CR/LF
  // so multi-line values stay on a single physical line.
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `"${escaped}"`;
}

function yamlBlock(fields: Array<[string, unknown]>): string {
  const lines: string[] = ['---'];
  for (const [key, raw] of fields) {
    if (raw == null) continue;
    if (Array.isArray(raw)) {
      if (raw.length === 0) continue;
      lines.push(`${key}: [${raw.map((v) => yamlString(String(v))).join(', ')}]`);
      continue;
    }
    if (raw instanceof Date) {
      lines.push(`${key}: ${yamlString(raw.toISOString())}`);
      continue;
    }
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      lines.push(`${key}: ${String(raw)}`);
      continue;
    }
    const s = String(raw);
    if (!s) continue;
    lines.push(`${key}: ${yamlString(s)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

export function writingEntryToMarkdown(entry: CollectionEntry<'writing'>): string {
  const data = entry.data;
  const url = siteUrl(`/writing/${entry.id}`);
  const frontmatter = yamlBlock([
    ['title', data.title],
    ['description', data.description],
    ['date', data.date],
    ['url', url],
    ['canonical_url', data.canonical_url ?? url],
    ['image', data.image],
    ['tags', data.tags],
    ['reading_time', data.reading_time],
  ]);
  const body = (entry.body ?? '').trim();
  return `${frontmatter}\n\n# ${data.title}\n\n${body}\n`;
}

export function videoEntryToMarkdown(
  entry: CollectionEntry<'videos'>,
  options: { includeTranscript?: boolean } = {},
): string {
  const { includeTranscript = true } = options;
  const data = entry.data;
  const url = siteUrl(`/videos/${entry.id}`);
  const youtubeUrl = `https://www.youtube.com/watch?v=${data.videoId}`;
  const frontmatter = yamlBlock([
    ['title', data.title],
    ['description', data.description],
    ['date', data.date],
    ['url', url],
    ['youtube_url', youtubeUrl],
    ['playlist', data.playlist],
    ['duration', data.duration],
    ['image', data.image],
    ['tags', data.tags ?? []],
  ]);
  const sections: string[] = [`# ${data.title}`];
  if (data.description) sections.push(data.description);
  sections.push(`Watch on YouTube: ${youtubeUrl}`);
  const body = (entry.body ?? '').trim();
  if (body) sections.push(body);
  if (includeTranscript && data.transcript && data.transcript.trim()) {
    sections.push('## Transcript', data.transcript.trim());
  }
  return `${frontmatter}\n\n${sections.join('\n\n')}\n`;
}

export function speakingLine(entry: CollectionEntry<'speaking'>): string {
  const d = entry.data;
  const date = isoDate(d.date).slice(0, 10);
  const where = d.location ? ` (${d.location})` : '';
  const link = d.link ? ` — ${d.link}` : '';
  return `- ${date} — "${d.talk}" at ${d.conference}${where}${link}`;
}

export function markdownResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}

export function plainTextResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}

// Route factory for the per-entry .md companions of writing/videos. Both routes
// are otherwise identical (load collection → render to markdown → respond).
export function createMarkdownRoute<C extends CollectionKey>(
  collection: C,
  toMarkdown: (entry: CollectionEntry<C>) => string,
  filter?: (entry: CollectionEntry<C>) => boolean,
): { getStaticPaths: GetStaticPaths; GET: APIRoute } {
  return {
    getStaticPaths: async () => {
      const entries = filter
        ? (await getCollection(collection)).filter(filter)
        : await getCollection(collection);
      return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
    },
    GET: ({ props }) => {
      const { entry } = props as { entry: CollectionEntry<C> };
      return markdownResponse(toMarkdown(entry));
    },
  };
}
