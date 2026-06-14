import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

import { createEmptyPaginatedDataResponse, gotoHomeAsAuthenticatedUser, gotoShellRoot } from './studio-shell.helpers';

type NewsRecord = {
  id: string;
  title: string;
  contentType: 'news.article';
  status: 'published';
  author: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  visible?: boolean;
  categories?: readonly { readonly name: string }[];
  sourceUrl?: {
    readonly url?: string;
    readonly description?: string;
  };
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

const expectNewsEditorReady = async (page: Page, mode: 'create' | 'edit') => {
  await expectPluginPageHeading(
    page,
    mode === 'create'
      ? /News-Eintrag anlegen|news\.editor\.createTitle/
      : /News-Eintrag bearbeiten|news\.editor\.editTitle/
  );
  await expect(page.locator('#news-title')).toBeVisible();
};

const expectContentOverviewUrl = async (page: Page) => {
  await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/);
};

const expectContentOverviewReady = async (page: Page) => {
  await expectContentOverviewUrl(page);
  await expect(page.locator('#main-content')).toBeVisible();
  await Promise.any([
    page
      .getByRole('heading', {
        name: /Inhalte|Inhaltsliste|content\.page\.title|content\.table\.sectionTitle/,
      })
      .first()
      .waitFor({ state: 'visible' }),
    page.getByRole('button', { name: /Neuer Inhalt|content\.actions\.create/ }).waitFor({ state: 'visible' }),
    page.getByRole('link', { name: /Neuer Inhalt|content\.actions\.create/ }).waitFor({ state: 'visible' }),
    page.getByRole('table', { name: /Inhalte|content\.table\.ariaLabel/ }).waitFor({ state: 'visible' }),
    page.getByText(/Noch keine Inhalte vorhanden|content\.empty\.title/).waitFor({ state: 'visible' }),
  ]);
};

const expectLoginRedirect = async (page: Page, returnToPattern: RegExp) => {
  await page.waitForFunction(() => {
    const { pathname, search } = window.location;
    return (
      pathname === '/' ||
      pathname === '/auth/login' ||
      search.startsWith('?auth=login&returnTo=') ||
      search.startsWith('?auth=dev-login&returnTo=') ||
      search.startsWith('?auth=mock-login&returnTo=')
    );
  });

  const loginUrl = new URL(page.url());
  if (loginUrl.pathname === '/') {
    return;
  }

  await expect(page).toHaveURL(/\/(?:\?auth=(?:login|dev-login|mock-login)&returnTo=|auth\/login\?returnTo=)/);
  const authMode = loginUrl.searchParams.get('auth');
  expect(authMode === 'login' || authMode === 'dev-login' || authMode === 'mock-login' || authMode === null).toBe(true);
  expect(loginUrl.searchParams.get('returnTo')).toMatch(returnToPattern);
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
      body: createEmptyPaginatedDataResponse(),
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

const mapNewsToUnifiedContent = (newsItems: readonly NewsRecord[]) =>
  newsItems.map((item) => ({
    id: item.id,
    contentType: item.contentType,
    title: item.title,
    status: item.status,
    author: item.author,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt,
    access: {
      state: 'editable',
      canRead: true,
      canCreate: true,
      canUpdate: true,
      organizationIds: ['org-1'],
      sourceKinds: ['direct_role'],
    },
  }));

const routeUnifiedContentOverview = async (page: Page, newsItems: readonly NewsRecord[]) => {
  await page.route('**/api/v1/iam/contents**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: mapNewsToUnifiedContent(newsItems),
        pagination: createPagination(newsItems.length),
      }),
    });
  });
  await page.route('**/api/v1/mainserver/events**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], pagination: createPagination(0) }),
    });
  });
  await page.route('**/api/v1/mainserver/poi**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], pagination: createPagination(0) }),
    });
  });
};

const routeNewsMediaRequests = async (route: Route) => {
  const request = route.request();
  const method = request.method();
  const url = new URL(request.url());
  const path = url.pathname;

  if (path === '/api/v1/iam/media' && method === 'GET') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
    return;
  }

  if (path === '/api/v1/iam/media/references' && method === 'GET') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
    return;
  }

  await route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'not_found' }),
  });
};

