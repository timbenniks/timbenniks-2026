/** Section defaults, form controls, and nested list specs — single client catalog.
 * Keep keys aligned with `SECTION_KINDS` in src/lib/page-schema.ts and
 * `CLIENT_SECTION_FORM_KINDS` in src/lib/admin/section-catalog-align.ts.
 */

export function defaultSection(kind) {
  const sampleImage = {
    src: 'https://res.cloudinary.com/dwfcofnrd/image/upload/website/tim-hero-square.png',
    alt: 'Placeholder image',
    width: 624,
    height: 624,
  };

  switch (kind) {
    case 'hero':
      return {
        kind: 'hero',
        eyebrow: 'New section',
        headline: {
          lead: 'A clear lead line,',
          em: 'one emphasized beat,',
          tail: 'and a short tail.',
        },
        subline:
          'Supporting copy that explains the section. Replace this with the real message — keep it to two sentences max.',
        ctas: [
          { label: 'Primary action', href: '/', variant: 'primary' },
          { label: 'Secondary', href: '/about', variant: 'secondary' },
        ],
        image: {
          ...sampleImage,
          src: 'https://res.cloudinary.com/dwfcofnrd/image/upload/website/tim-sketch-1.png',
          alt: 'Sketched portrait placeholder',
          width: 807,
          height: 947,
        },
        imageSide: 'right',
      };
    case 'cta-strip':
      return {
        kind: 'cta-strip',
        text: 'Ready to take the next step?',
        em: ' Let’s talk.',
        ctas: [{ label: 'Get in touch', href: 'mailto:hi@timbenniks.dev', variant: 'accent' }],
      };
    case 'quote-callout':
      return {
        kind: 'quote-callout',
        headline: {
          lead: 'A short quote that',
          em: 'lands the point.',
          tail: '',
        },
        attribution: '— Someone worth citing',
        tone: 'dark',
        align: 'left',
        cta: { label: 'Read more', href: '/writing' },
      };
    case 'image-text':
      return {
        kind: 'image-text',
        eyebrow: 'Context',
        title: 'Image + text section',
        lede: 'A one-line lede that frames the story beside the image.',
        body: 'Longer body copy. **Markdown works here** — use short paragraphs, not essays.\n\nSecond paragraph for breathing room.',
        image: sampleImage,
        imageSide: 'left',
        cta: { label: 'Learn more', href: '/about' },
      };
    case 'copy-blocks':
      return {
        kind: 'copy-blocks',
        title: 'Copy blocks',
        eyebrow: 'Notes',
        items: [
          {
            label: 'First block',
            body: 'Placeholder body for the first block. Swap this for the real copy.',
            style: 'serif',
          },
          {
            label: 'Second block',
            body: 'A second block so the layout reads as a real section, not a stub.',
            style: 'muted',
          },
        ],
      };
    case 'inventory':
      return {
        kind: 'inventory',
        title: 'Inventory',
        eyebrow: 'Kit',
        tone: 'light',
        groups: [
          {
            heading: 'Group one',
            items: [
              { name: 'Item A', note: 'Short note' },
              { name: 'Item B', note: 'Short note' },
            ],
          },
          {
            heading: 'Group two',
            items: [{ name: 'Item C' }],
          },
        ],
      };
    case 'photo-grid':
      return {
        kind: 'photo-grid',
        title: 'Photo grid',
        eyebrow: 'Gallery',
        tone: 'light',
        columns: 3,
        aspect: 'video',
        items: [
          {
            src: 'https://res.cloudinary.com/dwfcofnrd/image/upload/website/tim-sketch-1.png',
            alt: 'Photo 1',
            label: 'Shot one',
            width: 1600,
            height: 900,
          },
          {
            src: 'https://res.cloudinary.com/dwfcofnrd/image/upload/website/tim-hero-square.png',
            alt: 'Photo 2',
            label: 'Shot two',
            width: 1600,
            height: 900,
          },
          {
            src: 'https://res.cloudinary.com/dwfcofnrd/image/upload/website/tim-writer.png',
            alt: 'Photo 3',
            label: 'Shot three',
            width: 1600,
            height: 900,
          },
        ],
      };
    case 'topic-grid':
      return {
        kind: 'topic-grid',
        title: 'Topics',
        eyebrow: 'Themes',
        items: [
          { title: 'Topic one', body: 'Short description of the first theme.' },
          { title: 'Topic two', body: 'Short description of the second theme.' },
          { title: 'Topic three', body: 'Short description of the third theme.' },
        ],
        pills: ['AI', 'DX', 'Platforms'],
        pillsLabel: 'Related',
      };
    case 'factsheet':
      return {
        kind: 'factsheet',
        title: 'Factsheet',
        eyebrow: 'Quick facts',
        items: [
          { term: 'Role', value: 'Developer Experience Lead' },
          { term: 'Location', value: 'Remote' },
          { term: 'Contact', value: 'hi@timbenniks.dev', href: 'mailto:hi@timbenniks.dev' },
        ],
      };
    case 'faq':
      return {
        kind: 'faq',
        title: 'FAQ',
        eyebrow: 'Common questions',
        lede: 'Short answers to the questions people actually ask.',
        tone: 'light',
        items: [
          {
            question: 'What is this section for?',
            answer: 'Replace this with a real question and a clear, short answer.',
          },
          {
            question: 'How many items should I add?',
            answer: 'Enough to cover the obvious questions — usually four to eight.',
          },
        ],
      };
    case 'timeline':
      return {
        kind: 'timeline',
        title: 'Timeline',
        eyebrow: 'History',
        lede: 'A few milestones that tell the story in order.',
        tone: 'light',
        items: [
          {
            daterange: '2024 — Present',
            company: 'Company',
            title: 'Role title',
            location: 'Remote',
            text: 'What you did here in one or two sentences. Keep it concrete.',
          },
          {
            daterange: '2020 — 2024',
            company: 'Earlier company',
            title: 'Earlier role',
            text: 'Another beat on the timeline so the section has shape.',
          },
        ],
      };
    case 'card-grid':
      return {
        kind: 'card-grid',
        eyebrow: 'Collection',
        title: 'Card grid',
        lede: 'Pulls live cards from a content collection. Pick a source and how many to show.',
        source: 'projects',
        limit: 3,
        columns: 3,
        tone: 'light',
        cta: { label: 'See all', href: '/projects' },
      };
    case 'card-rows':
      return {
        kind: 'card-rows',
        eyebrow: 'Schedule',
        title: 'Card rows',
        lede: 'List-style cards from a collection — useful for talks and dated entries.',
        source: 'speaking',
        limit: 4,
        window: 'all',
        cta: { label: 'All talks', href: '/speaking' },
      };
    case 'feature-split':
      return {
        kind: 'feature-split',
        eyebrow: 'The journal',
        title: 'Recent writing',
        lede: 'Latest essays from the writing collection.',
        source: 'writing',
        limit: 3,
        cta: { label: 'All writing', href: '/writing' },
      };
    case 'stats':
      return { kind: 'stats', source: 'writing' };
    case 'browse':
      return {
        kind: 'browse',
        source: 'writing',
        eyebrow: 'Browse',
        searchHref: '/search',
        columns: 3,
      };
    default:
      return {
        kind: 'cta-strip',
        text: 'New section',
        ctas: [{ label: 'Go', href: '/', variant: 'primary' }],
      };
  }
}

