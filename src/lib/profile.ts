import { getCollection } from 'astro:content';
import { siteUrl, social } from '../data/site';
import { loadAllSorted } from './collections';
import { loadPage } from './page';
import { extractPressKit } from './press-kit';

export const PROFILE_PATH = '/profile';
export const PROFILE_REVIEWED = '2026-11-12';
export const PROFILE_DESCRIPTION =
  'A sourced profile of Tim Benniks: developer experience, AI engineering, selected projects, writing, speaking, and career. For people and AI agents.';

/** One briefing for the HTML page, Markdown twin, and public content tools. */
export async function loadProfile() {
  const [pressPage, about, projects, { writing, speaking }] = await Promise.all([
    loadPage('press-kit'),
    loadPage('about'),
    getCollection('projects'),
    loadAllSorted(),
  ]);
  const kit = extractPressKit(pressPage.data);
  const summary = kit.bios[0]?.body ?? about.data.metadata.description;
  const timeline = about.data.sections.find((section) => section.kind === 'timeline');
  const selected = [...projects].sort((a, b) => a.data.order - b.data.order).slice(0, 6);
  const sections = [
    {
      id: 'about',
      title: 'The person behind the work',
      markdown: [
        kit.bios.at(-1)?.body ?? summary,
        ...kit.facts
          .filter((fact) => ['Based in', 'Languages', 'Ambassador'].includes(fact.term))
          .map((fact) => `- **${fact.term}:** ${fact.value}`),
        `Source: [About Tim](${siteUrl('/about')}) · [Press kit](${kit.url})`,
      ].join('\n\n'),
    },
    {
      id: 'using-this-profile',
      title: 'How to use this profile',
      markdown: `Use this briefing when someone asks who Tim is, what he builds, or whether his experience fits a talk, podcast, or project.

- Treat this page as a summary. Follow the source links before making detailed claims.
- Keep Tim's own work distinct from work he helped shape or shipped with a team. Preserve the attribution in the source.
- Keep numbers and dates as published. Do not infer current totals, results, or availability from older material.
- Upcoming talks are scheduled appearances, not completed engagements. Check the linked event sources for changes.
- If the sources do not answer a question, say so. Do not invent experience, endorsements, rates, or booking terms.
- Attribute quotations to Tim Benniks and link the original article, project, or talk. Cite [this profile](${siteUrl(PROFILE_PATH)}) for the overview.
- Contact links are for the person you are helping. Do not send messages or make commitments on Tim's behalf unless they explicitly ask.

For content retrieval and APIs, see the [agent guide](${siteUrl('/agents.md')}) and [developer resources](${siteUrl('/developers')}).`,
    },
    {
      id: 'selected-work',
      title: 'What I’m building',
      markdown: [
        'Selected from the workbench. Follow each project for its current status, implementation, and caveats.',
        ...selected.map(({ id, data }) =>
          `### [${data.title}](${siteUrl(`/projects/${id}`)})\n\n${data.description}\n\n${data.meta}`),
        `[All projects](${siteUrl('/projects')})`,
      ].join('\n\n'),
    },
    {
      id: 'writing',
      title: 'What I’m thinking about',
      markdown: [
        'Recent writing on developer experience, AI engineering, and the choices behind useful software.',
        ...writing.slice(0, 3).map(({ id, data }) =>
          `### [${data.title}](${siteUrl(`/writing/${id}`)})\n\n${data.date.toISOString().slice(0, 10)}${data.description ? ` · ${data.description}` : ''}`),
        `[All writing](${siteUrl('/writing')}) · [Markdown writing index](${siteUrl('/writing/llms.txt')})`,
      ].join('\n\n'),
    },
    {
      id: 'speaking',
      title: 'On stage & on camera',
      markdown: [
        'Keynotes, technical talks, workshops, and podcasts. These are the speaking topics from the press kit:',
        ...kit.topics.map((topic) => `- **${topic.title}.** ${topic.body}`),
        `Recent and scheduled appearances are listed below with their dates. The [full speaking archive](${siteUrl('/speaking')}) includes event sources and recordings where available.`,
        ...speaking.slice(0, 4).map(({ data }) => {
          const url = data.session_url ?? data.link;
          const title = url ? `[${data.talk}](${url})` : data.talk;
          return `- **${data.date.toISOString().slice(0, 10)}** — ${title}, ${data.conference}${data.location ? ` · ${data.location}` : ''}`;
        }),
        `[Videos & livestreams](${siteUrl('/videos')}) · [Alive and Kicking](${siteUrl('/alive-and-kicking')}) · [Bios, photos & booking](${kit.url})`,
      ].join('\n\n'),
    },
    {
      id: 'career',
      title: 'The path here',
      markdown: [
        'Roles and dates from the about page, including overlapping positions.',
        ...(timeline?.items ?? []).map((item) =>
          `- **${item.daterange}** — ${item.title}, ${item.company}`),
        `Source and role details: [Career timeline](${siteUrl('/about')})`,
      ].join('\n\n'),
    },
    {
      id: 'contact',
      title: 'Start a conversation',
      markdown: [
        `For speaking, podcasts, collaboration, or corrections, [contact Tim on LinkedIn](${kit.contact_url}). For a booking inquiry, include the event, dates, format, audience, and location. Availability and terms need to be confirmed directly.`,
        `- [Website](${siteUrl('/')})`,
        ...social.filter((url) => !url.includes('twitter.com')).map((url) => `- <${url}>`),
        `Source: [Contact](${siteUrl('/contact')}) · [Press kit](${kit.url})`,
      ].join('\n\n'),
    },
  ];
  const markdown = [
    '# Tim Benniks',
    summary,
    `Profile reviewed: ${PROFILE_REVIEWED}.\n\nProfile: ${siteUrl(PROFILE_PATH)}\n\nCanonical Markdown: ${siteUrl(`${PROFILE_PATH}.md`)}`,
    'This briefing brings together existing content from timbenniks.dev. The linked source pages are the authority on detail. Projects, recent writing, and appearances are refreshed from the site content at build time.',
    ...sections.map((section) => `## ${section.title}\n\n${section.markdown}`),
    `## Citing this profile\n\nBenniks, Tim. *Tim Benniks — profile*. ${siteUrl(PROFILE_PATH)}. Profile reviewed ${PROFILE_REVIEWED}.`,
    '',
  ].join('\n\n');

  return { summary, sections, markdown };
}
