import { expect, test } from '@playwright/test';

import {
  authenticatedUser,
  gotoHomeAsAuthenticatedUser,
  mockSharedShellRequests,
  navigateClientSide,
  permissionPayload,
} from './news-plugin.fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test('opens a tour from the second page and returns to that page', async ({ page }) => {
  await mockSharedShellRequests(page);
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          ...authenticatedUser.user,
          assignedModules: ['tours'],
          permissionActions: ['tours.read', 'tours.create'],
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
  const writes: unknown[] = [];
  await page.route('**/api/v1/mainserver/tours**', (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') {
      writes.push(route.request().postDataJSON());
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
    if (url.pathname.endsWith('/42'))
      return route.fulfill({
        json: {
          data: {
            ...tour,
            geometryTourData: [
              { latitude: 52, longitude: 13 },
              { latitude: 52.5, longitude: 13.3 },
            ],
            tourStops: [
              { id: '18', name: 'Hafen' },
              { id: '10', name: 'Aussichtspunkt' },
            ],
          },
        },
      });
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
  await page.getByLabel('Länge', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Als Entwurf speichern', exact: true }).first().click();
  await expect(page).toHaveURL(/\/admin\/tours\/44/);
  await expect(page.getByText('Unveröffentlicht', { exact: true })).toBeVisible();
  expect(writes).toEqual([{ name: 'Neuer Rundweg', lengthKm: 4, visible: false, tourStops: [] }]);
});
