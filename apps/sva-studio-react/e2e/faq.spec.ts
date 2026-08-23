import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  gotoHomeAsAuthenticatedUser,
  mockSharedShellRequests,
  navigateClientSide,
} from './news-plugin.fixtures';

const faqUser = {
  user: {
    id: 'kc-editor-1',
    name: 'Editor One',
    email: 'editor@example.com',
    instanceId: 'de-musterhausen',
    assignedModules: ['faq'],
    roles: ['editor'],
    permissionActions: ['faq.read', 'faq.create', 'faq.update', 'faq.delete'],
  },
};

const faqPermissions = {
  instanceId: 'de-musterhausen',
  permissions: ['read', 'create', 'update', 'delete'].map((action) => ({
    action: `faq.${action}`,
    resourceType: 'faq',
  })),
  subject: { actorUserId: 'kc-editor-1', effectiveUserId: 'kc-editor-1', isImpersonating: false },
  evaluatedAt: '2026-08-23T12:00:00.000Z',
};

test('opens, creates, updates and deletes an FAQ across its editor tabs', async ({ page }) => {
  await mockSharedShellRequests(page);
  let faq: Record<string, unknown> | undefined;
  let createdBody: Record<string, unknown> | undefined;
  let updatedBody: Record<string, unknown> | undefined;
  let deleted = false;
  let sawFaqTypeFilter = false;

  await page.route('**/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(faqUser) })
  );
  await page.route('**/iam/me/permissions?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(faqPermissions),
    })
  );
  await page.route('**/api/v1/iam/contents**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/history')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
      return;
    }
    if (path === '/api/v1/iam/contents') {
      const requestUrl = new URL(route.request().url());
      const isFaqList = requestUrl.searchParams.get('type') === 'faq.faq';
      sawFaqTypeFilter ||= isFaqList;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: isFaqList
            ? [
                {
                  id: 'faq-existing',
                  contentType: 'faq.faq',
                  title: 'Wann ist geöffnet?',
                  status: 'published',
                  author: 'Editor One',
                  createdAt: '2026-08-23T10:00:00.000Z',
                  updatedAt: '2026-08-23T10:00:00.000Z',
                  publishedAt: '2026-08-23T10:00:00.000Z',
                  access: {
                    state: 'editable',
                    canRead: true,
                    canCreate: true,
                    canUpdate: true,
                    organizationIds: ['org-1'],
                    sourceKinds: ['direct_role'],
                  },
                },
              ]
            : [],
          pagination: {
            page: 1,
            pageSize: 25,
            total: isFaqList ? 1 : 0,
            hasNextPage: false,
          },
        }),
      });
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/v1/mainserver/faqs**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isDetail = url.pathname.endsWith('/faq-1');

    if (request.method() === 'POST') {
      createdBody = request.postDataJSON() as Record<string, unknown>;
      faq = {
        ...createdBody,
        id: 'faq-1',
        payload: { ...(createdBody.payload as object), importedBy: 'fixture' },
        createdAt: '2026-08-23T12:00:00.000Z',
        updatedAt: '2026-08-23T12:00:00.000Z',
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: faq }),
      });
      return;
    }
    if (isDetail && request.method() === 'GET') {
      await route.fulfill({
        status: faq && !deleted ? 200 : 404,
        contentType: 'application/json',
        headers: faq && !deleted ? { 'X-SVA-Context-Binding': 'v1.loaded-context' } : undefined,
        body: JSON.stringify(
          faq && !deleted
            ? { data: faq, meta: { access: { 'content.publish': true } } }
            : { error: 'not_found' }
        ),
      });
      return;
    }
    if (isDetail && request.method() === 'PATCH') {
      updatedBody = request.postDataJSON() as Record<string, unknown>;
      faq = { ...faq, ...updatedBody, updatedAt: '2026-08-23T12:30:00.000Z' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: faq }),
      });
      return;
    }
    if (isDetail && request.method() === 'DELETE') {
      deleted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'faq-1' } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: { page: 1, pageSize: 25, total: 0, hasNextPage: false },
      }),
    });
  });

  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/content?type=faq.faq&page=1');
  await expect(page.getByRole('heading', { name: 'Inhalte' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Wann ist geöffnet? bearbeiten' }).first()
  ).toBeVisible();
  expect(sawFaqTypeFilter).toBe(true);

  await navigateClientSide(page, '/admin/faq/new');
  await expect(page.getByRole('heading', { name: 'FAQ anlegen' })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include('#main-content').analyze();
  expect(
    accessibility.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))
  ).toEqual([]);
  await page.locator('#faq-question').fill('Wie erreiche ich das Bürgerbüro?');
  await page.getByRole('tab', { name: 'Inhalt' }).click();
  await page.locator('#faq-answer').fill('Mit Bus und Bahn.');
  await page.getByRole('tab', { name: 'Einstellungen' }).click();
  await page.locator('#faq-sort-weight').fill('7');
  await page.getByRole('button', { name: 'FAQ anlegen' }).last().click();

  await expect.poll(() => createdBody).toBeDefined();
  expect(createdBody).toMatchObject({
    title: 'Wie erreiche ich das Bürgerbüro?',
    genericType: 'FAQ',
    contentBlocks: [{ body: 'Mit Bus und Bahn.' }],
    payload: { languageCode: 'de', sortWeight: 7 },
    visible: true,
  });

  await expect(page).toHaveURL(/\/admin\/faq\/faq-1$/);
  await page.getByRole('tab', { name: 'Inhalt' }).click();
  await page.locator('#faq-answer').fill('Mit Bus, Bahn und Fahrrad.');
  await page.getByRole('tab', { name: 'Historie' }).click();
  await expect(page.getByText('Noch keine Historie verfügbar.')).toBeVisible();
  await page.getByRole('button', { name: 'FAQ speichern' }).last().click();

  await expect.poll(() => updatedBody).toBeDefined();
  expect(updatedBody).toMatchObject({
    title: 'Wie erreiche ich das Bürgerbüro?',
    contentBlocks: [{ body: 'Mit Bus, Bahn und Fahrrad.' }],
    payload: { languageCode: 'de', sortWeight: 7, importedBy: 'fixture' },
  });

  await page.getByRole('button', { name: 'FAQ löschen' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'FAQ löschen' }).click();
  await expect.poll(() => deleted).toBe(true);
  await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/);
});
