import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  gotoHomeAsAuthenticatedUser,
  mockSharedShellRequests,
  navigateClientSide,
} from './news-plugin.fixtures';

if (process.env.PLAYWRIGHT_RUNTIME_PROFILE === 'local-builder') {
  test.use({ storageState: { cookies: [], origins: [] } });
}

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

test('creates an FAQ on one page and retains edit tabs for update and delete', async ({ page }) => {
  test.setTimeout(60_000);
  await mockSharedShellRequests(page);
  let faq: Record<string, unknown> | undefined;
  let createdBody: Record<string, unknown> | undefined;
  let updatedBody: Record<string, unknown> | undefined;
  let deleted = false;
  let sawFaqTypeFilter = false;
  let sawFaqLanguageFilter = false;

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
      const languageCode = requestUrl.searchParams.get('languageCode');
      sawFaqTypeFilter ||= isFaqList;
      sawFaqLanguageFilter ||= isFaqList && languageCode === 'de';
      const faqRows = [
        {
          id: 'faq-existing',
          contentType: 'faq.faq',
          title: 'Wann ist geöffnet?',
          status: 'published',
          author: 'Editor One',
          createdAt: '2026-08-23T10:00:00.000Z',
          updatedAt: '2026-08-23T10:00:00.000Z',
          publishedAt: '2026-08-23T10:00:00.000Z',
          payload: { languageCode: 'de', sortWeight: 0 },
          access: {
            state: 'editable',
            canRead: true,
            canCreate: true,
            canUpdate: true,
            organizationIds: ['org-1'],
            sourceKinds: ['direct_role'],
          },
        },
        {
          id: 'faq-english',
          contentType: 'faq.faq',
          title: 'When are you open?',
          status: 'published',
          author: 'Editor One',
          createdAt: '2026-08-23T09:00:00.000Z',
          updatedAt: '2026-08-23T09:00:00.000Z',
          publishedAt: '2026-08-23T09:00:00.000Z',
          payload: { languageCode: 'en', sortWeight: 0 },
          access: {
            state: 'editable',
            canRead: true,
            canCreate: true,
            canUpdate: true,
            organizationIds: ['org-1'],
            sourceKinds: ['direct_role'],
          },
        },
      ];
      const filteredFaqRows = languageCode
        ? faqRows.filter(
            (item) => item.payload.languageCode.toLowerCase() === languageCode.toLowerCase()
          )
        : faqRows;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: isFaqList ? filteredFaqRows : [],
          pagination: {
            page: 1,
            pageSize: 25,
            total: isFaqList ? filteredFaqRows.length : 0,
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
            ? {
                data: {
                  ...faq,
                  dataProvider: { id: 'provider-user', name: 'Editor One' },
                },
                meta: { access: { 'content.publish': true } },
              }
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
  await expect(
    page.getByRole('link', { name: 'When are you open? bearbeiten' }).first()
  ).toBeVisible();
  expect(sawFaqTypeFilter).toBe(true);

  await page.getByLabel('Sprachcode').fill('de');
  await expect(page).toHaveURL(/languageCode=de/);
  await expect(
    page.getByRole('link', { name: 'Wann ist geöffnet? bearbeiten' }).first()
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'When are you open? bearbeiten' })).toHaveCount(0);
  expect(sawFaqLanguageFilter).toBe(true);

  await navigateClientSide(page, '/admin/faq/new');
  await expect(page.getByRole('heading', { name: 'FAQ anlegen' })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include('#main-content').analyze();
  expect(
    accessibility.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))
  ).toEqual([]);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  const createAction = page.getByRole('button', { name: 'FAQ anlegen', exact: true });
  await expect(createAction).toHaveCount(1);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const position of [0, 400]) {
      await page.evaluate((top) => window.scrollTo(0, top), position);
      await expect(createAction).toBeInViewport();
    }
  }
  await page.screenshot({ path: 'test-results/faq-create-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => window.scrollTo(0, 0));

  // An unchanged create form can be left without confirmation.
  await page.getByRole('link', { name: 'Zurück', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await navigateClientSide(page, '/admin/faq/new');
  await page.locator('#faq-question').fill('Ungespeicherte Frage');

  // Internal navigation can be cancelled without losing input, or explicitly confirmed.
  await page.getByRole('link', { name: 'Zurück', exact: true }).click();
  const leaveDialog = page.getByRole('alertdialog', { name: 'Ungespeicherte Eingaben verwerfen?' });
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole('button', { name: 'Weiterbearbeiten' }).click();
  await expect(page).toHaveURL(/\/admin\/faq\/new$/);
  await expect(page.locator('#faq-question')).toHaveValue('Ungespeicherte Frage');
  await page.getByRole('link', { name: 'Zurück', exact: true }).click();
  await leaveDialog.getByRole('button', { name: 'Verwerfen und verlassen' }).click();
  await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/);
  await navigateClientSide(page, '/admin/faq/new');

  // Browser Back reaches the same host guard rather than silently discarding the form.
  await page.locator('#faq-question').fill('Frage nach Browser-Zurück');
  await page.evaluate(() => window.history.back());
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole('button', { name: 'Weiterbearbeiten' }).click();
  await expect(page).toHaveURL(/\/admin\/faq\/new$/);
  await expect(page.locator('#faq-question')).toHaveValue('Frage nach Browser-Zurück');

  // Chromium's native reload warning preserves the current document when dismissed.
  const nativeDialogPromise = page.waitForEvent('dialog');
  const reloadResult = page.reload({ timeout: 5_000 }).then(
    () => null,
    (error: unknown) => error
  );
  const nativeDialog = await nativeDialogPromise;
  expect(nativeDialog.type()).toBe('beforeunload');
  await nativeDialog.dismiss();
  const reloadError = await reloadResult;
  expect(reloadError).toBeInstanceOf(Error);
  await expect(page.locator('#faq-question')).toHaveValue('Frage nach Browser-Zurück');
  await page.locator('#faq-question').fill('Wie erreiche ich das Bürgerbüro?');
  await page.locator('#faq-answer').fill('Mit Bus und Bahn.');
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
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
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

test('editorial create pages keep their core fields and save action usable on narrow screens', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const modules = [
    'news',
    'events',
    'poi',
    'surveys',
    'faq',
    'cockpit-cards',
    'projects',
    'generic-items',
    'vouchers',
  ];
  const permissionActions = modules.flatMap((module) =>
    ['read', 'create', 'update', 'delete'].map((action) => `${module}.${action}`)
  );
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: { page: 1, pageSize: 25, total: 0, hasNextPage: false },
      }),
    })
  );
  await mockSharedShellRequests(page);
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { ...faqUser.user, assignedModules: modules, permissionActions },
      }),
    })
  );
  await page.route('**/iam/me/permissions?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...faqPermissions,
        permissions: permissionActions.map((action) => ({
          action,
          resourceType: action.split('.')[0],
        })),
      }),
    })
  );
  await page.route('**/api/v1/mainserver/mutation-capabilities', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { enabledActions: permissionActions } }),
    })
  );
  await gotoHomeAsAuthenticatedUser(page);
  const pages = [
    ['news', '#news-title'],
    ['events', '#event-title'],
    ['poi', '#poi-name'],
    ['surveys', '#survey-title'],
    ['faq', '#faq-question'],
    ['cockpit-cards', '#cockpit-card-heading'],
    ['projects', '#project-title'],
    ['generic-items', '#generic-item-title'],
    ['vouchers', '#voucher-title'],
  ] as const;
  for (const [type, field] of pages) {
    await navigateClientSide(page, `/admin/${type}/new`);
    await expect(page.locator(field)).toBeVisible();
    await expect(page.getByRole('tablist')).toHaveCount(0);
    const save = page.locator('button[type="submit"][form]');
    await expect(save).toHaveCount(1);
    for (const mode of ['light', 'dark'] as const) {
      if ((await page.locator('html').getAttribute('data-theme-mode')) !== mode) {
        await page
          .getByRole('button', {
            name: mode === 'dark' ? 'Dunklen Modus aktivieren' : 'Hellen Modus aktivieren',
          })
          .click();
      }
      await expect(page.locator('html')).toHaveAttribute('data-theme-mode', mode);
      for (const width of [320, 390, 768, 1024, 1280, 1728]) {
        await page.setViewportSize({ width, height: 800 });
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(save).toBeInViewport();
        expect(await page.locator('form form, button button, a button, button a').count()).toBe(0);
        const actionBar = page.locator('.sticky').filter({ has: save });
        const rightInset = await actionBar.evaluate((bar) => {
          const button = bar.querySelector('button[type="submit"]');
          if (!button) throw new Error('Missing submit action');
          return bar.getBoundingClientRect().right - button.getBoundingClientRect().right;
        });
        expect(rightInset).toBeGreaterThanOrEqual(0);
        expect(rightInset).toBeLessThanOrEqual(24);
        const card = page.locator('[data-slot="studio-detail-card"]:visible').first();
        await expect(card).toBeVisible();
        expect(
          await actionBar.evaluate((element) => getComputedStyle(element).backgroundColor)
        ).toBe(await card.evaluate((element) => getComputedStyle(element).backgroundColor));
        const nestedSurfaces = page.locator(
          ':is(details, [data-slot="studio-detail-card"]) :is(details, [data-slot="studio-detail-card"])'
        );
        for (const surface of await nestedSurfaces.all()) {
          expect(
            await surface.evaluate((element) => {
              const style = getComputedStyle(element);
              return {
                border: style.borderTopWidth,
                padding: style.paddingTop,
                background: style.backgroundColor,
              };
            })
          ).toEqual({ border: '0px', padding: '0px', background: 'rgba(0, 0, 0, 0)' });
        }
        await page.screenshot({
          path: test.info().outputPath(`create-${type}-${mode}-${width}.png`),
          fullPage: true,
        });
        if (type === 'surveys') {
          const summaries = await page
            .locator(
              '#survey-create-text > details > summary, #survey-create-participation > details > summary'
            )
            .all();
          for (const summary of summaries) await summary.click();
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: test.info().outputPath(`create-surveys-${mode}-${width}-expanded.png`),
            fullPage: true,
          });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
          ).toBe(true);
          for (const summary of summaries) await summary.click();
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
        ).toBe(true);
        if (type === 'faq' && width === 390) {
          const publication = page.locator('#faq-publication-date');
          await publication.focus();
          await expect
            .poll(async () => {
              const fieldBox = await publication.boundingBox();
              const barBox = await page.locator('.sticky').filter({ has: save }).boundingBox();
              if (!fieldBox || !barBox) throw new Error('Missing focused field or action bar');
              return fieldBox.y + fieldBox.height - barBox.y;
            })
            .toBeLessThanOrEqual(0);
        }
      }
    }
  }
});
