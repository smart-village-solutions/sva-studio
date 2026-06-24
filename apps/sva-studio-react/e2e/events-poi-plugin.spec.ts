import { test } from '@playwright/test';

import {
  expectContentOverviewReady,
  expectCreateContentActionReady,
  expectEventOrPoiEditorReady,
  expectLoginRedirect,
  expectNoSeriousAccessibilityViolations,
  expectPluginPageHeading,
  gotoHomeAsAuthenticatedUser,
  gotoShellRoot,
  mockSharedShellRequests,
  navigateClientSide,
  type EventRecord,
  type PoiRecord,
  unauthenticatedStorageState,
} from './events-poi-plugin.fixtures';
import { prepareEventAndPoiA11yViews, routeEvents, routePoi, routeUnifiedContentOverview } from './events-poi-plugin.routes';

test.describe('events and POI plugins', () => {
  test.beforeEach(async ({ page }) => {
    await mockSharedShellRequests(page);
  });

  test('supports POI CRUD including delete', async ({ page }) => {
    const pois: PoiRecord[] = [];
    const events: EventRecord[] = [];
    await page.route(/\/api\/v1\/mainserver\/events(?:\/.*)?(?:\?.*)?$/, async (route) => routeEvents(route, events));
    await page.route(/\/api\/v1\/mainserver\/poi(?:\/.*)?(?:\?.*)?$/, async (route) => routePoi(route, pois));
    await routeUnifiedContentOverview(page, () => events, () => pois);
    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/content');
    await expectContentOverviewReady(page);
    await expectCreateContentActionReady(page);
    await navigateClientSide(page, '/admin/poi/new');
    await expectPluginPageHeading(page, /Ort anlegen|POI anlegen|poi\.detail\.createTitle|poi\.editor\.createTitle/);
    await page.locator('#poi-name').fill('Rathaus');
    await page.locator('#poi-category').fill('Verwaltung');
    await page.getByRole('tab', { name: /Inhalt|poi\.detailTabs\.content\.title/ }).click();
    await page.locator('#poi-description').fill('Zentraler Servicepunkt');
    await page.locator('#poi-street').fill('Marktplatz 1');
    await page.locator('#poi-city').fill('Musterhausen');
    await page.locator('#poi-email').fill('rathaus@example.com');
    await page.locator('#poi-link-url-0').fill('https://example.com/poi');
    await page.locator('#poi-opening-weekday-0').selectOption('MO');
    await page.locator('#poi-opening-time-from-0').fill('09:00');
    await page.getByRole('button', { name: /Speichern|poi\.actions\.save/ }).click();
    await page.getByRole('tab', { name: /Basis|poi\.detailTabs\.basis\.title/ }).click();
    await page.locator('#poi-name').fill('Rathaus aktualisiert');
    await page.getByRole('button', { name: /Speichern|poi\.actions\.save/ }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Löschen|poi\.actions\.delete/ }).click();
    await expectContentOverviewReady(page);
  });

  test('supports event CRUD with POI selection including delete', async ({ page }) => {
    const events: EventRecord[] = [];
    const pois: PoiRecord[] = [{ id: 'poi-1', name: 'Rathaus', contentType: 'poi.point-of-interest', status: 'published', createdAt: '2026-04-13T12:10:00.000Z', updatedAt: '2026-04-13T12:10:00.000Z', active: true }];
    await page.route(/\/api\/v1\/mainserver\/events(?:\/.*)?(?:\?.*)?$/, async (route) => routeEvents(route, events));
    await page.route(/\/api\/v1\/mainserver\/poi(?:\/.*)?(?:\?.*)?$/, async (route) => routePoi(route, pois));
    await routeUnifiedContentOverview(page, () => events, () => pois);
    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/content');
    await expectContentOverviewReady(page);
    await expectCreateContentActionReady(page);
    await navigateClientSide(page, '/admin/events/new');
    await expectEventOrPoiEditorReady(page, '/admin/events/new');
    await page.locator('#event-title').fill('Stadtfest');
    await page.locator('#event-category').fill('Kultur');
    await page.locator('#event-poi').fill('Rathaus');
    await page.getByRole('button', { name: /Rathaus\s*poi-1/ }).click();
    await page.getByRole('tab', { name: /Inhalt|events\.detailTabs\.content\.title/ }).click();
    await page.locator('#event-description').fill('Sommerfest in der Innenstadt');
    await page.locator('#event-date-start').fill('2026-04-14T09:30');
    await page.locator('#event-street').fill('Marktplatz');
    await page.locator('#event-city').fill('Musterhausen');
    await page.locator('#event-contact-email').fill('events@example.com');
    await page.locator('#event-url').fill('https://example.com/event');
    await page.getByRole('button', { name: /Speichern|events\.actions\.save/ }).click();
    await page.getByRole('tab', { name: /Basis|events\.detailTabs\.basis\.title/ }).click();
    await page.locator('#event-title').fill('Stadtfest aktualisiert');
    await page.getByRole('button', { name: /Speichern|events\.actions\.save/ }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Löschen|events\.actions\.delete/ }).click();
    await expectContentOverviewReady(page);
  });

  test.describe('unauthenticated routes', () => {
    test.use({ storageState: unauthenticatedStorageState });
    test('redirects unauthenticated content overview access to login', async ({ page }) => {
      await page.unroute('**/auth/me');
      await page.route('**/auth/me', async (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) }));
      await gotoShellRoot(page);
      await navigateClientSide(page, '/admin/content');
      await expectLoginRedirect(page, /^\/admin\/content(?:$|\?)/);
    });
    test('redirects unauthenticated POI create access to login', async ({ page }) => {
      await page.unroute('**/auth/me');
      await page.route('**/auth/me', async (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) }));
      await gotoShellRoot(page);
      await navigateClientSide(page, '/admin/poi/new');
      await expectLoginRedirect(page, /^\/admin\/poi\/new(?:$|\?)/);
    });
  });

  test('keeps the central content overview free of serious accessibility violations', async ({ page }) => {
    await prepareEventAndPoiA11yViews(page);
    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/content');
    await expectNoSeriousAccessibilityViolations(page);
  });
  test('keeps the event create view free of serious accessibility violations', async ({ page }) => {
    await prepareEventAndPoiA11yViews(page);
    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/events/new');
    await expectEventOrPoiEditorReady(page, '/admin/events/new');
    await expectNoSeriousAccessibilityViolations(page);
  });
  test('keeps the POI create view free of serious accessibility violations', async ({ page }) => {
    await prepareEventAndPoiA11yViews(page);
    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/poi/new');
    await expectEventOrPoiEditorReady(page, '/admin/poi/new');
    await expectNoSeriousAccessibilityViolations(page);
  });
});
