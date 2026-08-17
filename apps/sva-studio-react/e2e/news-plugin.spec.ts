import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { unauthenticatedStorageState } from '../src/lib/playwright-auth-session-config';
import {
  authenticatedUser,
  expectContentOverviewReady,
  expectLoginRedirect,
  expectNewsEditorReady,
  expectPluginPageHeading,
  gotoHomeAsAuthenticatedUser,
  mockSharedShellRequests,
  navigateClientSide,
  permissionPayload,
  type NewsRecord,
} from './news-plugin.fixtures';
import {
  createPagination,
  fulfillContentRoute,
  openNewsDetailTab,
  routeNewsMediaRequests,
  routeUnifiedContentOverview,
} from './news-plugin.routes';

test.describe('news plugin', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await mockSharedShellRequests(page);
    await page.route('**/api/v1/iam/media**', routeNewsMediaRequests);
  });

  test('supports draft creation, publication, and delete in the simplified news editor', async ({
    page,
  }) => {
    const newsItems: NewsRecord[] = [];
    let createdBody: Record<string, unknown> | undefined;
    await page.route('**/auth/me', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authenticatedUser),
      })
    );
    await page.route('**/iam/me/permissions?**', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(permissionPayload),
      })
    );
    await page.route('**/api/v1/mainserver/news**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: newsItems, pagination: createPagination(newsItems.length) }),
        });
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      createdBody = body;
      newsItems.push({
        id: 'news-1',
        title: String(body.title),
        contentType: 'news.article',
        status: 'published',
        publishedAt:
          typeof body.publishedAt === 'string' ? body.publishedAt : '2026-04-13T12:10:00.000Z',
        visible: body.visible !== false,
        categories: Array.isArray(body.categories)
          ? (body.categories as NewsRecord['categories'])
          : [],
        sourceUrl:
          typeof body.sourceUrl === 'object'
            ? (body.sourceUrl as NewsRecord['sourceUrl'])
            : undefined,
        categoryName: typeof body.categoryName === 'string' ? body.categoryName : undefined,
        payload: {},
        contentBlocks: Array.isArray(body.contentBlocks)
          ? (body.contentBlocks as NewsRecord['contentBlocks'])
          : [],
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
    await page.route('**/api/v1/mainserver/news/**', async (route) =>
      fulfillContentRoute(route, newsItems)
    );
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
    await expectPluginPageHeading(page, /Nachricht anlegen|news\.editor\.createTitle/);
    await page.getByLabel(/Überschrift|news\.fields\.title/).fill('Erste News');
    await expect(
      page.getByRole('textbox', { name: /Erstellen als|news\.principal\.createAs/ })
    ).toHaveValue('Editor One');
    const categorySearch = page.getByRole('combobox', {
      name: /Kategorien suchen|news\.fields\.categoriesSearch/,
    });
    await categorySearch.fill('Allgemein');
    await categorySearch.blur();
    await expect(page.getByText('Allgemein')).toBeVisible();
    await categorySearch.fill('Kultur');
    await categorySearch.blur();
    await expect(page.getByText('Kultur')).toBeVisible();
    await openNewsDetailTab(page, /Inhalte|news\.tabs\.content/);
    await page.locator('#news-content-intro').fill('Kurztext');
    await page.locator('#news-content-body').fill('<p>Inhalt</p>');
    await page.locator('#news-source-url').fill('https://example.com/news/source');
    await page.locator('#news-source-description').fill('Quellseite');
    await page
      .getByRole('button', { name: /Medium hinzufügen|news\.messages\.mediaPickerTitle/ })
      .click();
    await page
      .getByLabel(/Medien-URL|news\.fields\.mediaUrl/)
      .fill('https://example.com/news/image.jpg');
    await page.getByLabel(/Bildunterschrift|news\.fields\.mediaCaption/).fill('Titelbild');
    await openNewsDetailTab(page, /Einstellungen|news\.tabs\.settings/);
    await page.getByRole('radio', { name: /Entwurf|news\.publicationModes\.draft/ }).click();
    const pushCheckbox = page.getByRole('checkbox', {
      name: /Push-Benachrichtigung senden|news\.fields\.pushNotification/,
    });
    await expect(pushCheckbox).toBeVisible();
    await pushCheckbox.check();
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page
      .getByRole('button', { name: /Speichern|news\.actions\.save/ })
      .last()
      .click();
    await expect.poll(() => newsItems.length).toBe(1);
    expect(createdBody).toMatchObject({
      title: 'Erste News',
      sourceUrl: { url: 'https://example.com/news/source', description: 'Quellseite' },
      pushNotification: true,
    });
    expect(createdBody).not.toHaveProperty('author');
    expect(createdBody?.categories).toEqual([{ name: 'Allgemein' }, { name: 'Kultur' }]);
    await navigateClientSide(page, '/admin/news/news-1');
    await expectNewsEditorReady(page, 'edit');
    await page.getByLabel(/Überschrift|news\.fields\.title/).fill('Erste News aktualisiert');
    await openNewsDetailTab(page, /Einstellungen|news\.tabs\.settings/);
    await page
      .getByRole('radio', { name: /Sofort veröffentlichen|news\.publicationModes\.immediate/ })
      .click();
    await page
      .getByRole('button', { name: /Speichern|news\.actions\.save/ })
      .last()
      .click();
    await expect.poll(() => newsItems[0]?.title).toBe('Erste News aktualisiert');
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole('button', { name: /Löschen|news\.actions\.delete/ }).click();
    await expect.poll(() => newsItems).toHaveLength(0);
  });

  test('keeps a local image browser-only until save and then completes one media lifecycle', async ({
    page,
  }) => {
    const mediaMutations: string[] = [];
    let correlatedOperationId: string | null = null;
    const mediaActions = ['media.read', 'media.create', 'media.reference.manage'] as const;
    await page.route('**/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...authenticatedUser,
          user: {
            ...authenticatedUser.user,
            permissionActions: [...authenticatedUser.user.permissionActions, ...mediaActions],
          },
        }),
      })
    );
    await page.route('**/iam/me/permissions?**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...permissionPayload,
          permissions: [
            ...permissionPayload.permissions,
            ...mediaActions.map((action) => ({ action, resourceType: 'media' })),
          ],
        }),
      })
    );
    await page.route('**/api/v1/mainserver/categories', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
    );
    await page.route('https://uploads.example.test/**', (route) => route.fulfill({ status: 200 }));
    await page.route('**/api/v1/iam/media**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      if (method !== 'GET') mediaMutations.push(`${method} ${path}`);
      if (
        method === 'GET' &&
        (path === '/api/v1/iam/media' || path === '/api/v1/iam/media/references')
      ) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      }
      if (method === 'POST' && path === '/api/v1/iam/media/content-save-operations') {
        const body = request.postDataJSON() as { operationId: string };
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: body.operationId,
              targetType: 'news.article',
              status: 'preparing',
              expiresAt: '2026-08-18T10:00:00.000Z',
            },
          }),
        });
      }
      if (method === 'POST' && path === '/api/v1/iam/media/upload-sessions') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              assetId: 'asset-1',
              uploadSessionId: 'upload-1',
              uploadUrl: 'https://uploads.example.test/asset-1',
              method: 'PUT',
              headers: {},
              expiresAt: '2026-08-18T10:00:00.000Z',
              status: 'pending',
              initializedAt: '2026-08-17T10:00:00.000Z',
            },
          }),
        });
      }
      if (method === 'POST' && path === '/api/v1/iam/media/upload-sessions/upload-1/complete') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { assetId: 'asset-1', uploadSessionId: 'upload-1', status: 'processed' },
          }),
        });
      }
      if (method === 'GET' && path === '/api/v1/iam/media/asset-1/delivery') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              deliveryUrl: 'https://cdn.example.test/asset-1.jpg',
              expiresAt: null,
              isPublicUrl: true,
            },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {} }),
      });
    });
    await page.route('**/api/v1/mainserver/news**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        correlatedOperationId = request.headers()['x-sva-content-media-save-operation-id'] ?? null;
        const body = request.postDataJSON() as Record<string, unknown>;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'news-media-1',
              title: body.title,
              contentType: 'news.article',
              status: 'draft',
              visible: true,
              categories: [],
              payload: {},
              contentBlocks: body.contentBlocks ?? [],
              author: 'Editor One',
              createdAt: '2026-08-17T10:00:00.000Z',
              updatedAt: '2026-08-17T10:00:00.000Z',
            },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-SVA-Context-Binding': 'v1.loaded-context' },
        body: JSON.stringify({
          data: {
            id: 'news-media-1',
            title: 'News mit Bild',
            contentType: 'news.article',
            status: 'draft',
            visible: true,
            categories: [],
            payload: {},
            contentBlocks: [],
            author: 'Editor One',
            createdAt: '2026-08-17T10:00:00.000Z',
            updatedAt: '2026-08-17T10:00:00.000Z',
          },
          meta: { access: { 'news.update': true, 'news.delete': true } },
        }),
      });
    });

    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/news/new');
    await expectPluginPageHeading(page, /Nachricht anlegen|news\.editor\.createTitle/);
    await page.getByLabel(/Überschrift|news\.fields\.title/).fill('News mit Bild');
    await openNewsDetailTab(page, /Inhalte|news\.tabs\.content/);
    await page
      .getByRole('button', { name: /Medium hinzufügen|news\.messages\.mediaPickerTitle/ })
      .click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="media-upload-input"]')).toHaveCount(0);
    expect(mediaMutations).toEqual([]);

    await page
      .getByRole('button', { name: /Medium hinzufügen|news\.messages\.mediaPickerTitle/ })
      .click();
    await page.locator('[data-testid="media-upload-input"]').setInputFiles({
      name: 'lokales-bild.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('image'),
    });
    await page.getByRole('button', { name: /Medium übernehmen|mediaPicker\.confirm/ }).click();

    await expect(page.locator('img[src^="blob:"]')).toBeVisible();
    expect(mediaMutations).toEqual([]);
    await page.locator('[id^="content-media-"][id$="-remove"]').click();
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
    expect(mediaMutations).toEqual([]);

    await page
      .getByRole('button', { name: /Medium hinzufügen|news\.messages\.mediaPickerTitle/ })
      .click();
    await page.locator('[data-testid="media-upload-input"]').setInputFiles({
      name: 'lokales-bild.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('image'),
    });
    await page.getByRole('button', { name: /Medium übernehmen|mediaPicker\.confirm/ }).click();
    await navigateClientSide(page, '/');
    await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
    await navigateClientSide(page, '/admin/news/new');
    await expectPluginPageHeading(page, /Nachricht anlegen|news\.editor\.createTitle/);
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
    expect(mediaMutations).toEqual([]);

    await page.getByLabel(/Überschrift|news\.fields\.title/).fill('News mit Bild');
    await openNewsDetailTab(page, /Inhalte|news\.tabs\.content/);
    await page
      .getByRole('button', { name: /Medium hinzufügen|news\.messages\.mediaPickerTitle/ })
      .click();
    await page.locator('[data-testid="media-upload-input"]').setInputFiles({
      name: 'lokales-bild.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('image'),
    });
    await page.getByRole('button', { name: /Medium übernehmen|mediaPicker\.confirm/ }).click();

    await page
      .getByRole('button', { name: /Speichern|news\.actions\.save/ })
      .last()
      .click();
    await expect
      .poll(() => mediaMutations.filter((entry) => entry.endsWith('/upload-sessions')).length)
      .toBe(1);
    await expect.poll(() => mediaMutations.some((entry) => entry.endsWith('/commit'))).toBe(true);
    expect(correlatedOperationId).toMatch(/^[0-9a-f-]{36}$/iu);
  });

  test('opens the news editor and supports keyboard navigation across detail tabs', async ({
    page,
  }) => {
    const newsItems: NewsRecord[] = [
      {
        id: 'news-1',
        title: 'Erste News',
        contentType: 'news.article',
        status: 'published',
        author: 'Editor One',
        createdAt: '2026-04-13T12:10:00.000Z',
        updatedAt: '2026-04-13T12:10:00.000Z',
        publishedAt: '2026-04-13T12:10:00.000Z',
        visible: true,
        payload: {},
        contentBlocks: [{ intro: 'Kurztext', body: '<p>Inhalt</p>' }],
      },
    ];
    await page.route('**/auth/me', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authenticatedUser),
      })
    );
    await page.route('**/iam/me/permissions?**', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(permissionPayload),
      })
    );
    await page.route('**/api/v1/mainserver/news', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: newsItems, pagination: createPagination(1) }),
      })
    );
    await page.route('**/api/v1/mainserver/news/**', async (route) =>
      fulfillContentRoute(route, newsItems)
    );
    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/news/news-1');
    await expectNewsEditorReady(page, 'edit');
    const contentTab = page.getByRole('tab', { name: /Inhalte|news\.tabs\.content/ });
    await contentTab.focus();
    await expect(contentTab).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(
      page.getByRole('tab', { selected: true, name: /Einstellungen|news\.tabs\.settings/ })
    ).toBeVisible();
  });

  test('rejects a direct push request without the dedicated permission', async ({ page }) => {
    await page.route('**/api/v1/mainserver/news', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: body.pushNotification === true ? 403 : 201,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'forbidden',
            details: { required_permissions: ['news.pushNotification'] },
          },
        }),
      });
    });

    await page.goto('/');
    const response = await page.evaluate(async () => {
      const result = await fetch('/api/v1/mainserver/news', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Idempotency-Key': 'news-push-without-permission',
        },
        body: JSON.stringify({ title: 'Direkter Push', pushNotification: true }),
      });
      return { status: result.status, body: await result.json() };
    });

    expect(response).toEqual({
      status: 403,
      body: {
        error: {
          code: 'forbidden',
          details: { required_permissions: ['news.pushNotification'] },
        },
      },
    });
  });

  test('loads the content overview via paginated IAM requests without browser-side mainserver list scans', async ({
    page,
  }) => {
    const contentListRequests: string[] = [];
    let mainserverNewsListCalls = 0;

    await page.route('**/auth/me', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authenticatedUser),
      })
    );
    await page.route('**/iam/me/permissions?**', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(permissionPayload),
      })
    );
    await page.route('**/api/v1/iam/contents**', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (route.request().method() !== 'GET' || requestUrl.pathname !== '/api/v1/iam/contents') {
        await route.fallback();
        return;
      }
      contentListRequests.push(requestUrl.toString());
      const pageParam = Number.parseInt(requestUrl.searchParams.get('page') ?? '1', 10);
      const items =
        pageParam === 1
          ? Array.from({ length: 25 }, (_, index) => ({
              id: `news-${index + 1}`,
              contentType: 'news.article',
              title: `News ${index + 1}`,
              status: 'published',
              author: 'Editor One',
              createdAt: '2026-04-13T12:10:00.000Z',
              updatedAt: `2026-04-13T12:${String(index).padStart(2, '0')}:00.000Z`,
              publishedAt: '2026-04-13T12:10:00.000Z',
              access: {
                state: 'editable',
                canRead: true,
                canCreate: true,
                canUpdate: true,
                organizationIds: ['org-1'],
                sourceKinds: ['direct_role'],
              },
            }))
          : Array.from({ length: 25 }, (_, index) => ({
              id: `news-${index + 26}`,
              contentType: 'news.article',
              title: `News ${index + 26}`,
              status: 'published',
              author: 'Editor One',
              createdAt: '2026-04-13T12:10:00.000Z',
              updatedAt: `2026-04-13T13:${String(index).padStart(2, '0')}:00.000Z`,
              publishedAt: '2026-04-13T12:10:00.000Z',
              access: {
                state: 'editable',
                canRead: true,
                canCreate: true,
                canUpdate: true,
                organizationIds: ['org-1'],
                sourceKinds: ['direct_role'],
              },
            }));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: items,
          pagination: {
            page: pageParam,
            pageSize: 25,
            total: 250,
          },
        }),
      });
    });
    await page.route('**/api/v1/mainserver/news**', async (route) => {
      mainserverNewsListCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], pagination: createPagination(0) }),
      });
    });

    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/content');
    await expectContentOverviewReady(page);
    await expect.poll(() => contentListRequests.length).toBeGreaterThan(0);
    expect(new URL(contentListRequests[0] ?? 'http://localhost').searchParams.get('page')).toBe(
      '1'
    );
    expect(
      contentListRequests.every((requestUrl) =>
        /^\d+$/u.test(new URL(requestUrl).searchParams.get('page') ?? '')
      )
    ).toBe(true);
    expect(
      contentListRequests.some((requestUrl) => new URL(requestUrl).searchParams.get('page') === '1')
    ).toBe(true);
    expect(mainserverNewsListCalls).toBe(0);

    await page.getByRole('button', { name: /Weiter|content\.pagination\.next/ }).click();

    await expect
      .poll(() =>
        contentListRequests.some(
          (requestUrl) => new URL(requestUrl).searchParams.get('page') === '2'
        )
      )
      .toBe(true);
    expect(mainserverNewsListCalls).toBe(0);
  });

  test.describe('unauthenticated access', () => {
    test.use({ storageState: unauthenticatedStorageState });
    test('blocks unauthenticated access to admin news routes', async ({ page }) => {
      await page.goto('/admin/news/new');
      await expectLoginRedirect(page, /\/admin\/news\/new$/);
    });
  });

  test('stays free of serious accessibility violations on news views', async ({ page }) => {
    const newsItems: NewsRecord[] = [
      {
        id: 'news-1',
        title: 'Erste News',
        contentType: 'news.article',
        status: 'published',
        author: 'Editor One',
        createdAt: '2026-04-13T12:10:00.000Z',
        updatedAt: '2026-04-13T12:10:00.000Z',
        publishedAt: '2026-04-13T12:10:00.000Z',
        visible: true,
        payload: {},
      },
    ];
    await page.route('**/auth/me', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authenticatedUser),
      })
    );
    await page.route('**/iam/me/permissions?**', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(permissionPayload),
      })
    );
    await page.route('**/api/v1/mainserver/news', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: newsItems, pagination: createPagination(1) }),
      })
    );
    await page.route('**/api/v1/mainserver/news/**', async (route) =>
      fulfillContentRoute(route, newsItems)
    );
    await routeUnifiedContentOverview(page, newsItems);
    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/news/news-1');
    await expectNewsEditorReady(page, 'edit');
    const result = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(
      result.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))
    ).toEqual([]);
  });
});
