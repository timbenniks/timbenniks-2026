import type { PageData, PageSection } from './page-schema';
import { BOOKING_EMAIL } from './public-tools';
import { pageMarkdownPath, siteUrl } from './markdown';

function headlineText(h: { lead: string; em: string; tail: string }): string {
  return [h.lead, h.em, h.tail].filter((p) => p.trim()).join(' ');
}

export function extractPressKit(data: PageData) {
  const bios: Array<{ label: string; body: string }> = [];
  const topics: Array<{ title: string; body: string }> = [];
  const photos: Array<{ src: string; alt: string; label?: string }> = [];
  const facts: Array<{ term: string; value: string; href?: string }> = [];
  const downloads: Array<{ label: string; href: string; meta?: string; note?: string }> = [];
  const colors: Array<{ name: string; hex: string; usage?: string }> = [];
  let stages: string[] = [];
  let intro = '';

  const walk = (section: PageSection) => {
    switch (section.kind) {
      case 'hero':
        intro = section.subline ?? headlineText(section.headline);
        if (section.gallery) {
          photos.push(
            ...section.gallery.map((g) => ({ src: g.src, alt: g.alt, label: g.label })),
          );
        }
        break;
      case 'copy-blocks':
        bios.push(...section.items.map((i) => ({ label: i.label, body: i.body })));
        break;
      case 'photo-grid':
        photos.push(
          ...section.items.map((i) => ({ src: i.src, alt: i.alt, label: i.label })),
        );
        break;
      case 'topic-grid':
        topics.push(...section.items);
        stages = section.pills;
        break;
      case 'factsheet':
        facts.push(...section.items);
        break;
      case 'downloads':
        downloads.push(...section.items);
        break;
      case 'swatches':
        colors.push(...section.items);
        break;
      default:
        break;
    }
  };

  for (const section of data.sections) walk(section);

  return {
    url: siteUrl('/press-kit'),
    markdown: siteUrl(pageMarkdownPath('/press-kit')),
    booking_email: BOOKING_EMAIL,
    title: data.metadata.title,
    description: data.metadata.description,
    intro,
    bios,
    topics,
    stages,
    photos,
    facts,
    downloads,
    colors,
  };
}
