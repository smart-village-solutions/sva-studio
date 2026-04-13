import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

type NewsRecord = {
  id: string;
  title: string;
  contentType: 'news';
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
  author: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  payload: {
    teaser: string;
    body: string;
    imageUrl?: string;
    externalUrl?: string;
    category?: string;
  };
};

const authenticatedUser = {
  user: {
    id: 'kc-editor-1',
    name: 'Editor One',
    email: 'editor@example.com',
    instanceId: 'de-musterhausen',
    roles: ['editor'],
  },
};

const permissionPayload = {
  instanceId: 'de-musterhausen',
  permissions: [
    { action: 'content.read', resourceType: 'content' },
    { action: 'content.create', resourceType: 'content' },
    { action: 'content.write', resourceType: 'content' },
  ],
  subject: {
    actorUserId: 'kc-editor-1',
    effectiveUserId: 'kc-editor-1',
    isImpersonating: false,
  },
  evaluatedAt: '2026-04-13T12:00:00.000Z',
};

const navigateClientSide = async (page: Page, targetPath: string) => {
  await page.evaluate((path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, targetPath);
};

const expectPluginPageHeading = async (page: Page, pattern: RegExp) => {
  await expect(page.locator('main h1').filter({ hasText: pattern })).toBeVisible();
};

const mockSharedShellRequests = async (page: Page) => {
  await page.route('**/iam/authorize', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ allowed: true, reason: 'mocked_authorize' }),
    });
  });

  await page.route('**/iam/me/legal-texts/pending', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: { page: 1, pageSize: 0, total: 0 },
      }),
    });
  });

  await page.route('**/api/v1/iam/me/context', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          activeOrganizationId: null,
          organizations: [],
        },
      }),
    });
  });
};

const fulfillContentRoute = async (
  route: Route,
  newsItems: NewsRecord[],
  input: { createdId?: string; updatedId?: string } = {}
) => {
  const request = route.request();
  const method = request.method();
  const url = new URL(request.url());
  const path = url.pathname;

  if (method === 'GET' && path === '/api/v1/iam/contents') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: newsItems }),
    });
    return;
  }

  const detailMatch = path.match(/^\/api\/v1\/iam\/contents\/([^/]+)$/);
  if (!detailMatch) {
    await route.fallback();
    return;
  }

  const contentId = detailMatch[1];
  if (!contentId) {
    await route.fallback();
    return;
  }

  if (method === 'GET') {
    const item = newsItems.find((entry) => entry.id === contentId);
    await route.fulfill({
      status: item ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(item ? { data: item } : { error: 'not_found' }),
    });
    return;
  }

  if (method === 'POST') {
    const body = request.postDataJSON() as Record<string, unknown>;
    const createdId = input.createdId ?? 'news-created';
    newsItems.push({
      id: createdId,
      title: String(body.title),
      contentType: 'news',
      status: body.status as NewsRecord['status'],
      publishedAt: typeof body.publishedAt === 'string' ? body.publishedAt : undefined,
      payload: body.payload as NewsRecord['payload'],
      author: 'Editor One',
      createdAt: '2026-04-13T12:10:00.000Z',
      updatedAt: '2026-04-13T12:10:00.000Z',
    });
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: newsItems[newsItems.length - 1] }),
    });
    return;
  }

  if (method === 'PATCH') {
    const body = request.postDataJSON() as Record<string, unknown>;
    const item = newsItems.find((entry) => entry.id === contentId);
    if (!item) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) });
      return;
    }
    item.title = String(body.title ?? item.title);
    item.status = (body.status as NewsRecord['status']) ?? item.status;
    item.publishedAt = typeof body.publishedAt === 'string' ? body.publishedAt : item.publishedAt;
    item.payload = (body.payload as NewsRecord['payload']) ?? item.payload;
    item.updatedAt = '2026-04-13T12:20:00.000Z';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: item }),
    });
    return;
  }

  if (method === 'DELETE') {
    const index = newsItems.findIndex((entry) => entry.id === contentId);
    if (index >= 0) {
      newsItems.splice(index, 1);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: contentId } }),
    });
  }
};

