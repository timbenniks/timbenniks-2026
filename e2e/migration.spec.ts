import { test, expect } from '@playwright/test';

test('production legacy links redirect in both slash forms', async ({ request }) => {
  const playlists = [
    'alive-and-kicking', 'contentstack', 'headless-creator', 'hygraph',
    'live-contentstack', 'live-hygraph', 'live-uniform', 'misc-streams',
    'mp', 'tim', 'uniform',
  ];
  const pairs = [
    ...playlists.map((id) => [`/videos/${id}`, `/videos/playlist/${id}`]),
    ['/presskit', '/press-kit'],
    ['/videos/contentstack/014-rbbswown6s', '/videos/contentstack/014--rbbswown6s'],
    ['/videos/alive-and-kicking/004-4m4tij0z20', '/videos/alive-and-kicking/004--4m4tij0z20'],
    ['/articles/my-fitness-story', '/writing/my-fitness-story'],
  ];
  for (const [from, to] of pairs) {
    for (const suffix of ['', '/']) {
      const initial = await request.get(`${from}${suffix}?ref=migration`, { maxRedirects: 0 });
      expect([301, 308], `${from}${suffix}`).toContain(initial.status());
      const final = await request.get(`${from}${suffix}?ref=migration`);
      expect(final.status(), `${from}${suffix}`).toBe(200);
      expect(new URL(final.url()).pathname).toBe(to);
      expect(new URL(final.url()).searchParams.get('ref')).toBe('migration');
    }
  }
});

for (const type of ['writing', 'video']) {
  test(`search has clean ${type} metadata and fits a mobile viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/search?q=mcp&type=${type}`);
    const results = page.locator('#pf-results > li');
    await expect(results.first()).toBeVisible();
    const titles = await results.locator('h3').allTextContents();
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) expect(title).not.toMatch(/date:|image:https?:/);
    await expect(results.first().locator('time')).not.toBeEmpty();
    const image = results.first().locator('img');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  });
}

test('RSS preserves production article GUIDs without trailing slashes', async ({ request }) => {
  const response = await request.get('/feed.xml');
  expect(response.ok()).toBeTruthy();
  const xml = await response.text();
  const guids = [...xml.matchAll(/<guid\b[^>]*>([^<]+)<\/guid>/g)].map((m) => m[1]);
  expect(guids.length).toBeGreaterThan(0);
  expect(new Set(guids).size).toBe(guids.length);
  for (const guid of guids) expect(guid).toMatch(/^https:\/\/timbenniks\.dev\/writing\/[^/]+$/);
});

test('articles use Cloudinary images without visible Nuxt attributes', async ({ page, request }) => {
  const index = await (await request.get('/content-index.json')).json();
  for (const item of index.items.filter((item: { type: string }) => item.type === 'writing')) {
    const path = new URL(item.url).pathname;
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).not.toMatch(/\{provider=(?:&quot;|["“])/);
  }
  await page.goto('/writing/how-i-supercharched-my-websites-speed');
  const images = page.locator('article img[alt="Before and after"]');
  await expect(images).toHaveCount(2);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute('src', /^https:\/\/res\.cloudinary\.com\//);
    await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  }
});