export const SOURCE_ALL = ['writing', 'videos', 'speaking', 'projects'];
export const SOURCE_STATS = ['writing', 'videos', 'speaking'];
export const SOURCE_BROWSE = ['writing', 'videos'];
export const VARIANT_CTA = ['primary', 'secondary', 'accent', 'ghost'];
export const VARIANT_STRIP = ['primary', 'secondary', 'accent'];

/** Typed form controls per section kind. Query fields first; strings fall through after. */
export const SECTION_FORM = {
  hero: {
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'headline.lead', type: 'text' },
      { key: 'headline.em', type: 'text' },
      { key: 'headline.tail', type: 'text' },
      { key: 'subline', type: 'textarea' },
      { key: 'imageSide', type: 'select', options: ['left', 'right'] },
      { key: 'image.src', type: 'url', label: 'Image URL' },
      { key: 'image.alt', type: 'text', label: 'Image alt' },
    ],
  },
  'quote-callout': {
    fields: [
      { key: 'headline.lead', type: 'text' },
      { key: 'headline.em', type: 'text' },
      { key: 'headline.tail', type: 'text' },
      { key: 'attribution', type: 'text' },
      { key: 'tone', type: 'select', options: ['light', 'dark'] },
      { key: 'align', type: 'select', options: ['left', 'right'] },
      { key: 'cta.label', type: 'text', label: 'CTA label' },
      { key: 'cta.href', type: 'text', label: 'CTA href' },
    ],
  },
  'feature-split': {
    query: [
      { key: 'source', type: 'select', options: SOURCE_ALL, label: 'Source' },
      { key: 'limit', type: 'number', min: 1, max: 24, label: 'Limit', hint: 'How many items to show (e.g. latest 3)' },
    ],
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'title', type: 'text' },
      { key: 'lede', type: 'textarea' },
      { key: 'cta.label', type: 'text', label: 'CTA label' },
      { key: 'cta.href', type: 'text', label: 'CTA href' },
    ],
  },
  'card-grid': {
    query: [
      { key: 'source', type: 'select', options: SOURCE_ALL, label: 'Source' },
      { key: 'limit', type: 'number', min: 1, max: 24, label: 'Limit' },
      { key: 'columns', type: 'select', options: ['2', '3'], coerce: 'number', label: 'Columns' },
      { key: 'tone', type: 'select', options: ['light', 'dark'], label: 'Tone' },
    ],
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'title', type: 'text' },
      { key: 'lede', type: 'textarea' },
      { key: 'cta.label', type: 'text', label: 'CTA label' },
      { key: 'cta.href', type: 'text', label: 'CTA href' },
    ],
  },
  'card-rows': {
    query: [
      { key: 'source', type: 'select', options: SOURCE_ALL, label: 'Source' },
      { key: 'limit', type: 'number', min: 1, max: 24, label: 'Limit' },
      {
        key: 'window',
        type: 'select',
        options: ['all', 'upcoming', 'past'],
        label: 'Window',
        hint: 'Filter dated speaking entries',
      },
    ],
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'title', type: 'text' },
      { key: 'lede', type: 'textarea' },
      { key: 'cta.label', type: 'text', label: 'CTA label' },
      { key: 'cta.href', type: 'text', label: 'CTA href' },
    ],
  },
  stats: {
    query: [
      { key: 'source', type: 'select', options: SOURCE_STATS, label: 'Source' },
    ],
    fields: [],
  },
  browse: {
    query: [
      { key: 'source', type: 'select', options: SOURCE_BROWSE, label: 'Source' },
      { key: 'columns', type: 'select', options: ['2', '3'], coerce: 'number', label: 'Columns' },
    ],
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'searchHref', type: 'text', label: 'Search href' },
    ],
  },
  inventory: {
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'title', type: 'text' },
      { key: 'lede', type: 'textarea' },
      { key: 'tone', type: 'select', options: ['light', 'dark'] },
    ],
  },
  'copy-blocks': {
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'title', type: 'text' },
      { key: 'lede', type: 'textarea' },
    ],
  },
  'photo-grid': {
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'title', type: 'text' },
      { key: 'lede', type: 'textarea' },
      { key: 'tone', type: 'select', options: ['light', 'dark'] },
      { key: 'columns', type: 'select', options: ['2', '3'], coerce: 'number' },
      { key: 'aspect', type: 'select', options: ['video', 'portrait'] },
    ],
  },
  'topic-grid': {
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'title', type: 'text' },
      { key: 'lede', type: 'textarea' },
      { key: 'pillsLabel', type: 'text' },
    ],
  },
  factsheet: {
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'title', type: 'text' },
      { key: 'lede', type: 'textarea' },
    ],
  },
  'image-text': {
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'title', type: 'text' },
      { key: 'lede', type: 'textarea' },
      {
        key: 'body',
        type: 'markdown',
        label: 'Body',
        hint: 'Markdown supported — bold, links, paragraphs. Preview updates after Save.',
      },
      { key: 'imageSide', type: 'select', options: ['left', 'right'] },
      { key: 'image.src', type: 'url', label: 'Image URL' },
      { key: 'image.alt', type: 'text', label: 'Image alt' },
      { key: 'cta.label', type: 'text', label: 'CTA label' },
      { key: 'cta.href', type: 'text', label: 'CTA href' },
    ],
  },
  faq: {
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'title', type: 'text' },
      { key: 'lede', type: 'textarea' },
      { key: 'tone', type: 'select', options: ['light', 'dark'] },
    ],
  },
  timeline: {
    fields: [
      { key: 'eyebrow', type: 'text' },
      { key: 'title', type: 'text' },
      { key: 'lede', type: 'textarea' },
      { key: 'tone', type: 'select', options: ['light', 'dark'] },
      { key: 'cta.label', type: 'text', label: 'CTA label' },
      { key: 'cta.href', type: 'text', label: 'CTA href' },
    ],
  },
  'cta-strip': {
    fields: [
      { key: 'text', type: 'text' },
      { key: 'em', type: 'text', label: 'Emphasis' },
    ],
  },
};

