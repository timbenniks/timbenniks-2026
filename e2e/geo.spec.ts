import { test, expect } from '@playwright/test';

test.describe('GEO / agent surfaces', () => {
  test('llms.txt is a curated index', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toMatch(/text\/plain/);
    const body = await res.text();
    expect(body).toContain('# Tim Benniks');
    expect(body).toContain('/agents.md');
    expect(body).toContain('/tools.json');
    expect(body).toContain('/content-index.json');
  });

  test('agents.md documents remote and in-tab paths', async ({ request }) => {
    const res = await request.get('/agents.md');
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toMatch(/text\/markdown/);
    const body = await res.text();
    expect(body).toContain('search_site');
    expect(body).toContain('get_press_kit');
    expect(body).toContain('/tools.json');
  });

  test('tools.json lists the public catalog', async ({ request }) => {
    const res = await request.get('/tools.json');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const names = (body.tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).toEqual([
      'get_page_context',
      'search_site',
      'list_content',
      'get_content',
      'get_press_kit',
      'request_booking',
    ]);
  });

  test('well-known webmcp.json matches tools.json', async ({ request }) => {
    const [a, b] = await Promise.all([
      request.get('/tools.json'),
      request.get('/.well-known/webmcp.json'),
    ]);
    expect(a.ok()).toBeTruthy();
    expect(b.ok()).toBeTruthy();
    expect(await b.json()).toEqual(await a.json());
  });

  test('content-index.json has writing, videos, talks', async ({ request }) => {
    const res = await request.get('/content-index.json');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.counts.writing).toBeGreaterThan(0);
    expect(body.counts.video).toBeGreaterThan(0);
    expect(body.counts.talk).toBeGreaterThan(0);
    expect(
      body.items.some((i: { type: string; md?: string }) => i.type === 'writing' && i.md),
    ).toBeTruthy();
  });

  test('press-kit.json has bios and booking email', async ({ request }) => {
    const res = await request.get('/press-kit.json');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.booking_email).toBe('hi@timbenniks.dev');
    expect(Array.isArray(body.bios)).toBeTruthy();
    expect(body.bios.length).toBeGreaterThan(0);
    expect(Array.isArray(body.topics)).toBeTruthy();
  });

  test('static pages have markdown twins', async ({ request }) => {
    for (const path of [
      '/about.md',
      '/press-kit.md',
      '/speaking.md',
      '/uses.md',
      '/index.md',
      '/ai.md',
      '/livestreams.md',
      '/alive-and-kicking.md',
    ]) {
      const res = await request.get(path);
      expect(res.ok(), path).toBeTruthy();
      expect(res.headers()['content-type']).toMatch(/text\/markdown/);
      const body = await res.text();
      expect(body.length).toBeGreaterThan(40);
    }
  });

  test('AI readiness page links agent surfaces', async ({ page }) => {
    await page.goto('/ai');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Readable');
    await expect(page.getByRole('link', { name: 'AI readiness' })).toBeVisible();
    await expect(page.locator('a[href="/llms.txt"]').first()).toBeVisible();
    await expect(page.locator('a[href="/agents.md"]').first()).toBeVisible();
  });

  test('writing markdown twin matches content-index', async ({ request }) => {
    const index = await request.get('/content-index.json');
    const { items } = await index.json();
    const writing = items.find((i: { type: string; md?: string }) => i.type === 'writing' && i.md);
    expect(writing).toBeTruthy();
    const path = new URL(writing.md).pathname;
    const res = await request.get(path);
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toContain(writing.title);
    expect(body).toMatch(/^---/m);
  });

  test('Accept: text/markdown serves the about twin', async ({ request }) => {
    const res = await request.get('/about.md');
    expect(res.ok()).toBeTruthy();
    expect(await res.text()).toMatch(/title:/);
  });

  test('legacy live URLs redirect', async ({ request }) => {
    const pairs: Array<[string, string]> = [
      ['/presskit', '/press-kit'],
      ['/videos/tim', '/videos/playlist/tim'],
      ['/sitemap.xml', '/sitemap-index.xml'],
    ];
    for (const [from, to] of pairs) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status(), from).toBeGreaterThanOrEqual(300);
      expect(res.status(), from).toBeLessThan(400);
      const location = res.headers()['location'] ?? '';
      expect(location, from).toContain(to);
    }
  });

  test('livestreams and alive-and-kicking pages render', async ({ page }) => {
    await page.goto('/livestreams');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/alive-and-kicking');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('search form is annotated for WebMCP', async ({ page }) => {
    await page.goto('/search');
    const form = page.locator('#pf-form');
    await expect(form).toHaveAttribute('toolname', 'search_site');
    await expect(page.locator('#pf-input')).toHaveAttribute('name', 'q');
  });

  test('public WebMCP script exposes the catalog even without modelContext', async ({
    page,
  }) => {
    await page.goto('/');
    const state = await page.evaluate(() => {
      return (
        window as Window & {
          __tbPublicWebMcp?: { ready: boolean; tools: string[] };
        }
      ).__tbPublicWebMcp;
    });
    expect(state?.tools).toContain('search_site');
    expect(state?.tools).toContain('get_press_kit');
    expect(state?.ready).toBe(false);
  });
});
