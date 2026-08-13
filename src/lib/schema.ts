import { author, seo, social, SITE_URL as SITE } from '../data/site';

export type BreadcrumbItem = { name: string; url: string };

export const PERSON_ID = `${SITE}${seo.authorId}`;

/** Reference-only. Full Person lives in `personSchema()` / the layout graph. */
export const personRef = () => ({
  '@type': 'Person' as const,
  '@id': PERSON_ID,
});

export const personSchema = () => ({
  ...personRef(),
  name: author.name,
  givenName: 'Tim',
  familyName: 'Benniks',
  url: `${SITE}/about`,
  image: {
    '@type': 'ImageObject',
    '@id': author.avatar,
    url: author.avatar,
    width: '96',
    height: '96',
  },
  jobTitle: 'Developer Experience Lead',
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
  author: personRef(),
  publisher: personRef(),
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

export const eventSchema = (opts: {
  id: string;
  name: string;
  startDate: string;
  location?: string;
  url?: string;
  conference?: string;
}) => {
  const online = opts.location
    ? /online|virtual|remote/i.test(opts.location)
    : false;
  const location = opts.location
    ? online
      ? { '@type': 'VirtualLocation', name: opts.location }
      : { '@type': 'Place', name: opts.location }
    : undefined;
  return {
    '@type': 'Event',
    '@id': `${SITE}/speaking#${opts.id}`,
    name: opts.name,
    startDate: opts.startDate,
    ...(location ? { location } : {}),
    url: opts.url || `${SITE}/speaking`,
    eventAttendanceMode: online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    performer: personRef(),
    ...(opts.conference
      ? { organizer: { '@type': 'Organization', name: opts.conference } }
      : {}),
  };
};

export const softwareSchema = (opts: {
  url: string;
  name: string;
  description: string;
  github?: string;
  live?: string;
  npm?: string;
}) => {
  const sameAs = [opts.live, opts.github].filter(Boolean) as string[];
  return {
    '@type': opts.github ? 'SoftwareSourceCode' : 'SoftwareApplication',
    '@id': `${opts.url}#software`,
    name: opts.name,
    description: opts.description,
    url: opts.url,
    author: personRef(),
    ...(opts.github ? { codeRepository: opts.github } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(opts.npm
      ? { installUrl: `https://www.npmjs.com/package/${opts.npm}` }
      : {}),
  };
};

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

export type FaqEntry = { question: string; answer: string };

export const faqPageSchema = (items: FaqEntry[], opts?: { url?: string }) => ({
  '@type': 'FAQPage',
  ...(opts?.url ? { '@id': `${opts.url}#faq`, mainEntityOfPage: opts.url } : {}),
  mainEntity: items.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
});

export const buildGraph = (...nodes: Record<string, unknown>[]) => ({
  '@context': 'https://schema.org',
  '@graph': nodes,
});
