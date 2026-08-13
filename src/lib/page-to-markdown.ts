import { siteUrl } from '../data/site';
import type { PageData, PageSection } from './page-schema';
import { pageMarkdownPath } from './markdown';

function headlineText(h: { lead: string; em: string; tail: string }): string {
  return [h.lead, h.em, h.tail].filter((p) => p.trim()).join(' ');
}

function heading(section: {
  eyebrow?: string;
  title?: string;
  lede?: string;
}): string[] {
  const lines: string[] = [];
  if (section.eyebrow) lines.push(`*${section.eyebrow}*`);
  if (section.title) lines.push(`## ${section.title}`);
  if (section.lede) lines.push(section.lede);
  return lines;
}

function ctaLine(ctas: Array<{ label: string; href: string }> | undefined): string[] {
  if (!ctas?.length) return [];
  return ctas.map((c) => `- [${c.label}](${c.href})`);
}

function sectionToMarkdown(section: PageSection): string {
  switch (section.kind) {
    case 'hero': {
      const lines = [
        `# ${headlineText(section.headline)}`,
        section.subline,
        ...ctaLine(section.ctas),
      ];
      if (section.image) {
        lines.push(`![${section.image.alt}](${section.image.src})`);
      }
      if (section.gallery?.length) {
        for (const img of section.gallery) {
          const caption = img.label ? ` ${img.label}` : '';
          lines.push(`![${img.alt}](${img.src})${caption}`);
        }
      }
      return lines.filter(Boolean).join('\n\n');
    }
    case 'quote-callout': {
      const quote = `> ${headlineText(section.headline)}`;
      return [quote, section.attribution ? `— ${section.attribution}` : '']
        .filter(Boolean)
        .join('\n\n');
    }
    case 'feature-split':
    case 'card-grid':
    case 'card-rows': {
      const sourcePath = `/${section.source}`;
      return [
        ...heading(section),
        `Live ${section.source} cards — see [${section.source}](${siteUrl(sourcePath)}) or \`${sourcePath}.md\`.`,
        ...ctaLine('cta' in section && section.cta ? [section.cta] : undefined),
      ]
        .filter(Boolean)
        .join('\n\n');
    }
    case 'stats':
      return `Site stats derived from the ${section.source} collection. See ${siteUrl(`/${section.source}`)}.`;
    case 'browse':
      return `Browse the ${section.source} collection at ${siteUrl(`/${section.source}`)} or search at ${siteUrl('/search')}.`;
    case 'inventory': {
      const groups = section.groups.map((g) => {
        const items = g.items
          .map((i) => `- **${i.name}**${i.note ? ` — ${i.note}` : ''}`)
          .join('\n');
        return `### ${g.heading}\n\n${items}`;
      });
      return [...heading(section), ...groups].filter(Boolean).join('\n\n');
    }
    case 'copy-blocks': {
      const blocks = section.items.map((i) => `### ${i.label}\n\n${i.body}`);
      return [...heading(section), ...blocks].filter(Boolean).join('\n\n');
    }
    case 'photo-grid': {
      const photos = section.items.map((i) => {
        const caption = i.label ? ` ${i.label}` : '';
        return `![${i.alt}](${i.src})${caption}`;
      });
      return [...heading(section), ...photos].filter(Boolean).join('\n\n');
    }
    case 'topic-grid': {
      const topics = section.items.map((i) => `### ${i.title}\n\n${i.body}`);
      const pills =
        section.pills.length > 0
          ? `${section.pillsLabel ?? 'Related'}: ${section.pills.join(' · ')}`
          : '';
      const note = [
        section.noteBefore,
        section.noteHref && section.noteLinkLabel
          ? `[${section.noteLinkLabel}](${section.noteHref})`
          : '',
        section.noteAfter,
      ]
        .filter(Boolean)
        .join('');
      return [...heading(section), ...topics, pills, note].filter(Boolean).join('\n\n');
    }
    case 'factsheet': {
      const rows = section.items.map((i) =>
        i.href ? `- **${i.term}:** [${i.value}](${i.href})` : `- **${i.term}:** ${i.value}`,
      );
      return [...heading(section), rows.join('\n')].filter(Boolean).join('\n\n');
    }
    case 'image-text': {
      const img = `![${section.image.alt}](${section.image.src})`;
      return [
        ...heading(section),
        img,
        section.body,
        ...ctaLine(section.cta ? [section.cta] : undefined),
      ]
        .filter(Boolean)
        .join('\n\n');
    }
    case 'faq': {
      const faqs = section.items.map((i) => `### ${i.question}\n\n${i.answer}`);
      return [...heading(section), ...faqs].filter(Boolean).join('\n\n');
    }
    case 'timeline': {
      const items = section.items.map((i) => {
        const loc = i.location ? ` · ${i.location}` : '';
        const company = i.url ? `[${i.company}](${i.url})` : i.company;
        return `### ${i.title} — ${company}\n\n${i.daterange}${loc}\n\n${i.text}`;
      });
      return [
        ...heading(section),
        ...items,
        ...ctaLine(section.cta ? [section.cta] : undefined),
      ]
        .filter(Boolean)
        .join('\n\n');
    }
    case 'cta-strip': {
      const text = `${section.text}${section.em ?? ''}`;
      return [text, ...ctaLine(section.ctas)].filter(Boolean).join('\n\n');
    }
    default: {
      const _never: never = section;
      return _never;
    }
  }
}

export function pageToMarkdown(data: PageData): string {
  const url = siteUrl(data.path);
  const md = siteUrl(pageMarkdownPath(data.path));
  const header = [
    `---`,
    `title: ${JSON.stringify(data.metadata.title)}`,
    `description: ${JSON.stringify(data.metadata.description)}`,
    `url: ${JSON.stringify(url)}`,
    `markdown_url: ${JSON.stringify(md)}`,
    `---`,
    '',
  ].join('\n');
  const body = data.sections.map(sectionToMarkdown).filter(Boolean).join('\n\n---\n\n');
  return `${header}\n${body}\n`;
}
