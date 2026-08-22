import { test, expect } from '@playwright/test';

test.describe('public agent API', () => {
  test('discovers the versioned REST API with rate-limit headers', async ({ request }) => {
    const response = await request.get('/api/v1');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.headers()['api-version']).toBe('1');
    expect(response.headers()['ratelimit']).toMatch(/^"public";r=\d+;t=\d+$/);
    expect(response.headers()['ratelimit-policy']).toBe('"public";q=120;w=60');

    const body = await response.json();
    expect(body).toMatchObject({ name: 'Tim Benniks Public API', version: 'v1', status: 'ok' });
  });

  test('search returns a typed result envelope', async ({ request }) => {
    const response = await request.get('/api/v1/search?query=developer%20experience&limit=2');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.engine).toBe('index');
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeLessThanOrEqual(2);
  });

  test('invalid search returns RFC 9457 JSON with a resolution hint', async ({ request }) => {
    const response = await request.get('/api/v1/search');
    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/problem+json');
    const body = await response.json();
    expect(body).toMatchObject({
      status: 400,
      code: 'MISSING_QUERY',
      instance: '/api/v1/search',
    });
    expect(body.resolution).toContain('/api/v1/search?query=');
  });

  test('unknown endpoint returns a machine-readable 404', async ({ request }) => {
    const response = await request.get('/api/v1/does-not-exist');
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/problem+json');
    const body = await response.json();
    expect(body.code).toBe('ENDPOINT_NOT_FOUND');
    expect(body.resolution).toContain('/openapi.json');
  });

  test('retrieves one page as markdown in JSON', async ({ request }) => {
    const response = await request.get('/api/v1/content/about');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.url).toBe('https://timbenniks.dev/about');
    expect(body.markdown).toContain('# ');
  });

  test('OpenAPI gives every operation typed success and error responses', async ({ request }) => {
    const response = await request.get('/openapi.json');
    expect(response.status()).toBe(200);
    const spec = await response.json();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('Tim Benniks Public API');
    expect(spec.components.schemas.Problem.required).toContain('resolution');

    const operations = Object.values(spec.paths).flatMap((path: any) =>
      Object.values(path).filter((operation: any) => operation?.operationId),
    ) as any[];
    expect(operations).toHaveLength(5);
    for (const operation of operations) {
      expect(operation.operationId).toBeTruthy();
      expect(operation.description).toBeTruthy();
      expect(operation.responses['200'].content['application/json'].schema).toBeTruthy();
      expect(operation.responses['400']).toBeTruthy();
      expect(operation.responses['404']).toBeTruthy();
      expect(operation.responses['429']).toBeTruthy();
      expect(operation.responses['500']).toBeTruthy();
    }
  });

  test('canonical HTML negotiates markdown and varies by Accept', async ({ request }) => {
    const markdown = await request.get('/about', { headers: { Accept: 'text/markdown' } });
    expect(markdown.status()).toBe(200);
    expect(markdown.headers()['content-type']).toContain('text/markdown');
    expect(markdown.headers()['vary']).toContain('Accept');
    expect(await markdown.text()).toContain('# ');

    const html = await request.get('/about', { headers: { Accept: 'text/html' } });
    expect(html.headers()['content-type']).toContain('text/html');
  });

  test('homepage links the developer resources', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer a[href="/developers"]')).toHaveText('Developer API');
  });
});
