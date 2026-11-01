import { expect, test } from '@playwright/test';
import {
  gotoHomeAsAuthenticatedUser,
  mockSharedShellRequests,
  navigateClientSide,
} from './news-plugin.fixtures';
import { type ConstructionSiteRecord } from '../../../packages/plugin-construction-sites/src/contract';

test.use({ storageState: { cookies: [], origins: [] } });
test('creates a construction site and edits its dates without creating another record', async ({
  page,
}) => {
  test.slow();
  await mockSharedShellRequests(page);
  const actions = ['read', 'create', 'update'].map((action) => `construction-sites.${action}`);
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'kc-editor-1',
          name: 'Editor One',
          email: 'editor@example.com',
          instanceId: 'de-musterhausen',
          assignedModules: ['construction-sites'],
          roles: ['editor'],
          permissionActions: actions,
        },
      },
    })
  );
  await page.route('**/iam/me/permissions?**', (route) =>
    route.fulfill({
      json: {
        instanceId: 'de-musterhausen',
        permissions: actions.map((action) => ({ action, resourceType: 'construction-sites' })),
        subject: {
          actorUserId: 'kc-editor-1',
          effectiveUserId: 'kc-editor-1',
          isImpersonating: false,
        },
        evaluatedAt: '2026-11-01T12:00:00Z',
      },
    })
  );
  await page.route('**/api/v1/mainserver/categories?**', (route) =>
    route.fulfill({ json: { data: [{ id: '1', name: 'Verkehr' }] } })
  );
  let saved: ConstructionSiteRecord | undefined;
  let creates = 0;
  let updates = 0;
  await page.route('**/api/v1/mainserver/construction-sites**', async (route) => {
    const method = route.request().method();
    if (method === 'POST' || method === 'PATCH') {
      const body = route.request().postDataJSON() as {
        site: ConstructionSiteRecord['input'];
        baseFingerprint?: string;
      };
      if (method === 'POST') creates++;
      else {
        updates++;
        expect(body.baseFingerprint).toBe('a'.repeat(64));
      }
      saved = {
        id: '42',
        genericType: 'ConstructionSite',
        title: body.site.title,
        visible: body.site.visible,
        input: body.site,
        updatedAt: '2026-11-01T12:00:00Z',
        contentFingerprint: 'a'.repeat(64),
        dataProvider: { id: 'provider-user', name: 'Editor One' },
      };
      return route.fulfill({ status: method === 'POST' ? 201 : 200, json: { data: saved } });
    }
    return route.fulfill({
      headers: { 'X-SVA-Context-Binding': 'v1.loaded-context' },
      json:
        saved && new URL(route.request().url()).pathname.endsWith('/42')
          ? {
              data: saved,
              meta: {
                access: { 'construction-sites.read': true, 'construction-sites.update': true },
              },
            }
          : {
              data: saved ? [saved] : [],
              pagination: { page: 1, pageSize: 25, hasNextPage: false, total: saved ? 1 : 0 },
            },
    });
  });
  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/construction-sites/new');
  await expect(page.getByRole('heading', { name: 'Baustelle anlegen', exact: true })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await page.locator('#cs-title').fill('Brückenbau');
  await page.locator('#cs-dates-0-dateEnd').fill('2026-12-20');
  await page.locator('#cs-dates-0-dateStart').fill('2026-11-15');
  await expect(page.locator('#cs-dates-0-dateEnd')).toHaveValue('2026-12-20');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: test.info().outputPath('construction-site-create-mobile.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Baustelle anlegen', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Gespeicherte Baustelle öffnen' })).toBeVisible();
  expect(creates).toBe(1);
  expect(saved?.visible).toBe(false);
  await page.getByRole('link', { name: 'Gespeicherte Baustelle öffnen' }).click();
  await expect(page.locator('#cs-title')).toHaveValue('Brückenbau');
  await page.locator('#cs-dates-0-dateEnd').fill('2026-12-30');
  await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await expect(page.getByText('Die Baustelle wurde gespeichert.', { exact: true })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('construction-site-edit.png'),
    fullPage: true,
  });
  expect(creates).toBe(1);
  expect(updates).toBe(1);
  expect(saved?.input.dates[0]?.dateEnd).toBe('2026-12-30');
  await page.getByRole('link', { name: 'Zur Übersicht', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\?.*type=construction-sites/);
  await expect(page.getByRole('heading', { name: 'Baustellen', exact: true })).toBeVisible();
  await expect(page.getByText('Brückenbau', { exact: true }).first()).toBeVisible();
  const filtered = page.waitForRequest(
    (request) =>
      request.url().includes('/mainserver/construction-sites?') &&
      new URL(request.url()).searchParams.get('search') === 'Brücke'
  );
  await page.getByLabel('Titel suchen').fill('Brücke');
  await filtered;
  await expect(page.getByLabel('Titel suchen')).toHaveValue('Brücke');
});
