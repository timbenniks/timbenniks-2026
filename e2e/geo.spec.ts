import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test.describe('GEO / agent surfaces', () => {
  test('llms.txt is a curated index with when-to-use guidance', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toMatch(/text\/plain/);
    const body = await res.text();
    expect(body).toContain('# Tim Benniks');
    expect(body).toContain('## When to use this site');
    expect(body).toContain('/agents.md');
    expect(body).toContain('/tools.json');
    expect(body).toContain('/content-index.json');
    expect(body).toContain('/developers');
    expect(body).toContain('/openapi.json');
    expect(body).toContain('/.well-known/mcp');
    expect(body).toContain('/contact');
    expect(body).toContain('/privacy');
  });

  test('agents.md documents remote and in-tab paths', async ({ request }) => {
    const res = await request.get('/agents.md');
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toMatch(/text\/markdown/);
    expect(res.headers()['vary']).toMatch(/Accept/i);
    const body = await res.text();
    expect(body).toContain('When to use this site');
    expect(body).toContain('search_site');
    expect(body).toContain('get_press_kit');
    expect(body).toContain('/tools.json');
    expect(body).toContain('/.well-known/mcp');
    expect(body).toContain('/developers');
  });

  test('vercel.json configures Accept rewrites and Vary headers', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      rewrites: Array<{ has?: Array<{ key: string; value: string }>; destination: string }>;
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const aboutRewrite = config.rewrites.find(
      (r) => r.destination === '/about.md' && r.has?.some((h) => h.value.includes('text/markdown')),
    );
    expect(aboutRewrite).toBeTruthy();
    const fallback404 = config.rewrites.find((r) => r.destination === '/404.md');
    expect(fallback404).toBeTruthy();
    const varyHeader = config.headers.some((h) =>
      h.headers.some((hdr) => hdr.key === 'Vary' && hdr.value.includes('Accept')),
    );
    expect(varyHeader).toBeTruthy();
  });

  test('about markdown twin is the negotiated content target', async ({ request }) => {
    const res = await request.get('/about.md');
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toMatch(/text\/markdown/);
    expect(res.headers()['vary']).toMatch(/Accept/i);
    expect(await res.text()).toMatch(/title:/);
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
    expect(body.mcp_discovery).toContain('/.well-known/mcp');
    expect(body.openapi).toContain('/openapi.json');
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

  test('MCP discovery handshake at /.well-known/mcp', async ({ request }) => {
    const res = await request.get('/.well-known/mcp');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.name).toBe('Tim Benniks');
    expect(body.endpoint).toContain('/api/mcp');
    expect(body.transport).toBe('streamable-http');
    expect(body.openapi).toContain('/openapi.json');
    expect(body.documentation).toContain('/developers');
  });

  test('OpenAPI spec describes Tim Benniks developer API', async ({ request }) => {
    const res = await request.get('/openapi.json');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toContain('Tim Benniks');
    expect(body.paths['/api/mcp']).toBeTruthy();
    expect(body.paths['/.well-known/mcp']).toBeTruthy();
  });

  test('MCP HTTP endpoint lists tools and executes search_site', async ({ request }) => {
    const listRes = await request.post('/api/mcp', {
      headers: { 'Content-Type': 'application/json' },
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(listRes.ok()).toBeTruthy();
    const listBody = await listRes.json();
    expect(listBody.result.tools.length).toBe(6);

    const callRes = await request.post('/api/mcp', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'get_press_kit', arguments: {} },
      },
    });
    expect(callRes.ok()).toBeTruthy();
    const callBody = await callRes.json();
    expect(callBody.result.content[0].text).toContain('https://linkedin.com/in/timbenniks');
    expect(callBody.result.content[0].text).not.toContain('booking_email');
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

  test('press-kit.json has bios and a contact link', async ({ request }) => {
    const res = await request.get('/press-kit.json');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.contact_url).toBe('https://linkedin.com/in/timbenniks');
    expect(body).not.toHaveProperty('booking_email');
    expect(Array.isArray(body.bios)).toBeTruthy();
    expect(body.bios.length).toBeGreaterThan(0);
    expect(Array.isArray(body.topics)).toBeTruthy();
  });

  test('static pages have markdown twins', async ({ request }) => {
    for (const path of [
      '/about.md',
      '/contact.md',
      '/privacy.md',
      '/developers.md',
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
      expect(res.headers()['vary']).toMatch(/Accept/i);
      const body = await res.text();
      expect(body.length).toBeGreaterThan(40);
    }
  });

  test('trust anchor pages have substantive content', async ({ request }) => {
    for (const path of ['/about', '/contact', '/privacy']) {
      const res = await request.get(path);
      expect(res.ok(), path).toBeTruthy();
      const html = await res.text();
      expect(html.length).toBeGreaterThan(500);
      expect(html).toContain('Tim Benniks');
    }
  });

  test('developers page is discoverable by name', async ({ request }) => {
    const res = await request.get('/developers');
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toContain('Tim Benniks');
    expect(html).toContain('Developer Resources');
    expect(html).toContain('/openapi.json');
    expect(html).toContain('/.well-known/mcp');
  });

  test('404 returns real status with agent recovery markdown twin', async ({ request }) => {
    const missing = '/some-path-that-does-not-exist-agent-test';
    const htmlRes = await request.get(missing);
    expect(htmlRes.status()).toBe(404);

    const mdRes = await request.get('/404.md');
    expect(mdRes.status()).toBe(404);
    expect(mdRes.headers()['content-type']).toMatch(/text\/markdown/);
    const body = await mdRes.text();
    expect(body).toContain('404');
    expect(body).toContain('/llms.txt');
    expect(body).toContain('/agents.md');
    expect(body).toContain('/sitemap.md');
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