/** Nested array editors — add / remove / reorder instead of leaf-only fallback. */
export const LIST_SPECS = {
  hero: [
    {
      key: 'ctas',
      label: 'CTAs',
      min: 0,
      create: () => ({ label: 'New CTA', href: '/', variant: 'primary' }),
      fields: [
        { key: 'label', type: 'text' },
        { key: 'href', type: 'text' },
        { key: 'variant', type: 'select', options: VARIANT_CTA },
      ],
    },
    {
      key: 'gallery',
      label: 'Gallery',
      min: 0,
      optional: true,
      create: () => ({
        src: 'https://res.cloudinary.com/dwfcofnrd/image/upload/website/tim-hero-square.png',
        alt: 'Gallery image',
        label: 'Shot',
      }),
      fields: [
        { key: 'src', type: 'url', label: 'Image URL' },
        { key: 'alt', type: 'text' },
        { key: 'label', type: 'text' },
      ],
    },
  ],
  'cta-strip': [
    {
      key: 'ctas',
      label: 'CTAs',
      min: 1,
      create: () => ({ label: 'New CTA', href: '/', variant: 'accent' }),
      fields: [
        { key: 'label', type: 'text' },
        { key: 'href', type: 'text' },
        { key: 'variant', type: 'select', options: VARIANT_STRIP },
      ],
    },
  ],
  'copy-blocks': [
    {
      key: 'items',
      label: 'Blocks',
      min: 1,
      create: () => ({
        label: 'New block',
        body: 'Placeholder body for this block.',
        style: 'serif',
      }),
      fields: [
        { key: 'label', type: 'text' },
        { key: 'body', type: 'textarea' },
        { key: 'style', type: 'select', options: ['serif', 'muted'] },
      ],
    },
  ],
  inventory: [
    {
      key: 'groups',
      label: 'Groups',
      min: 1,
      create: () => ({
        heading: 'New group',
        items: [{ name: 'New item', note: '' }],
      }),
      fields: [{ key: 'heading', type: 'text' }],
      nested: {
        key: 'items',
        label: 'Items',
        min: 1,
        create: () => ({ name: 'New item', note: '' }),
        fields: [
          { key: 'name', type: 'text' },
          { key: 'note', type: 'text' },
        ],
      },
    },
  ],
  'photo-grid': [
    {
      key: 'items',
      label: 'Photos',
      min: 1,
      create: () => ({
        src: 'https://res.cloudinary.com/dwfcofnrd/image/upload/website/tim-hero-square.png',
        alt: 'Photo',
        label: 'New shot',
        width: 1600,
        height: 900,
      }),
      fields: [
        { key: 'src', type: 'url', label: 'Image URL' },
        { key: 'alt', type: 'text' },
        { key: 'label', type: 'text' },
      ],
    },
  ],
  'topic-grid': [
    {
      key: 'items',
      label: 'Topics',
      min: 1,
      create: () => ({ title: 'New topic', body: 'Short description.' }),
      fields: [
        { key: 'title', type: 'text' },
        { key: 'body', type: 'textarea' },
      ],
    },
    {
      key: 'pills',
      label: 'Pills',
      min: 0,
      itemKind: 'string',
      create: () => 'New tag',
      fields: [{ key: '', type: 'text', label: 'Label' }],
    },
  ],
  factsheet: [
    {
      key: 'items',
      label: 'Facts',
      min: 1,
      create: () => ({ term: 'Term', value: 'Value' }),
      fields: [
        { key: 'term', type: 'text' },
        { key: 'value', type: 'text' },
        { key: 'href', type: 'text' },
      ],
    },
  ],
  faq: [
    {
      key: 'items',
      label: 'Questions',
      min: 1,
      create: () => ({
        question: 'New question?',
        answer: 'Short answer goes here.',
      }),
      fields: [
        { key: 'question', type: 'text' },
        { key: 'answer', type: 'textarea' },
      ],
    },
  ],
  timeline: [
    {
      key: 'items',
      label: 'Entries',
      min: 1,
      create: () => ({
        daterange: 'Year — Year',
        company: 'Company',
        title: 'Role',
        location: '',
        text: 'What you did here.',
      }),
      fields: [
        { key: 'daterange', type: 'text' },
        { key: 'company', type: 'text' },
        { key: 'title', type: 'text' },
        { key: 'location', type: 'text' },
        { key: 'url', type: 'text' },
        { key: 'text', type: 'textarea' },
      ],
    },
  ],
};

export const SKIP_LEAF =
  /\.(width|height|limit|columns|opacity|imageSize|kind|eager|preload|pagefindIgnore|hideWhenEmpty|equalWidth|featured|widths\.\d+)$/;
