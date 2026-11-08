import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  authenticatedUser,
  permissionPayload,
  mockSharedShellRequests,
  gotoHomeAsAuthenticatedUser,
} from './news-plugin.fixtures';

test.use({ storageState: { cookies: [], origins: [] } });
test('search header, results, filters and mobile entry use the existing plugin', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page
    .context()
    .addCookies([{ name: 'sva_dev_auth', value: '1', url: String(testInfo.project.use.baseURL) }]);
  await mockSharedShellRequests(page);
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          ...authenticatedUser.user,
          assignedModules: ['news', 'events', 'search'],
          permissionActions: ['news.read', 'events.read', 'search.read'],
        },
      },
    })
  );
  await page.route('**/iam/me/permissions?**', (route) =>
    route.fulfill({
      json: {
        ...permissionPayload,
        permissions: [
          { action: 'news.read', resourceType: 'news' },
          { action: 'events.read', resourceType: 'events' },
          { action: 'search.read', resourceType: 'search' },
        ],
      },
    })
  );
  await page.route('**/api/v1/plugins/search/query**', (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              id: '42',
              contentType: 'news.article',
              title: 'Kultur im Rathaus',
              excerpt: 'Ein öffentlicher Beitrag zur Kultur in der Stadt.',
              href: '/admin/news/42',
              providerId: '1',
              providerName: 'Stadtredaktion',
              categories: ['Kultur'],
            },
          ],
          allowed: 20,
          denied: 30,
          complete: true,
          hasNextPage: false,
          options: {
            types: ['news.article', 'events.event-record'],
            categories: ['Kultur', 'Freizeit'],
            providers: [{ id: '1', name: 'Stadtredaktion' }],
          },
        },
      },
    })
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoHomeAsAuthenticatedUser(page);
  const header = page.locator('header');
  await header.getByRole('searchbox', { name: 'Inhalte durchsuchen' }).fill('Kultur');
  await header.getByRole('searchbox', { name: 'Inhalte durchsuchen' }).press('Enter');
  await expect(page).toHaveURL(/\/plugins\/search\?.*q=Kultur/);
  await expect(page.getByRole('link', { name: 'Kultur im Rathaus' })).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: '20 Ergebnisse (+ 30 ohne passende Berechtigung)' })
  ).toBeVisible();
  await page.getByLabel('Inhaltstyp', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Nachrichten', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nachrichten entfernen' })).toBeVisible();
  await page.getByLabel('Inhaltstyp', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Veranstaltungen', exact: true }).click();
  await expect(page.locator('main').getByRole('searchbox')).toHaveCount(0);
  await expect(header.getByRole('searchbox')).toHaveValue('Kultur');
  await expect(page.getByRole('table', { name: 'Suchergebnisse' })).toBeVisible();
  await page.getByRole('button', { name: 'Titel', exact: true }).click();
  await expect(page).toHaveURL(/sortDirection=desc/);
  await expect(page).toHaveURL(/q=Kultur/);
  await expect(page.getByRole('button', { name: 'Nachrichten entfernen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Veranstaltungen entfernen' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('search-desktop.png'), fullPage: true });
  const accessibility = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(header.getByRole('searchbox', { name: 'Inhalte durchsuchen' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Inhalte durchsuchen' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Kultur im Rathaus' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({ path: testInfo.outputPath('search-mobile.png'), fullPage: true });
});
