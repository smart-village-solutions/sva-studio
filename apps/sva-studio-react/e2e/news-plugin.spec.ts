import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

type NewsRecord = {
  id: string;
  title: string;
  contentType: 'news.article';
  status: 'published';
  author: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  categoryName?: string;
  payload: {
    teaser?: string;
    body?: string;
    imageUrl?: string;
    externalUrl?: string;
    category?: string;
  };
  contentBlocks?: readonly {
    readonly title?: string;
    readonly intro?: string;
    readonly body?: string;
  }[];
};

const authenticatedUser = {
  user: {
    id: 'kc-editor-1',
    name: 'Editor One',
    email: 'editor@example.com',
    instanceId: 'de-musterhausen',
    assignedModules: ['news'],
    roles: ['editor'],
    assignedModules: ['news'],
    permissionActions: ['news.read', 'news.create', 'news.update', 'news.delete'],
  },
};
const permissionPayload = {
  instanceId: 'de-musterhausen',
  permissions: [
    { action: 'news.read', resourceType: 'news' },
    { action: 'news.create', resourceType: 'news' },
    { action: 'news.update', resourceType: 'news' },
    { action: 'news.delete', resourceType: 'news' },
  ],
  subject: {
    actorUserId: 'kc-editor-1',
    effectiveUserId: 'kc-editor-1',
    isImpersonating: false,
  },
  evaluatedAt: '2026-04-13T12:00:00.000Z',
};

const navigateClientSide = async (page: Page, targetPath: string) => {
  await page.waitForFunction(() => {
    return Boolean(
      (
        window as typeof window & {
          __SVA_PLAYWRIGHT_ROUTER__?: {
            navigate: (options: { to: string }) => Promise<void> | void;
          };
        }
      ).__SVA_PLAYWRIGHT_ROUTER__
    );
  });

  await page.evaluate(async (path) => {
    const router = (
      window as typeof window & {
        __SVA_PLAYWRIGHT_ROUTER__?: {
          navigate: (options: { to: string }) => Promise<void> | void;
        };
      }
    ).__SVA_PLAYWRIGHT_ROUTER__;

    if (!router) {
      throw new Error('Playwright router hook fehlt.');
    }

    await router.navigate({ to: path });
  }, targetPath);
};

const expectPluginPageHeading = async (page: Page, pattern: RegExp) => {
  await expect(page.locator('main h1').filter({ hasText: pattern })).toBeVisible();
};

