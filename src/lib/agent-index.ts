import { getCollection } from 'astro:content';
import { siteUrl } from '../data/site';
import { loadAllSorted } from './collections';
import { pageMarkdownPath } from './markdown';
import { getPagePath, readPagesFile } from './admin/pages-store';
import { cleanVideoDescription } from './video-description';

export type AgentIndexType = 'writing' | 'video' | 'talk' | 'project' | 'page';

export interface AgentIndexItem {
  type: AgentIndexType;
  id: string;
  title: string;
  date?: string;
  description?: string;
  tags?: string[];
  url: string;
  md?: string;
  conference?: string;
  location?: string;
  link?: string;
}

export interface AgentIndex {
  generated: string;
  source: string;
  counts: Record<AgentIndexType, number>;
  items: AgentIndexItem[];
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function buildAgentIndex(): Promise<AgentIndex> {
  const [{ writing, videos, speaking }, projects, pages] = await Promise.all([
    loadAllSorted(),
    getCollection('projects'),
    readPagesFile(),
  ]);

  const items: AgentIndexItem[] = [];

  for (const e of writing) {
    items.push({
      type: 'writing',
      id: e.id,
      title: e.data.title,
      date: ymd(e.data.date),
      description: e.data.description,
      tags: e.data.tags,
      url: siteUrl(`/writing/${e.id}`),
      md: siteUrl(`/writing/${e.id}.md`),
    });
  }

  for (const e of videos) {
    items.push({
      type: 'video',
      id: e.id,
      title: e.data.title,
      date: ymd(e.data.date),
      description: cleanVideoDescription(e.data.description),
      tags: e.data.tags,
      url: siteUrl(`/videos/${e.id}`),
      md: siteUrl(`/videos/${e.id}.md`),
    });
  }

  for (const e of speaking) {
    items.push({
      type: 'talk',
      id: e.id,
      title: e.data.talk,
      date: ymd(e.data.date),
      description: e.data.conference,
      conference: e.data.conference,
      location: e.data.location,
      link: e.data.link,
      url: siteUrl('/speaking'),
      md: siteUrl('/speaking.md'),
    });
  }

  for (const e of [...projects].sort((a, b) => a.data.order - b.data.order)) {
    items.push({
      type: 'project',
      id: e.id,
      title: e.data.title,
      description: e.data.description,
      url: siteUrl(`/projects/${e.id}`),
      md: siteUrl(`/projects/${e.id}.md`),
    });
  }

  for (const [id, page] of Object.entries(pages)) {
    const path = getPagePath(page, id);
    items.push({
      type: 'page',
      id,
      title: page.metadata.title,
      description: page.metadata.description,
      url: siteUrl(path),
      md: siteUrl(pageMarkdownPath(path)),
    });
  }

  const counts = {
    writing: items.filter((i) => i.type === 'writing').length,
    video: items.filter((i) => i.type === 'video').length,
    talk: items.filter((i) => i.type === 'talk').length,
    project: items.filter((i) => i.type === 'project').length,
    page: items.filter((i) => i.type === 'page').length,
  };

  return {
    generated: new Date().toISOString(),
    source: siteUrl('/content-index.json'),
    counts,
    items,
  };
}
