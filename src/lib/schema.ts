import { seo, social, SITE_URL as SITE } from '../data/site';

export type BreadcrumbItem = { name: string; url: string };

const PERSON_ID = `${SITE}${seo.authorId}`;

const personRef = () => ({
  '@type': 'Person',
  '@id': PERSON_ID,
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

export const personSchema = () => ({
  ...personRef(),
  givenName: 'Tim',
  familyName: 'Benniks',
  jobTitle: 'Head of Developer Experience',
  description:
    'Developer experience leader, writer, and speaker focused on AI-augmented engineering and composable platforms.',
  mainEntityOfPage: `${SITE}/about`,
  sameAs: [...social],
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
  author: { '@id': PERSON_ID },
  publisher: { '@id': PERSON_ID },
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

export const videoObjectSchema = (opts: {
  url: string;
  title: string;
  description: string;
  datePublished: string;
  thumbnailUrl: string;
  videoId: string;
  transcript?: string;
  tags?: string[];
}) => ({
  '@type': 'VideoObject',
  name: opts.title,
  headline: opts.title,
  description: opts.description,
  url: opts.url,
  mainEntityOfPage: opts.url,
  uploadDate: opts.datePublished,
  thumbnailUrl: [opts.thumbnailUrl],
  embedUrl: `https://www.youtube.com/embed/${opts.videoId}`,
  contentUrl: `https://www.youtube.com/watch?v=${opts.videoId}`,
  ...(opts.tags?.length ? { keywords: opts.tags.join(', ') } : {}),
  ...(opts.transcript?.trim() ? { transcript: opts.transcript.trim() } : {}),
  author: personRef(),
});

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
};

const parseMonthYear = (s: string): string | undefined => {
  const [monthName, year] = s.trim().split(/\s+/);
  const mm = MONTHS[monthName?.toLowerCase() ?? ''];
  if (!mm || !/^\d{4}$/.test(year ?? '')) return undefined;
  return `${year}-${mm}`;
};

const parseDateRange = (range: string) => {
  const [startRaw, endRaw] = range.split(/\s*-\s*/);
  const startDate = startRaw ? parseMonthYear(startRaw) : undefined;
  const current = !endRaw || /present/i.test(endRaw);
  const endDate = current ? undefined : parseMonthYear(endRaw);
  return { startDate, endDate, current };
};

export type TimelineRole = {
  daterange: string;
  company: string;
  title: string;
  url?: string;
  location?: string;
  text: string;
};

export const careerTimelineSchema = (items: TimelineRole[]) => {
  const parsed = items.map((item) => ({ item, ...parseDateRange(item.daterange) }));
  const current = parsed.filter((p) => p.current);
  const past = parsed.filter((p) => !p.current);

  const buildOrg = (item: TimelineRole) => ({
    '@type': 'Organization',
    name: item.company,
    ...(item.url ? { url: item.url } : {}),
  });

  const buildRole = (
    entry: (typeof parsed)[number],
    relation: 'worksFor' | 'alumniOf',
  ) => ({
    '@type': 'OrganizationRole',
    roleName: entry.item.title,
    ...(entry.startDate ? { startDate: entry.startDate } : {}),
    ...(entry.endDate ? { endDate: entry.endDate } : {}),
    description: entry.item.text,
    ...(entry.item.location ? { location: entry.item.location } : {}),
    [relation]: buildOrg(entry.item),
  });

  return {
    ...personRef(),
    ...(current.length
      ? { worksFor: current.map((p) => buildRole(p, 'worksFor')) }
      : {}),
    ...(past.length
      ? { alumniOf: past.map((p) => buildRole(p, 'alumniOf')) }
      : {}),
  };
};

export const buildGraph = (...nodes: Record<string, unknown>[]) => ({
  '@context': 'https://schema.org',
  '@graph': nodes,
});
