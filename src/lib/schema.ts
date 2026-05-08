import { seo, SITE_URL as SITE } from '../data/site';

export type BreadcrumbItem = { name: string; url: string };

const personRef = () => ({
  '@type': 'Person',
  '@id': `${SITE}${seo.authorId}`,
  name: 'Tim Benniks',
  url: `${SITE}/`,
  image: {
    '@type': 'ImageObject',
    '@id':
      'https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,w_96,h_96,c_thumb/Tim/timreal.png',
    url: 'https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,w_96,h_96,c_thumb/Tim/timreal.png',
    width: '96',
    height: '96',
  },
});

export const websiteSchema = () => ({
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  url: `${SITE}/`,
  name: seo.siteName,
  description:
    'Personal website of Tim Benniks. Writing, talks, and videos on developer experience and AI-augmented engineering.',
  inLanguage: seo.locale,
  potentialAction: [
    {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  ],
  author: { '@type': 'Person', name: 'Tim Benniks' },
});

export const webPageSchema = (opts: {
  url: string;
  name: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
  hasBreadcrumb?: boolean;
}) => ({
  '@type': 'WebPage',
  '@id': opts.url,
  url: opts.url,
  name: opts.name,
  description: opts.description,
  isPartOf: { '@id': `${SITE}/#website` },
  inLanguage: seo.locale,
  ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
  ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  ...(opts.hasBreadcrumb ? { breadcrumb: { '@id': `${SITE}/#breadcrumb` } } : {}),
  potentialAction: [{ '@type': 'ReadAction', target: [opts.url] }],
});

export const breadcrumbSchema = (items: BreadcrumbItem[]) => ({
  '@type': 'BreadcrumbList',
  '@id': `${SITE}/#breadcrumb`,
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: item.url,
  })),
});

export const blogPostingSchema = (opts: {
  url: string;
  title: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  tags?: string[];
  readingMinutes?: number;
}) => ({
  '@type': 'BlogPosting',
  headline: opts.title,
  ...(opts.image ? { image: opts.image } : {}),
  ...(opts.tags?.length ? { keywords: opts.tags.join(', ') } : {}),
  mainEntityOfPage: opts.url,
  url: opts.url,
  datePublished: opts.datePublished,
  dateCreated: opts.datePublished,
  dateModified: opts.dateModified ?? opts.datePublished,
  description: opts.description,
  abstract: opts.description,
  ...(opts.readingMinutes ? { timeRequired: `PT${opts.readingMinutes}M` } : {}),
  author: personRef(),
});

export const buildGraph = (...nodes: Record<string, unknown>[]) => ({
  '@context': 'https://schema.org',
  '@graph': nodes,
});