const expectNewsListUrl = async (page: Page) => {
  await expect(page).toHaveURL(/\/admin\/news\?(?:.*&)?page=1(?:&.*)?$/);
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

const createPagination = (total: number) => ({
  page: 1,
  pageSize: 25,
  hasNextPage: false,
  total,
});

const fulfillContentRoute = async (
  route: Route,
  newsItems: NewsRecord[],
  input: { createdId?: string; updatedId?: string } = {}
) => {
  const request = route.request();
  const method = request.method();
  const url = new URL(request.url());
  const path = url.pathname;

  if (method === 'GET' && path === '/api/v1/mainserver/news') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: newsItems, pagination: createPagination(newsItems.length) }),
    });
    return;
  }

  const detailMatch = path.match(/^\/api\/v1\/mainserver\/news\/([^/]+)$/);
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
      contentType: 'news.article',
      status: 'published',
      publishedAt: typeof body.publishedAt === 'string' ? body.publishedAt : '2026-04-13T12:10:00.000Z',
      categoryName: typeof body.categoryName === 'string' ? body.categoryName : undefined,
      payload: {},
      contentBlocks: Array.isArray(body.contentBlocks) ? (body.contentBlocks as NewsRecord['contentBlocks']) : [],
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
    item.publishedAt = typeof body.publishedAt === 'string' ? body.publishedAt : item.publishedAt;
    item.categoryName = typeof body.categoryName === 'string' ? body.categoryName : item.categoryName;
    item.contentBlocks = Array.isArray(body.contentBlocks) ? (body.contentBlocks as NewsRecord['contentBlocks']) : item.contentBlocks;
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
    let createdBody: Record<string, unknown> | undefined;

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

    await page.route('**/api/v1/mainserver/news**', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: newsItems, pagination: createPagination(newsItems.length) }),
        });
        return;
      }

      const body = request.postDataJSON() as Record<string, unknown>;
      createdBody = body;
      newsItems.push({
        id: 'news-1',
        title: String(body.title),
        contentType: 'news.article',
        status: 'published',
        publishedAt: typeof body.publishedAt === 'string' ? body.publishedAt : '2026-04-13T12:10:00.000Z',
        categoryName: typeof body.categoryName === 'string' ? body.categoryName : undefined,
        payload: {},
        contentBlocks: Array.isArray(body.contentBlocks) ? (body.contentBlocks as NewsRecord['contentBlocks']) : [],
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

    await page.route('**/api/v1/mainserver/news/*', async (route) => {
      await fulfillContentRoute(route, newsItems);
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();

    await page.getByRole('link', { name: 'News' }).click();
    await expectNewsListUrl(page);
    await expectPluginPageHeading(page, /News|news\.list\.title/);

    await page.locator('a[href="/admin/news/new"]').click();
    await expect(page).toHaveURL(/\/admin\/news\/new$/);
    await expectPluginPageHeading(page, /News-Eintrag anlegen|news\.editor\.createTitle/);

    await page.getByLabel(/Titel|news\.fields\.title/).fill('Erste News');
    await page.locator('#news-author').fill('Redaktion Musterhausen');
    await page.locator('#news-keywords').fill('stadt, kultur');
    await page.locator('#news-external-id').fill('cms-42');
    await page.locator('#news-type').fill('press_release');
    await page.getByLabel(/Einleitung|news\.fields\.blockIntro/).fill('Kurztext');
    await page.getByLabel(/Inhalt|news\.fields\.blockBody/).fill('<p>Inhalt</p>');
    await page.getByRole('textbox', { name: 'Kategorie', exact: true }).fill('Allgemein');
    await page.locator('#news-categories').fill('Allgemein\nKultur');
    await page.locator('#news-source-url').fill('https://example.com/news/source');
    await page.locator('#news-source-description').fill('Quellseite');
    await page.locator('#news-address-street').fill('Marktplatz 1');
    await page.locator('#news-address-zip').fill('12345');
    await page.locator('#news-address-city').fill('Musterhausen');
    await page.locator('#news-poi').fill('poi-1');
    await page.getByLabel(/Veröffentlichungsdatum|news\.fields\.publishedAt/).fill('2026-04-14T09:30');
    await page.locator('#news-publication-date').fill('2026-04-14T08:30');
    await page.getByRole('button', { name: /Medium hinzufügen|news\.actions\.addMedia/ }).click();
    await page.locator('#news-media-url-0-0').fill('https://example.com/news/image.jpg');
    await page.locator('#news-media-caption-0-0').fill('Titelbild');
    await page.getByRole('button', { name: /News anlegen|news\.actions\.create/ }).click();

    await expectNewsListUrl(page);
    await expect(page.locator('main table').getByText('Erste News')).toBeVisible();
    expect(createdBody).toMatchObject({
      title: 'Erste News',
      author: 'Redaktion Musterhausen',
      keywords: 'stadt, kultur',
      externalId: 'cms-42',
      newsType: 'press_release',
      categoryName: 'Allgemein',
      sourceUrl: { url: 'https://example.com/news/source', description: 'Quellseite' },
      address: { street: 'Marktplatz 1', zip: '12345', city: 'Musterhausen' },
      pointOfInterestId: 'poi-1',
    });
    expect(createdBody?.categories).toEqual([{ name: 'Allgemein' }, { name: 'Kultur' }]);
    expect(createdBody?.contentBlocks).toEqual([
      {
        intro: 'Kurztext',
        body: '<p>Inhalt</p>',
        mediaContents: [
          {
            captionText: 'Titelbild',
            contentType: 'image',
            sourceUrl: { url: 'https://example.com/news/image.jpg' },
          },
        ],
      },
    ]);

    await page.getByRole('link', { name: /Bearbeiten|news\.actions\.edit/ }).click();
    await expectPluginPageHeading(page, /News-Eintrag bearbeiten|news\.editor\.editTitle/);

    await page.getByLabel(/Titel|news\.fields\.title/).fill('Erste News aktualisiert');
    await page.getByRole('button', { name: /Änderungen speichern|news\.actions\.save/ }).click();
    await expect(page.getByRole('status')).toContainText(/gespeichert|aktualisiert|news\.messages\.updateSuccess/);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Löschen|news\.actions\.delete/ }).click();

    await expectNewsListUrl(page);
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

    await page.route('**/api/v1/mainserver/news**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: newsItems, pagination: createPagination(newsItems.length) }),
      });
    });

    await page.goto('/');
    await expect(page.locator('a[href="/admin/news"]')).toBeVisible();

    await page.locator('a[href="/admin/news"]').focus();
    await page.keyboard.press('Enter');

    await expectNewsListUrl(page);
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
    await navigateClientSide(page, '/admin/news');

    await expect(page).toHaveURL(/\/auth\/login\?returnTo=%2Fadmin%2Fnews/);
  });

  test('stays free of serious accessibility violations on news views', async ({ page }) => {
    const newsItems: NewsRecord[] = [
      {
        id: 'news-1',
        title: 'A11y News',
        contentType: 'news.article',
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

    await page.route('**/api/v1/mainserver/news**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: newsItems, pagination: createPagination(newsItems.length) }),
      });
    });

    await page.route('**/api/v1/mainserver/news/*', async (route) => {
      await fulfillContentRoute(route, newsItems);
    });

    await page.goto('/');
    await navigateClientSide(page, '/admin/news');
    await expectPluginPageHeading(page, /News|news\.list\.title/);
    const listViolations = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(listViolations.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);

    await navigateClientSide(page, '/admin/news/new');
    await expectPluginPageHeading(page, /News-Eintrag anlegen|news\.editor\.createTitle/);
    const createViolations = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(createViolations.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);

    await navigateClientSide(page, '/admin/news/news-1');
    await expectPluginPageHeading(page, /News-Eintrag bearbeiten|news\.editor\.editTitle/);
    const editViolations = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(editViolations.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);
  });
});