test.describe('news plugin', () => {
  test.beforeEach(async ({ page }) => {
    await mockSharedShellRequests(page);
  });

  test('supports news CRUD including delete', async ({ page }) => {
    const newsItems: NewsRecord[] = [];

    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authenticatedUser),
      });
    });

    await page.route('**/iam/me/permissions?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(permissionPayload),
      });
    });

    await page.route('**/api/v1/iam/contents', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: newsItems }),
        });
        return;
      }

      const body = request.postDataJSON() as Record<string, unknown>;
      newsItems.push({
        id: 'news-1',
        title: String(body.title),
        contentType: 'news',
        status: body.status as NewsRecord['status'],
        publishedAt: typeof body.publishedAt === 'string' ? body.publishedAt : undefined,
        payload: body.payload as NewsRecord['payload'],
        author: 'Editor One',
        createdAt: '2026-04-13T12:10:00.000Z',
        updatedAt: '2026-04-13T12:10:00.000Z',
      });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: newsItems[0] }),
      });
    });

    await page.route('**/api/v1/iam/contents/*', async (route) => {
      await fulfillContentRoute(route, newsItems);
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();

    await page.getByRole('link', { name: 'News' }).click();
    await expect(page).toHaveURL(/\/plugins\/news$/);
    await expectPluginPageHeading(page, /News|news\.list\.title/);

    await page.locator('a[href="/plugins/news/new"]').click();
    await expect(page).toHaveURL(/\/plugins\/news\/new$/);
    await expectPluginPageHeading(page, /News-Eintrag anlegen|news\.editor\.createTitle/);

    await page.getByLabel(/Titel|news\.fields\.title/).fill('Erste News');
    await page.getByLabel(/Teaser|news\.fields\.teaser/).fill('Kurztext');
    await page.getByLabel(/Inhalt \(HTML\)|news\.fields\.body/).fill('<p>Inhalt</p>');
    await page.getByLabel(/Kategorie|news\.fields\.category/).fill('Allgemein');
    await page.getByRole('button', { name: /News anlegen|news\.actions\.create/ }).click();

    await expect(page).toHaveURL(/\/plugins\/news$/);
    await expect(page.getByText('Erste News')).toBeVisible();

    await page.getByRole('link', { name: /Bearbeiten|news\.actions\.edit/ }).click();
    await expectPluginPageHeading(page, /News-Eintrag bearbeiten|news\.editor\.editTitle/);

    await page.getByLabel(/Titel|news\.fields\.title/).fill('Erste News aktualisiert');
    await page.getByRole('button', { name: /Änderungen speichern|news\.actions\.save/ }).click();
    await expect(page.getByRole('status')).toContainText(/gespeichert|news\.messages\.updateSuccess/);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Löschen|news\.actions\.delete/ }).click();

    await expect(page).toHaveURL(/\/plugins\/news$/);
    await expect(page.getByText(/Noch keine News vorhanden|news\.empty\.title/)).toBeVisible();
  });

  test('shows the news entry in the shell and supports keyboard navigation', async ({ page }) => {
    const newsItems: NewsRecord[] = [];

    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authenticatedUser),
      });
    });

    await page.route('**/iam/me/permissions?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(permissionPayload),
      });
    });

    await page.route('**/api/v1/iam/contents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: newsItems }),
      });
    });

    await page.goto('/');
    await expect(page.locator('a[href="/plugins/news"]')).toBeVisible();

    await page.locator('a[href="/plugins/news"]').focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/plugins\/news$/);
    await expectPluginPageHeading(page, /News|news\.list\.title/);
  });

  test('blocks unauthenticated access to plugin routes', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unauthorized' }),
      });
    });

    await page.goto('/');
    await navigateClientSide(page, '/plugins/news');

    await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Fplugins%2Fnews/);
  });

  test('stays free of serious accessibility violations on news views', async ({ page }) => {
    const newsItems: NewsRecord[] = [
      {
        id: 'news-1',
        title: 'A11y News',
        contentType: 'news',
        status: 'published',
        author: 'Editor One',
        createdAt: '2026-04-13T12:10:00.000Z',
        updatedAt: '2026-04-13T12:10:00.000Z',
        payload: {
          teaser: 'Kurztext',
          body: '<p>Inhalt</p>',
          category: 'Allgemein',
        },
      },
    ];

    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authenticatedUser),
      });
    });

    await page.route('**/iam/me/permissions?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(permissionPayload),
      });
    });

    await page.route('**/api/v1/iam/contents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: newsItems }),
      });
    });

    await page.route('**/api/v1/iam/contents/*', async (route) => {
      await fulfillContentRoute(route, newsItems);
    });

    await page.goto('/');
    await navigateClientSide(page, '/plugins/news');
    await expectPluginPageHeading(page, /News|news\.list\.title/);
    const listViolations = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(listViolations.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);

    await navigateClientSide(page, '/plugins/news/new');
    await expectPluginPageHeading(page, /News-Eintrag anlegen|news\.editor\.createTitle/);
    const createViolations = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(createViolations.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);

    await navigateClientSide(page, '/plugins/news/news-1');
    await expectPluginPageHeading(page, /News-Eintrag bearbeiten|news\.editor\.editTitle/);
    const editViolations = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(editViolations.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);
  });
});
