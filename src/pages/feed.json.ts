import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { seo, siteUrl, social, SITE_URL } from '../data/site';

export const GET: APIRoute = async () => {
  const posts = (await getCollection('writing', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: seo.siteName,
    home_page_url: `${SITE_URL}/`,
    feed_url: siteUrl('/feed.json'),
    description:
      'Writing on developer experience, AI-accelerated engineering, and composable platforms.',
    language: seo.locale,
    icon: seo.defaultImage,
    favicon: siteUrl('/favicon.svg'),
    authors: [
      {
        name: 'Tim Benniks',
        url: `${SITE_URL}/`,
        avatar:
          'https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,w_512,h_512,c_thumb/Tim/timreal.png',
      },
    ],
    user_comment:
      'A markdown twin of every entry is available at /writing/<slug>.md, or by requesting the canonical URL with Accept: text/markdown.',
    items: posts.map((post) => {
      const url = siteUrl(`/writing/${post.id}`);
      return {
        id: url,
        url,
        external_url: post.data.canonical_url,
        title: post.data.title,
        content_text: post.data.description ?? post.data.title,
        summary: post.data.description,
        date_published: post.data.date.toISOString(),
        tags: post.data.tags,
        image: post.data.image,
        _markdown: { url: siteUrl(`/writing/${post.id}.md`) },
      };
    }),
    _social: [...social],
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' },
  });
};
