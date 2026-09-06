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
    expect(operations).toHaveLength(6);
    for (const operation of operations) {
      expect(operation.operationId).toBeTruthy();
      expect(operation.description).toBeTruthy();
      // Every operation declares its input shape explicitly (even when empty)
      // so OpenAPI -> LLM function-calling converters see a typed schema.
      expect(Array.isArray(operation.parameters)).toBe(true);
      expect(operation.responses['200'].content['application/json'].schema).toBeTruthy();
      expect(operation.responses['400']).toBeTruthy();
      expect(operation.responses['404']).toBeTruthy();
      expect(operation.responses['429']).toBeTruthy();
      expect(operation.responses['500']).toBeTruthy();
      // Resolve BOTH reference levels; a response $ref is valid OpenAPI.
      for (const code of ['400', '404', '405', '429', '500']) {
        const ref = operation.responses[code].$ref;
        const response = spec.components.responses[ref.split('/').pop()];
        expect(response.content['application/problem+json'].schema.$ref).toBe('#/components/schemas/Problem');
        expect(spec.components.schemas.Problem.required).toEqual(expect.arrayContaining(['code', 'detail', 'status']));
      }
    }
  });

  test('versions endpoint publishes a live deprecation policy', async ({ request }) => {
    const response = await request.get('/api/v1/versions');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.current).toBe('v1');
    expect(body.versions).toContainEqual(
      expect.objectContaining({ version: 'v1', path: '/api/v1', deprecated: false }),
    );
    expect(body.policy.notice_period_days).toBeGreaterThan(0);
    expect(Array.isArray(body.policy.signals)).toBe(true);

    const index = await (await request.get('/api/v1')).json();
    expect(index.endpoints.versions).toBe('https://timbenniks.dev/api/v1/versions');

    const spec = await (await request.get('/openapi.json')).json();
    expect(spec.paths['/api/v1/versions'].get.operationId).toBe('getApiVersions');
    expect(spec['x-api-versioning'].policy).toBe('https://timbenniks.dev/api/v1/versions');
  });

  test('.well-known/mcp serves discovery over GET and a live handshake over POST', async ({ request }) => {
    const discovery = await request.get('/.well-known/mcp');
    expect(discovery.status()).toBe(200);
    const manifest = await discovery.json();
    expect(manifest.endpoint).toBe('https://timbenniks.dev/api/mcp');
    expect(manifest.handshake).toBe('https://timbenniks.dev/.well-known/mcp');

    const init = await request.post('/.well-known/mcp', {
      headers: { Accept: 'application/json, text/event-stream' },
      data: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } } },
    });
    expect(init.status()).toBe(200);
    const initBody = await init.json();
    expect(initBody.result.protocolVersion).toBe('2025-11-25');
    expect(initBody.result.serverInfo.name).toBe('timbenniks.dev');

    const list = await request.post('/.well-known/mcp', {
      headers: { Accept: 'application/json, text/event-stream' },
      data: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    });
    const listBody = await list.json();
    expect(Array.isArray(listBody.result.tools)).toBe(true);
    expect(listBody.result.tools.length).toBeGreaterThan(0);

    // /api/mcp still answers the same handshake identically.
    const apiInit = await request.post('/api/mcp', {
      headers: { Accept: 'application/json, text/event-stream' },
      data: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } } },
    });
    expect((await apiInit.json()).result.serverInfo.name).toBe('timbenniks.dev');
  });

  test('canonical HTML negotiates markdown and varies by Accept', async ({ request }) => {
    test.skip(!process.env.E2E_BASE_URL, 'Requires a production build: Vercel applies Accept rewrites to static HTML.');
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
    await expect(page.locator('footer a[href="/developers"]')).toHaveText('For developers');
  });
});
