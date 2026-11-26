import { expect, test } from '@playwright/test';

import {
  authenticatedUser,
  gotoHomeAsAuthenticatedUser,
  mockSharedShellRequests,
  navigateClientSide,
  permissionPayload,
} from './news-plugin.fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test('lists, creates and edits tours in the active organization', async ({ page }) => {
  await mockSharedShellRequests(page);
  await page.route('**/api/v1/mainserver/mutation-capabilities', (route) =>
    route.fulfill({ json: { data: { enabledActions: ['tours.update'] } } })
  );
  await page.route('**/api/v1/iam/me/context', (route) =>
    route.fulfill({
      json: {
        data: {
          activeOrganizationId: 'org-1',
          personalMainserverReadiness: 'ready',
          organizations: [
            {
              organizationId: 'org-1',
              organizationKey: 'stadtredaktion',
              displayName: 'Stadtredaktion',
              organizationType: 'municipality',
              contentAuthorPolicy: 'org_or_personal',
              isActive: true,
              isDefaultContext: true,
              mainserverReadiness: 'ready',
            },
          ],
        },
      },
    })
  );
  await page.route('**/api/v1/mainserver/categories?dataType=tour', (route) =>
    route.fulfill({ json: { data: [{ id: '7', name: 'Freizeit' }] } })
  );
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          ...authenticatedUser.user,
          assignedModules: ['tours'],
          permissionActions: ['tours.read', 'tours.create', 'tours.update'],
        },
      },
    })
  );
  await page.route('**/iam/me/permissions?**', (route) =>
    route.fulfill({
      json: {
        ...permissionPayload,
        permissions: [
          { action: 'tours.read', resourceType: 'tours' },
          { action: 'tours.create', resourceType: 'tours' },
          { action: 'tours.update', resourceType: 'tours' },
        ],
      },
    })
  );
  const tour = {
    id: '42',
    name: 'Rund um den See',
    active: false,
    visible: true,
    lengthKm: 4,
    categories: [{ id: '7', name: 'Freizeit' }],
    dataProvider: { id: '1', name: 'Stadtredaktion' },
  };
  const harbor = { id: '18', name: 'Hafen', description: 'Am Wasser', geoLocation: null };
  const viewpoint = { id: '10', name: 'Aussichtspunkt', description: null, geoLocation: null };
  let editable = {
    ...tour,
    revision: 'revision-1',
    description: '<p>Bestehende Beschreibung</p>',
    geometryTourData: [
      { latitude: 52, longitude: 13 },
      { latitude: 52.5, longitude: 13.3 },
    ],
    tourStops: [harbor, viewpoint],
  };
  const updates: unknown[] = [];
  const writes: unknown[] = [];
  let releaseSave!: () => void;
  const deferredSave = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route('**/api/v1/mainserver/tours**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') {
      writes.push({
        principal: route.request().headers()['x-sva-acting-principal-type'],
        data: route.request().postDataJSON(),
      });
      if (writes.length === 2) await deferredSave;
      return route.fulfill({ status: 201, json: { data: { id: '44', visible: false } } });
    }
    if (url.pathname.endsWith('/44'))
      return route.fulfill({
        json: {
          data: {
            ...tour,
            id: '44',
            name: 'Neuer Rundweg',
            visible: false,
            geometryTourData: [],
            tourStops: [],
          },
        },
      });
    if (url.pathname.endsWith('/42/editor'))
      return route.fulfill({
        headers: { 'X-SVA-Context-Binding': 'v1.tour-context' },
        json: { data: editable },
      });
    if (url.pathname.endsWith('/42')) {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        updates.push({
          principal: route.request().headers()['x-sva-acting-principal-type'],
          binding: route.request().headers()['x-sva-context-binding'],
          body,
        });
        editable = {
          ...editable,
          revision: 'revision-2',
          geometryTourData: body.patch.geometryTourData,
          tourStops: [viewpoint, harbor],
        };
      }
      return route.fulfill({ json: { data: editable } });
    }
    const currentPage = Number(url.searchParams.get('page'));
    return route.fulfill({
      json: {
        data: [currentPage === 1 ? { ...tour, id: '43', name: 'Stadtrundgang' } : tour],
        pagination: { page: currentPage, pageSize: 25, hasNextPage: currentPage === 1 },
      },
    });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/plugins/tours');
  await expect(page).toHaveURL(/\/admin\/tours(?:\?|$)/);
  await expect(page.getByRole('link', { name: 'Stadtrundgang' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/tours\?.*page=2/);
  await page.getByRole('link', { name: 'Rund um den See' }).click();
  await expect(page.getByRole('heading', { name: 'Rund um den See' })).toBeVisible();
  const detail = page.getByRole('main');
  await expect(detail.getByText('Breitengrad 52, Längengrad 13', { exact: true })).toBeVisible();
  await expect(detail.getByRole('listitem').filter({ hasText: /Hafen|Aussichtspunkt/ })).toHaveText(
    ['Hafen', 'Aussichtspunkt']
  );
  await expect(detail.getByText('Veröffentlicht', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Zurück zur Liste' }).click();
  await expect(page).toHaveURL(/\/admin\/tours\?.*page=2/);
  await expect(page.getByRole('link', { name: 'Rund um den See' })).toBeVisible();
  await page.getByRole('link', { name: 'Tour anlegen' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Neuer Rundweg');
  await page.getByRole('link', { name: 'Zurück zur Liste' }).click();
  const leavePrompt = page.getByRole('alertdialog', { name: 'Ungespeicherte Eingaben verwerfen?' });
  await expect(leavePrompt).toBeVisible();
  await leavePrompt.getByRole('button', { name: 'Weiterbearbeiten' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Neuer Rundweg');
  expect(writes).toHaveLength(0);
  await page.getByLabel('Länge', { exact: true }).fill('4');
  await expect(page.locator('#tour-principal')).toHaveValue('Stadtredaktion');
  await expect(page.locator('#tour-principal')).not.toBeEditable();
  await page.locator('#tour-category').selectOption({ label: 'Freizeit' });
  await page.getByRole('button', { name: 'Als Entwurf speichern', exact: true }).first().click();
  await expect(page).toHaveURL(/\/admin\/tours\/44/);
  await expect(leavePrompt).toHaveCount(0);
  await expect(page.getByText('Unveröffentlicht', { exact: true })).toBeVisible();
  expect(writes).toEqual([
    {
      principal: 'organization',
      data: {
        name: 'Neuer Rundweg',
        lengthKm: 4,
        visible: false,
        categories: [{ id: '7' }],
        tourStops: [],
      },
    },
  ]);

  await page.getByRole('link', { name: 'Zurück zur Liste' }).click();
  await page.getByRole('link', { name: 'Tour anlegen' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Zweite Tour');
  await page.getByLabel('Länge', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Als Entwurf speichern', exact: true }).first().click();
  await expect.poll(() => writes.length).toBe(2);
  await page.getByRole('link', { name: 'Zurück zur Liste' }).click();
  await leavePrompt.getByRole('button', { name: 'Verwerfen und verlassen' }).click();
  await expect(page).toHaveURL(/\/admin\/tours(?:\?|$)/);
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/mainserver/tours') && response.request().method() === 'POST'
  );
  releaseSave();
  expect(await (await saved).finished()).toBeNull();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  await expect(page).toHaveURL(/\/admin\/tours(?:\?|$)/);
  expect(writes).toHaveLength(2);

  await navigateClientSide(page, '/admin/tours/42');
  await page.getByRole('button', { name: 'Tour bearbeiten', exact: true }).first().click();
  const firstStop = page.getByRole('group', { name: 'Station 1' });
  await expect(firstStop.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Hafen');
  await firstStop.getByRole('button', { name: 'Station entfernen' }).click();
  const removeConfirmation = page.getByRole('alertdialog', { name: 'Station entfernen?' });
  await expect(removeConfirmation).toBeVisible();
  await removeConfirmation.getByRole('button', { name: 'Abbrechen' }).click();
  await firstStop.getByRole('button', { name: 'Nach unten' }).press('Enter');
  await page.getByRole('textbox', { name: 'Routenpunkte', exact: true }).fill('52 13\n53 14');
  await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Tour gespeichert' })).toBeVisible();
  expect(updates).toEqual([
    {
      principal: 'organization',
      binding: 'v1.tour-context',
      body: {
        expectedRevision: 'revision-1',
        patch: {
          geometryTourData: [
            { latitude: 52, longitude: 13 },
            { latitude: 53, longitude: 14 },
          ],
          tourStops: [{ id: '10' }, { id: '18' }],
        },
      },
    },
  ]);
  await page.reload();
  await expect(page.getByText('Breitengrad 53, Längengrad 14', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('main')
      .getByRole('listitem')
      .filter({ hasText: /Hafen|Aussichtspunkt/ })
  ).toHaveText(['Aussichtspunkt', 'Hafen']);
  await expect(page.getByText('Veröffentlicht', { exact: true })).toBeVisible();
});
