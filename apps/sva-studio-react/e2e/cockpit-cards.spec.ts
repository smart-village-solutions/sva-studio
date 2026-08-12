import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  gotoHomeAsAuthenticatedUser,
  mockSharedShellRequests,
  navigateClientSide,
} from './news-plugin.fixtures';

const cockpitCardsUser = {
  user: {
    id: 'kc-editor-1',
    name: 'Editor One',
    email: 'editor@example.com',
    instanceId: 'de-musterhausen',
    assignedModules: ['cockpit-cards'],
    roles: ['editor'],
    permissionActions: [
      'cockpit-cards.read',
      'cockpit-cards.create',
      'cockpit-cards.update',
      'cockpit-cards.delete',
    ],
  },
};

const cockpitCardsPermissions = {
  instanceId: 'de-musterhausen',
  permissions: ['read', 'create', 'update', 'delete'].map((action) => ({
    action: `cockpit-cards.${action}`,
    resourceType: 'cockpit-cards',
  })),
  subject: { actorUserId: 'kc-editor-1', effectiveUserId: 'kc-editor-1', isImpersonating: false },
  evaluatedAt: '2026-08-09T12:00:00.000Z',
};

test('creates, updates and deletes a Kachel while preserving its server identity', async ({
  page,
}) => {
  await mockSharedShellRequests(page);
  let card: Record<string, unknown> | undefined;
  let createdBody: Record<string, unknown> | undefined;
  let updatedBody: Record<string, unknown> | undefined;
  let deleted = false;

  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cockpitCardsUser),
    })
  );
  await page.route('**/iam/me/permissions?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cockpitCardsPermissions),
    })
  );
  await page.route('**/api/v1/mainserver/categories', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 'category-1', name: 'Service' }] }),
    })
  );
  await page.route('**/api/v1/iam/media**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  );
  await page.route('**/api/v1/iam/contents**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: { page: 1, pageSize: 25, total: 0, hasNextPage: false },
      }),
    })
  );
  await page.route('**/api/v1/mainserver/cockpit-cards**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const isDetail = pathname.endsWith('/card-1');

    if (request.method() === 'POST') {
      createdBody = request.postDataJSON() as Record<string, unknown>;
      card = {
        ...createdBody,
        id: 'card-1',
        externalId: 'mainserver-card-4711',
        payload: { ...(createdBody.payload as object), importedBy: 'fixture' },
        createdAt: '2026-08-09T12:00:00.000Z',
        updatedAt: '2026-08-09T12:00:00.000Z',
      };
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: card }),
      });
    }
    if (isDetail && request.method() === 'GET') {
      return route.fulfill({
        status: card && !deleted ? 200 : 404,
        contentType: 'application/json',
        headers: card && !deleted ? { 'X-SVA-Context-Binding': 'v1.loaded-context' } : undefined,
        body: JSON.stringify(card && !deleted ? { data: card } : { error: 'not_found' }),
      });
    }
    if (isDetail && request.method() === 'PATCH') {
      updatedBody = request.postDataJSON() as Record<string, unknown>;
      card = {
        ...card,
        ...updatedBody,
        updatedAt: '2026-08-09T12:30:00.000Z',
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: card }),
      });
    }
    if (isDetail && request.method() === 'DELETE') {
      deleted = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'card-1' } }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: card && !deleted ? [card] : [],
        pagination: { page: 1, pageSize: 25, total: card && !deleted ? 1 : 0, hasNextPage: false },
      }),
    });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/cockpit-cards/new');
  await expect(page.getByRole('heading', { name: 'Kachel anlegen' })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include('#main-content').analyze();
  expect(
    accessibility.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))
  ).toEqual([]);
  await page.locator('#cockpit-card-heading').fill('Bürgerbüro');
  await page.locator('#cockpit-card-category').selectOption('Service');
  await page.getByRole('tab', { name: 'Inhalt' }).click();
  await page.getByRole('button', { name: 'Medium hinzufügen' }).click();
  await page.getByRole('button', { name: 'Medium per Link hinzufügen' }).click();
  await page.getByRole('button', { name: 'Medium hinzufügen' }).click();
  await page.getByRole('button', { name: 'Medium per Link hinzufügen' }).click();
  await page.getByLabel('Bild-URL').nth(0).fill('https://example.test/buergerbuero-aussen.jpg');
  await page.getByLabel('Alternativtext').nth(0).fill('Eingang des Bürgerbüros');
  await page.getByLabel('Bild-URL').nth(1).fill('https://example.test/buergerbuero-innen.jpg');
  await page.getByLabel('Alternativtext').nth(1).fill('Wartebereich des Bürgerbüros');
  await page.getByRole('tab', { name: 'Einstellungen' }).click();
  await page.locator('#cockpit-card-link').fill('https://example.test/buergerbuero');
  await page.locator('#cockpit-card-link-text').fill('Zum Bürgerbüro');
  await page.locator('#cockpit-card-open-new-tab').check();
  await page.getByRole('button', { name: 'Kachel anlegen' }).last().click();

  await expect.poll(() => createdBody).toBeDefined();
  expect(createdBody).not.toHaveProperty('externalId');
  expect(createdBody).toMatchObject({
    title: 'Bürgerbüro',
    genericType: 'COCKPIT_CARD',
    contentBlocks: [],
    mediaContents: [
      {
        sourceUrl: {
          url: 'https://example.test/buergerbuero-aussen.jpg',
          description: 'Eingang des Bürgerbüros',
        },
        contentType: 'image',
      },
      {
        sourceUrl: {
          url: 'https://example.test/buergerbuero-innen.jpg',
          description: 'Wartebereich des Bürgerbüros',
        },
        contentType: 'image',
      },
    ],
    webUrls: [{ url: 'https://example.test/buergerbuero', description: 'Zum Bürgerbüro' }],
    payload: { languageCode: 'de', sortWeight: 0, openInNewTab: true },
  });

  await expect(page).toHaveURL(/\/admin\/cockpit-cards\/card-1$/);
  await expect(page.locator('#cockpit-card-heading')).toHaveValue('Bürgerbüro');
  await page.locator('#cockpit-card-heading').fill('Bürgerbüro aktualisiert');
  await page.getByRole('button', { name: 'Kachel speichern' }).last().click();

  await expect.poll(() => updatedBody).toBeDefined();
  expect(updatedBody).toMatchObject({
    title: 'Bürgerbüro aktualisiert',
    externalId: 'mainserver-card-4711',
    payload: {
      languageCode: 'de',
      sortWeight: 0,
      openInNewTab: true,
      importedBy: 'fixture',
    },
  });

  await page.getByRole('button', { name: 'Kachel löschen' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Kachel löschen' }).click();
  await expect.poll(() => deleted).toBe(true);
});