const openNewsDetailTab = async (page: Page, labelPattern: RegExp) => {
  await page.getByRole('tab', { name: labelPattern }).click();
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

  if (method === 'GET' && path === '/api/v1/mainserver/news') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: newsItems, pagination: createPagination(newsItems.length) }),
    });
    return;
  }

  const visibilityMatch = path.match(/^\/api\/v1\/mainserver\/news\/([^/]+)\/visibility$/);
  if (visibilityMatch && method === 'PATCH') {
    const contentId = visibilityMatch[1];
    const body = request.postDataJSON() as { visible?: boolean };
    const item = newsItems.find((entry) => entry.id === contentId);

    if (!item) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) });
      return;
    }

    item.visible = body.visible !== false;
    item.updatedAt = '2026-04-13T12:15:00.000Z';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { status: 'ok' } }),
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
      visible: body.visible !== false,
      categories: Array.isArray(body.categories) ? (body.categories as NewsRecord['categories']) : [],
      sourceUrl: typeof body.sourceUrl === 'object' ? (body.sourceUrl as NewsRecord['sourceUrl']) : undefined,
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
    item.visible = typeof body.visible === 'boolean' ? body.visible : item.visible;
    item.categories = Array.isArray(body.categories) ? (body.categories as NewsRecord['categories']) : item.categories;
    item.sourceUrl = typeof body.sourceUrl === 'object' ? (body.sourceUrl as NewsRecord['sourceUrl']) : item.sourceUrl;
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
    await page.route('**/api/v1/iam/media**', routeNewsMediaRequests);
  });

  test('supports draft creation, publication, and delete in the simplified news editor', async ({ page }) => {
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
      const path = new URL(request.url()).pathname;
      if (path !== '/api/v1/mainserver/news') {
        await route.fallback();
        return;
      }
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
        visible: body.visible !== false,
        categories: Array.isArray(body.categories) ? (body.categories as NewsRecord['categories']) : [],
        sourceUrl: typeof body.sourceUrl === 'object' ? (body.sourceUrl as NewsRecord['sourceUrl']) : undefined,
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

    await page.route('**/api/v1/mainserver/news/**', async (route) => {
      await fulfillContentRoute(route, newsItems);
    });
    await page.route('**/api/v1/mainserver/categories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ name: 'Allgemein' }, { name: 'Kultur' }] }),
      });
    });
    await routeUnifiedContentOverview(page, newsItems);

    await gotoHomeAsAuthenticatedUser(page);

    await navigateClientSide(page, '/admin/content');
    await expectContentOverviewReady(page);

    await navigateClientSide(page, '/admin/news/new');
    await expect(page).toHaveURL(/\/admin\/news\/new$/);
    await expectPluginPageHeading(page, /News-Eintrag anlegen|news\.editor\.createTitle/);

    await page.getByLabel(/Titel|news\.fields\.title/).fill('Erste News');
    await expect(page.locator('#news-author')).toHaveValue('Editor One');
    const categorySearch = page.getByRole('combobox', { name: /Kategorien suchen|news\.fields\.categoriesSearch/ });
    const addCategoryButton = page.getByRole('button', { name: /Kategorie hinzufügen|news\.actions\.addCategory/ });
    await expect(categorySearch).toBeVisible();
    await categorySearch.fill('Allgemein');
    await addCategoryButton.click();
    await categorySearch.fill('Kultur');
    await addCategoryButton.click();

    await openNewsDetailTab(page, /Inhalte|news\.tabs\.content/);
    await page.locator('#news-content-teaser').fill('Kurztext');
    await page.locator('#news-content-body').fill('<p>Inhalt</p>');
    await page.locator('#news-source-url').fill('https://example.com/news/source');
    await page.locator('#news-source-description').fill('Quellseite');
    await page.getByRole('button', { name: /Medium hinzufügen|news\.actions\.addMedia/ }).click();
    await page.locator('#news-media-url-0').fill('https://example.com/news/image.jpg');
    await page.locator('#news-media-caption-0').fill('Titelbild');

    await openNewsDetailTab(page, /Einstellungen|news\.tabs\.settings/);
    await page.getByRole('radio', { name: /Entwurf|news\.publicationModes\.draft/ }).click();
    await page.getByRole('button', { name: /Speichern|news\.actions\.save/ }).click();

    await expect.poll(() => newsItems.length).toBe(1);
    expect(newsItems).toHaveLength(1);
    expect(createdBody).toMatchObject({
      title: 'Erste News',
      author: 'Editor One',
      sourceUrl: { url: 'https://example.com/news/source', description: 'Quellseite' },
    });
    expect(createdBody?.categories).toEqual([{ name: 'Allgemein' }, { name: 'Kultur' }]);
    expect(createdBody?.contentBlocks).toEqual([
      {
        title: 'Erste News',
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
    expect(newsItems[0]?.visible).toBe(false);

    await navigateClientSide(page, '/admin/news/news-1');
    await expectPluginPageHeading(page, /News-Eintrag bearbeiten|news\.editor\.editTitle/);

    await openNewsDetailTab(page, /Einstellungen|news\.tabs\.settings/);
    await page.getByRole('radio', { name: /Sofort veröffentlichen|news\.publicationModes\.immediate/ }).click();
    await page.getByRole('button', { name: /Speichern|news\.actions\.save/ }).click();
    await expect(page.getByRole('status')).toContainText(/gespeichert|aktualisiert|news\.messages\.updateSuccess/);
    expect(newsItems[0]?.visible).toBe(true);

    await navigateClientSide(page, '/admin/news/news-1');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Löschen|news\.actions\.delete/ }).click();

    await expectContentOverviewReady(page);
    expect(newsItems).toHaveLength(0);
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
    await routeUnifiedContentOverview(page, newsItems);

    await gotoHomeAsAuthenticatedUser(page);
    const contentNavLink = page.getByRole('link', { name: 'Inhalte öffnen' }).first();
    await expect(contentNavLink).toBeVisible();

    await contentNavLink.focus();
    await page.keyboard.press('Enter');

    await expectContentOverviewReady(page);
  });

  test('blocks unauthenticated access to admin news routes', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unauthorized' }),
      });
    });

    await gotoShellRoot(page);
    await navigateClientSide(page, '/admin/content');
    await expectLoginRedirect(page, /^\/admin\/content(?:$|\?)/);
  });

  test('stays free of serious accessibility violations on news views', async ({ page }) => {
    test.setTimeout(90_000);

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

    await page.route('**/api/v1/mainserver/news/**', async (route) => {
      await fulfillContentRoute(route, newsItems);
    });
    await page.route('**/api/v1/mainserver/categories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ name: 'Allgemein' }, { name: 'Kultur' }] }),
      });
    });
    await routeUnifiedContentOverview(page, newsItems);

    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/content');
    await expectContentOverviewReady(page);
    const listViolations = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(listViolations.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);

    await navigateClientSide(page, '/admin/news/new');
    await expectNewsEditorReady(page, 'create');
    const createViolations = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(createViolations.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);

    await navigateClientSide(page, '/admin/news/news-1');
    await expectNewsEditorReady(page, 'edit');
    const editViolations = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(editViolations.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);
  });
});
