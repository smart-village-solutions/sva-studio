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
import { createPagination, fulfillContentRoute, openNewsDetailTab, routeNewsMediaRequests, routeUnifiedContentOverview } from './news-plugin.routes';

test.describe('news plugin', () => {
  test.beforeEach(async ({ page }) => {
    await mockSharedShellRequests(page);
    await page.route('**/api/v1/iam/media**', routeNewsMediaRequests);
  });

  test('supports draft creation, publication, and delete in the simplified news editor', async ({ page }) => {
    const newsItems: NewsRecord[] = [];
    let createdBody: Record<string, unknown> | undefined;
    await page.route('**/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authenticatedUser) }));
    await page.route('**/iam/me/permissions?**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(permissionPayload) }));
    await page.route('**/api/v1/mainserver/news**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: newsItems, pagination: createPagination(newsItems.length) }) });
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      createdBody = body;
      newsItems.push({ id: 'news-1', title: String(body.title), contentType: 'news.article', status: 'published', publishedAt: typeof body.publishedAt === 'string' ? body.publishedAt : '2026-04-13T12:10:00.000Z', visible: body.visible !== false, categories: Array.isArray(body.categories) ? (body.categories as NewsRecord['categories']) : [], sourceUrl: typeof body.sourceUrl === 'object' ? (body.sourceUrl as NewsRecord['sourceUrl']) : undefined, categoryName: typeof body.categoryName === 'string' ? body.categoryName : undefined, payload: {}, contentBlocks: Array.isArray(body.contentBlocks) ? (body.contentBlocks as NewsRecord['contentBlocks']) : [], author: 'Editor One', createdAt: '2026-04-13T12:10:00.000Z', updatedAt: '2026-04-13T12:10:00.000Z' });
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: newsItems[0] }) });
    });
    await page.route('**/api/v1/mainserver/news/**', async (route) => fulfillContentRoute(route, newsItems));
    await page.route('**/api/v1/mainserver/categories', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ name: 'Allgemein' }, { name: 'Kultur' }] }) });
    });
    await routeUnifiedContentOverview(page, newsItems);

    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/content');
    await expectContentOverviewReady(page);
    await navigateClientSide(page, '/admin/news/new');
    await expectPluginPageHeading(page, /News-Eintrag anlegen|news\.editor\.createTitle/);
    await page.getByLabel(/Titel|news\.fields\.title/).fill('Erste News');
    await expect(page.locator('#news-author')).toHaveValue('Editor One');
    const categorySearch = page.getByRole('combobox', { name: /Kategorien suchen|news\.fields\.categoriesSearch/ });
    await categorySearch.fill('Allgemein');
    await page.getByRole('button', { name: /Kategorie hinzufügen|news\.actions\.addCategory/ }).click();
    await categorySearch.fill('Kultur');
    await page.getByRole('button', { name: /Kategorie hinzufügen|news\.actions\.addCategory/ }).click();
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
    expect(createdBody).toMatchObject({ title: 'Erste News', author: 'Editor One', sourceUrl: { url: 'https://example.com/news/source', description: 'Quellseite' } });
    expect(createdBody?.categories).toEqual([{ name: 'Allgemein' }, { name: 'Kultur' }]);
    await navigateClientSide(page, '/admin/news/news-1');
    await expectNewsEditorReady(page, 'edit');
    await page.getByLabel(/Titel|news\.fields\.title/).fill('Erste News aktualisiert');
    await openNewsDetailTab(page, /Einstellungen|news\.tabs\.settings/);
    await page.getByRole('radio', { name: /Sofort veröffentlichen|news\.publicationModes\.immediate/ }).click();
    await page.getByRole('button', { name: /Speichern|news\.actions\.save/ }).click();
    await expect.poll(() => newsItems[0]?.title).toBe('Erste News aktualisiert');
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole('button', { name: /Löschen|news\.actions\.delete/ }).click();
    await expect.poll(() => newsItems).toHaveLength(0);
  });

  test('opens the news editor and supports keyboard navigation across detail tabs', async ({ page }) => {
    const newsItems: NewsRecord[] = [{ id: 'news-1', title: 'Erste News', contentType: 'news.article', status: 'published', author: 'Editor One', createdAt: '2026-04-13T12:10:00.000Z', updatedAt: '2026-04-13T12:10:00.000Z', publishedAt: '2026-04-13T12:10:00.000Z', visible: true, payload: { teaser: 'Kurztext', body: '<p>Inhalt</p>' } }];
    await page.route('**/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authenticatedUser) }));
    await page.route('**/iam/me/permissions?**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(permissionPayload) }));
    await page.route('**/api/v1/mainserver/news', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: newsItems, pagination: createPagination(1) }) }));
    await page.route('**/api/v1/mainserver/news/**', async (route) => fulfillContentRoute(route, newsItems));
    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/news/news-1');
    await expectNewsEditorReady(page, 'edit');
    const contentTab = page.getByRole('tab', { name: /Inhalte|news\.tabs\.content/ });
    await contentTab.focus();
    await expect(contentTab).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { selected: true, name: /Einstellungen|news\.tabs\.settings/ })).toBeVisible();
  });

  test.describe('unauthenticated access', () => {
    test.use({ storageState: unauthenticatedStorageState });
    test('blocks unauthenticated access to admin news routes', async ({ page }) => {
      await page.goto('/admin/news/new');
      await expectLoginRedirect(page, /\/admin\/news\/new$/);
    });
  });

  test('stays free of serious accessibility violations on news views', async ({ page }) => {
    const newsItems: NewsRecord[] = [{ id: 'news-1', title: 'Erste News', contentType: 'news.article', status: 'published', author: 'Editor One', createdAt: '2026-04-13T12:10:00.000Z', updatedAt: '2026-04-13T12:10:00.000Z', publishedAt: '2026-04-13T12:10:00.000Z', visible: true, payload: {} }];
    await page.route('**/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authenticatedUser) }));
    await page.route('**/iam/me/permissions?**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(permissionPayload) }));
    await page.route('**/api/v1/mainserver/news', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: newsItems, pagination: createPagination(1) }) }));
    await page.route('**/api/v1/mainserver/news/**', async (route) => fulfillContentRoute(route, newsItems));
    await routeUnifiedContentOverview(page, newsItems);
    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/news/news-1');
    await expectNewsEditorReady(page, 'edit');
    const result = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(result.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);
  });
});
