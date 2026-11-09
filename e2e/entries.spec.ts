import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Entry editors for talks, projects, videos and articles.
 *
 * These specs stage and discard local drafts and call the preview API, but never
 * publish — the dev server writes publishes into the working tree.
 */

async function firstId(request: APIRequestContext, collection: string, query = ''): Promise<string> {
  const res = await request.get(`/api/admin/content/${collection}?limit=1${query}`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const id = body.items?.[0]?.id;
  expect(id, `${collection} has entries`).toBeTruthy();
  return id as string;
}

async function firstVideoId(request: APIRequestContext): Promise<string> {
  const playlist = await firstId(request, 'videos');
  return firstId(request, 'videos', `&playlist=${encodeURIComponent(playlist)}`);
}

async function clearDrafts(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('tb-admin-drafts');
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
}

test.describe('entry editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/changes');
    await clearDrafts(page);
  });

  for (const collection of ['speaking', 'projects', 'writing', 'videos'] as const) {
    test(`${collection}: an existing entry opens clean`, async ({ page, request }) => {
      const id = collection === 'videos' ? await firstVideoId(request) : await firstId(request, collection);
      await page.goto(`/admin/content/${collection}/${id}`);
      await expect(page.locator('#entry-form')).toBeVisible();
      await expect(page.locator('#entry-state')).toHaveText('Published');
      // Loading the published values must not count as an edit.
      await expect(page.locator('#save')).toBeDisabled();
    });
  }

  test('talk edit is staged, shown as a one-line diff, and discarded', async ({ page, request }) => {
    const id = await firstId(request, 'speaking');
    await page.goto(`/admin/content/speaking/${id}`);
    await page.locator('#f-location').fill('E2E City, Testland');
    await expect(page.locator('#save')).toBeEnabled();
    await page.locator('#save').click();
    await expect(page.locator('#status')).toContainText('Draft saved');
    await expect(page.locator('#entry-state')).toHaveText('Published · local draft');

    await page.goto('/admin/changes');
    const row = page.locator('#entries-list > li').first();
    await expect(row).toContainText('speaking');
    await expect(row).toContainText('+1 −1');
    await expect(page.locator('#publish')).toBeEnabled();

    page.on('dialog', (d) => void d.accept());
    await row.locator('.discard-entry').click();
    await expect(page.locator('#entries-panel')).toBeHidden();
    await expect(page.locator('#publish')).toBeDisabled();
  });

  test('new talk requires its required fields', async ({ page }) => {
    await page.goto('/admin/content/speaking/new');
    await page.locator('#f-talk').fill('Only a title');
    await page.locator('#save').click();
    await expect(page.locator('#status')).toContainText('Required');
    await expect(page).toHaveURL(/\/admin\/content\/speaking\/new$/);
  });

  test('new article gets a slug from its title and lands in Changes', async ({ page }) => {
    await page.goto('/admin/content/writing/new');
    await page.locator('#f-title').pressSequentially('E2E: A test article!');
    await expect(page.locator('#f-slug')).toHaveValue('e2e-a-test-article');
    await page.locator('#f-date').fill('2026-01-02');
    await page.locator('#f-_body').fill('Hello from the e2e suite.');
    await page.locator('#save').click();
    await expect(page.locator('#status')).toContainText('Draft saved');
    await expect(page).toHaveURL(/\/admin\/content\/writing\/e2e-a-test-article$/);

    await page.goto('/admin/changes');
    const row = page.locator('#entries-list > li').first();
    await expect(row).toContainText('src/content/writing/e2e-a-test-article.md');
    await expect(row).toContainText('new');
  });

  test('desk shows New buttons and project reorder controls', async ({ page }) => {
    await page.goto('/admin');
    for (const [hub, label] of [
      ['speaking', 'New talk'],
      ['projects', 'New project'],
      ['videos', 'New video'],
      ['writing', 'New article'],
    ] as const) {
      await expect(page.locator(`#panel-${hub} a.child-new`)).toHaveText(label);
    }
    await page.locator('[data-page-id="projects"] [data-expand]').click();
    await expect(page.locator('#panel-projects .child-row .reorder').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('entries API', () => {
  test('preview of an unchanged entry is a no-op', async ({ request }) => {
    const id = await firstId(request, 'writing');
    const entry = (await (await request.get(`/api/admin/entries/writing/${id}`)).json()).entry;
    const res = await request.post('/api/admin/entries/preview', {
      data: { entries: [{ collection: 'writing', op: 'upsert', id, data: entry.data, body: entry.body }] },
    });
    expect(res.ok()).toBeTruthy();
    const file = (await res.json()).files[0];
    expect(file.after).toBe(file.before);
    expect(file.related).toEqual([]);
  });

  test('preview rejects values the schema does not allow', async ({ request }) => {
    const id = await firstId(request, 'speaking');
    const res = await request.post('/api/admin/entries/preview', {
      data: { entries: [{ collection: 'speaking', op: 'upsert', id, data: { format: 'not-a-format' } }] },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('format');
  });

  test('renaming an article previews a move plus a redirect', async ({ request }) => {
    const id = await firstId(request, 'writing');
    const res = await request.post('/api/admin/entries/preview', {
      data: { entries: [{ collection: 'writing', op: 'upsert', id, data: { slug: `${id}-renamed-e2e` } }] },
    });
    expect(res.ok()).toBeTruthy();
    const file = (await res.json()).files[0];
    expect(file.path).toBe(`src/content/writing/${id}-renamed-e2e.md`);
    const related = file.related.map((r: { path: string }) => r.path);
    expect(related).toContain(`src/content/writing/${id}.md`);
    expect(related).toContain('src/data/writing-redirects.ts');
  });

  test('new entry names are reserved without writing', async ({ request }) => {
    const res = await request.post('/api/admin/entries/speaking', {
      data: { data: { conference: 'E2E Conf', date: '2031-05-06' } },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.id).toBe('2031-05-06-e2e-conf');
    const read = await request.get(`/api/admin/entries/speaking/${body.id}`);
    expect(read.status()).toBe(404);
  });

  test('unknown entry is a 404', async ({ request }) => {
    const res = await request.get('/api/admin/entries/projects/does-not-exist-e2e');
    expect(res.status()).toBe(404);
  });
});
