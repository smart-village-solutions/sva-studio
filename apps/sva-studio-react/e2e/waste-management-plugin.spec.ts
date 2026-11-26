import { captureStudioDesignState } from './studio-shell.helpers';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { mockWasteFacade, type WasteTourState } from './waste-management-plugin.helpers';

import {
  establishServerReadableAuthSession,
  gotoHomeAsAuthenticatedUser,
  navigateClientSide,
  registerSharedIamRoutes,
} from './studio-shell.helpers';

const mockSharedShellRequests = async (
  page: Page | BrowserContext,
  input: {
    readonly instanceId: string;
    readonly permissionActions: readonly string[];
  }
) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: `kc-${input.instanceId}`,
          name: 'Waste Operator',
          displayName: 'Waste Operator',
          email: 'waste@example.com',
          instanceId: input.instanceId,
          assignedModules: ['waste-management'],
          roles: ['editor'],
          permissionActions: input.permissionActions,
        },
      }),
    });
  });

  await page.route('**/iam/me/permissions?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        instanceId: input.instanceId,
        permissions: input.permissionActions.map((action) => ({
          action,
          resourceType: 'waste-management',
        })),
        subject: {
          actorUserId: `kc-${input.instanceId}`,
          effectiveUserId: `kc-${input.instanceId}`,
          isImpersonating: false,
        },
        evaluatedAt: '2026-05-10T12:00:00.000Z',
      }),
    });
  });

  await registerSharedIamRoutes(page);
};

const openWastePlugin = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
  await page.getByRole('link', { name: 'Abfallkalender' }).click();
  await expect(page.getByRole('heading', { name: 'Abfallkalender' })).toBeVisible();
};

test.describe('waste management plugin', () => {
  test('preserves scroll and settings focus through an access recheck', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    const instanceId = 'de-musterhausen';
    const permissionActions = ['waste-management.read', 'waste-management.settings.manage'];
    await mockSharedShellRequests(page, { instanceId, permissionActions });
    await mockWasteFacade(page, {
      instanceId,
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_calendar',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
      },
      fractions: [],
      tours: [],
    });
    await page.goto('/health/live');
    await establishServerReadableAuthSession(page.context(), page);
    await openWastePlugin(page);
    await page.getByRole('tab', { name: 'Einstellungen' }).click();
    await page.locator('summary').filter({ hasText: 'Link zur Webversion' }).click();
    const input = page.getByRole('textbox', { name: 'Link zur Webversion' });
    await input.scrollIntoViewIfNeeded({ timeout: 5_000 });
    await input.fill('https://abfall.example.invalid/');
    await expect(input).toBeFocused();
    const scrollPosition = await page.evaluate(() => window.scrollY);
    expect(scrollPosition).toBeGreaterThan(0);

    let finishAccessCheck!: () => void;
    const accessCheck = new Promise<void>((resolve) => {
      finishAccessCheck = resolve;
    });
    await page.route(
      '**/iam/me/permissions?**',
      async (route) => {
        await accessCheck;
        await route.fallback();
      },
      { times: 1 }
    );
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('sva:effective-access-invalidation-required'))
    );
    try {
      await expect(page.getByText('Berechtigungen werden geprüft …')).toBeVisible();
      await expect(input).toBeHidden();
      // Let the browser finish layout before checking its actual scroll position.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollPosition);
    } finally {
      finishAccessCheck();
    }
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('https://abfall.example.invalid/');
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollPosition);
  });

  for (const width of [1280, 390]) {
    test(`renders readable email monitoring at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await mockSharedShellRequests(page, {
        instanceId: 'de-musterhausen',
        permissionActions: ['waste-management.email-reminder-monitoring.read'],
      });
      const subscription = {
        id: '11111111-1111-4111-8111-111111111111',
        maskedEmail: 'a****************z@e****************e',
        status: 'active',
        city: 'Bad Wilsnack und Umgebung',
        createdAt: '2026-11-01T10:00:00Z',
        activatedAt: '2026-11-01T10:05:00Z',
        unsubscribedAt: null,
        lastSentEmail: { kind: 'doi', sentAt: '2026-11-01T10:05:00Z' },
        nextEmail: { kind: 'reminder', status: 'pending', scheduledAt: '2026-11-12T06:00:00Z' },
        items: [
          { fraction: 'Leichtverpackungen gelber Sack', slotId: 'yellow:email:first' },
          { fraction: 'Leichtverpackungen gelber Sack', slotId: 'yellow:email:second' },
          { fraction: 'Papier, Pappe, Kartonagen', slotId: 'paper:email:first' },
          { fraction: 'Hausmüll', slotId: 'legacy-slot' },
        ],
      };
      await page.route('**/api/v1/waste-management/email-monitoring?**', async (route) => {
        const selected = new URL(route.request().url()).searchParams.has('subscriptionId');
        await route.fulfill({
          json: {
            data: {
              subscriptions: [subscription],
              total: 1,
              activeTotal: 3,
              deliveryTotal: selected ? 1 : 0,
              deliveries: selected
                ? [
                    {
                      id: 'delivery-1',
                      kind: 'reminder',
                      status: 'failed',
                      createdAt: '2026-11-11T07:00:00Z',
                      scheduledAt: '2026-11-12T07:00:00Z',
                      sentAt: null,
                      attempts: 2,
                      fraction: 'Papier, Pappe, Kartonagen',
                      pickupDate: '2026-11-13',
                      error: 'dispatch_failed',
                    },
                  ]
                : [],
            },
          },
        });
      });
      const address = 'Rédaktion@example.invalid';
      const match = { ...subscription, maskedEmail: 'r******n@e********d' };
      const searchPath = '/api/v1/waste-management/email-monitoring/search';
      await page.route(`**${searchPath}`, (route) =>
        route.fulfill({
          json: {
            data: {
              subscriptions: [match],
              total: 1,
              activeTotal: 3,
              deliveryTotal: 0,
              deliveries: [],
            },
          },
        })
      );
      await page.goto('/health/live');
      await establishServerReadableAuthSession(page.context(), page);
      await gotoHomeAsAuthenticatedUser(page, 'Waste Operator');
      await navigateClientSide(page, '/plugins/waste-management/email-monitoring');
      await expect(page.getByRole('heading', { name: 'E-Mail-Abos und Versand' })).toBeVisible();
      await expect(
        page.getByText('Abo bestätigt', { exact: true }).filter({ visible: true })
      ).toBeVisible();
      await expect(page.getByText('legacy-slot')).toHaveCount(0);
      await expect(
        page.getByText('Zuletzt versendet', { exact: true }).filter({ visible: true })
      ).toBeVisible();
      await expect(
        page.getByText('Als Nächstes vorgemerkt', { exact: true }).filter({ visible: true })
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`monitoring-list-${width}.png`),
        fullPage: true,
      });
      await page.getByRole('button', { name: 'Versand ansehen' }).filter({ visible: true }).click();
      await expect(
        page
          .getByText(
            'Beim Versand ist ein Problem aufgetreten. Bitte an die technische Betreuung wenden.'
          )
          .filter({ visible: true })
      ).toBeVisible();
      await expect(page.getByText(subscription.id, { exact: true })).toBeHidden();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath(`monitoring-deliveries-${width}.png`),
        fullPage: true,
      });
      await page.getByText('Weitere Angaben für Rückfragen', { exact: true }).click();
      await expect(page.getByText(subscription.id, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Versand schließen' }).click();
      await expect(page.getByRole('heading', { name: 'Abonnements', exact: true })).toBeFocused();

      const urlBeforeSearch = page.url();
      const searchRequest = page.waitForRequest(
        (request) => new URL(request.url()).pathname === searchPath
      );
      const emailField = page.getByRole('textbox', { name: 'Vollständige E-Mail-Adresse' });
      await emailField.fill(address);
      await emailField.press('Enter');
      const submitted = await searchRequest;
      expect(submitted.method()).toBe('POST');
      expect(new URL(submitted.url()).search).toBe('');
      expect(submitted.postDataJSON()).toEqual({
        email: address,
        page: 1,
        pageSize: 100,
        deliveryPage: 1,
      });
      await expect(
        page.getByText(match.maskedEmail, { exact: true }).filter({ visible: true })
      ).toBeVisible();
      await expect(page.getByText('Aktive E-Mail-Abos 3', { exact: true })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Abo-Status' })).toBeDisabled();
      await expect(page.getByText(address, { exact: true })).toHaveCount(0);
      await expect(page).toHaveURL(urlBeforeSearch);

      await emailField.clear();
      await expect(
        page.getByText(subscription.maskedEmail, { exact: true }).filter({ visible: true })
      ).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Abo-Status' })).toBeEnabled();
    });
  }

  test.describe.configure({ timeout: 120_000 });
  test('keeps draft filters and focus local and provides sort controls across widths', async ({
    page,
  }) => {
    test.setTimeout(75_000);
    const stamp = '2026-05-10T11:00:00.000Z';
    await mockSharedShellRequests(page, {
      instanceId: 'de-musterhausen',
      permissionActions: ['waste-management.read'],
    });
    await mockWasteFacade(page, {
      instanceId: 'de-musterhausen',
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_ops',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
        lastCheckedAt: stamp,
      },
      fractions: [
        {
          id: 'fraction-1',
          name: 'Karton',
          pdfShortLabel: 'PPK',
          color: '#000000',
          active: true,
          createdAt: stamp,
          updatedAt: stamp,
        },
        {
          id: 'fraction-2',
          name: 'Biogut',
          pdfShortLabel: 'BIO',
          color: '#00aa44',
          active: false,
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
      tours: [],
    });
    await page.goto('/health/live');
    await establishServerReadableAuthSession(page.context(), page);
    await gotoHomeAsAuthenticatedUser(page, 'Waste Operator');
    await navigateClientSide(page, '/plugins/waste-management');
    page.setDefaultTimeout(7_000);
    await page.getByRole('tab', { name: 'Abfallarten' }).click();
    const panel = page.getByRole('tabpanel', { name: 'Abfallarten' });
    const trigger = panel.getByRole('button', { name: 'Filter', exact: true });
    const filter = page.getByRole('dialog');
    await expect(panel.getByRole('heading', { name: 'Abfallarten', exact: true })).toHaveCount(0);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 1280) {
        const shortLabelHeader = panel.getByRole('columnheader', { name: /Kürzel/ });
        await shortLabelHeader.getByRole('button').click();
        await expect(shortLabelHeader).toHaveAttribute('aria-sort', 'ascending');
      } else {
        const field = panel.getByLabel('Sortierfeld');
        await expect(field).toHaveValue('pdfShortLabel');
        await field.selectOption('status');
      }
      await trigger.click();
      await expect(filter).toHaveAccessibleName('Filter');
      await filter.getByRole('combobox', { name: 'Status', exact: true }).selectOption('active');
      await expect(page).not.toHaveURL(/fractionsStatus=active/);
      await page.keyboard.press('Escape');
      await expect(filter).toBeHidden();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(filter.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue(
        'all'
      );
      await filter.getByRole('combobox', { name: 'Status', exact: true }).selectOption('inactive');
      await filter.getByRole('button', { name: 'Filter anwenden' }).click();
      await expect(page).toHaveURL(/fractionsStatus=inactive/);
      await expect(
        panel.getByText('Biogut', { exact: true }).filter({ visible: true })
      ).toBeVisible();
      await expect(panel.getByText('Karton', { exact: true })).toHaveCount(0);
      await panel.getByRole('button', { name: 'Filter entfernen: Inaktiv' }).click();
      await expect(
        panel.getByText('Karton', { exact: true }).filter({ visible: true })
      ).toBeVisible();
    }
    await panel.getByRole('searchbox', { name: 'Suche' }).fill('PPK');
    await panel.getByRole('searchbox', { name: 'Suche' }).press('Enter');
    await expect(
      panel.getByText('Karton', { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await expect(panel.getByText('Biogut', { exact: true })).toHaveCount(0);
  });

  test('reads tour assignments in both directions after switching tabs', async ({ page }) => {
    await mockSharedShellRequests(page, {
      instanceId: 'de-musterhausen',
      permissionActions: ['waste-management.read', 'waste-management.tours.manage'],
    });
    const timestamps = {
      createdAt: '2026-05-10T12:00:00.000Z',
      updatedAt: '2026-05-10T12:00:00.000Z',
    };
    const pferdeschwemme = 'location-pferdeschwemme';
    const otherLocation = 'location-markt';
    const fixture = await mockWasteFacade(page, {
      instanceId: 'de-musterhausen',
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_calendar',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
      },
      fractions: [],
      tours: [2026, 2027].map((year) => ({
        id: `tour-${year}`,
        name: 'Restmüll',
        recurrence: 'weekly',
        wasteFractionIds: [],
        status: 'published',
        firstDate: `${year}-01-05`,
        endDate: `${year}-12-31`,
        ...timestamps,
      })),
      cities: [{ id: 'city-1', name: 'Perleberg', regionId: 'region-1', ...timestamps }],
      regions: [{ id: 'region-1', name: 'Prignitz', ...timestamps }],
      streets: ['Pferdeschwemme', 'Markt'].map((name) => ({
        id: `street-${name.toLowerCase()}`,
        name,
        cityId: 'city-1',
        ...timestamps,
      })),
      collectionLocations: [pferdeschwemme, otherLocation].map((id) => ({
        id,
        regionId: 'region-1',
        cityId: 'city-1',
        streetId: id.replace('location-', 'street-'),
        active: true,
        ...timestamps,
      })),
      locationTourLinks: [
        { id: 'link-existing', locationId: otherLocation, tourId: 'tour-2027', ...timestamps },
      ],
    });
    await page.goto('/health/live');
    await establishServerReadableAuthSession(page.context(), page);
    await openWastePlugin(page);
    page.setDefaultTimeout(12_000);
    await navigateClientSide(
      page,
      `/plugins/waste-management?tab=locations&locationsView=edit&collectionLocationId=${pferdeschwemme}&q=Pferde`
    );

    const locationAssignments = page.getByRole('table', { name: 'Tour-Zuordnungen' });
    const tourRowCheckbox = (year: number) =>
      locationAssignments
        .getByRole('row')
        .filter({ hasText: String(year) })
        .getByRole('checkbox');
    const locationsTab = page.getByRole('tab', { name: 'Abholpunkte', exact: true });
    const toursTab = page.getByRole('tab', { name: 'Touren', exact: true });
    const assignmentHeading = page.getByRole('heading', { name: 'Tour-Zuordnung', exact: true });
    const returnToList = page.getByRole('button', { name: 'Zurück zur Tourenliste', exact: true });
    const confirmDiscard = page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' });
    const locationCheckbox = page.getByRole('checkbox', {
      name: /Abholpunkt .*Pferdeschwemme.* auswählen/,
    });
    const assignmentCount = (year: number) =>
      page.getByTestId(`tour-assignment-count-tour-${year}`);
    const storedPairs = () =>
      fixture.locationTourLinks.map(({ locationId, tourId }) => `${locationId}/${tourId}`).sort();
    const initialPairs = [`${otherLocation}/tour-2027`];
    const locationSave = page.getByRole('button', { name: 'Zuordnungen speichern', exact: true });
    const expectLocationSaved = async () =>
      expect(page.getByText('Die Tour-Zuordnungen wurden aktualisiert.')).toBeVisible();

    await expect(locationAssignments.getByRole('checkbox', { name: /Restmüll/ })).toHaveCount(2);
    await toursTab.click();
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    const tourFilters = page.getByRole('dialog', { name: 'Touren filtern' });
    await tourFilters.getByRole('textbox', { name: 'Name' }).fill('Restm');
    await tourFilters.getByRole('button', { name: 'Filter anwenden', exact: true }).click();
    await expect(page).toHaveURL(/q=Restm/);
    await assignmentCount(2027).click();
    await expect(assignmentHeading).toBeVisible();
    await expect(returnToList).toBeFocused();
    await expect(page).toHaveURL(/toursView=assignments/);
    await page.getByRole('textbox', { name: 'Suche' }).fill('Pferdeschwemme');
    await expect(page.getByText('1 außerhalb des Filters ausgewählt')).toBeVisible();
    await locationCheckbox.check();
    await returnToList.click();
    await expect(confirmDiscard).toBeVisible();
    await confirmDiscard.getByRole('button', { name: 'Weiter bearbeiten' }).click();
    await expect(confirmDiscard).toBeHidden();
    await expect(locationCheckbox).toBeChecked();
    await expect(page.getByRole('textbox', { name: 'Suche' })).toHaveValue('Pferdeschwemme');
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();
    await expect(assignmentHeading).toBeHidden();
    await expect(page).toHaveURL(/q=Restm/);
    await expect.poll(storedPairs).toEqual([...initialPairs, `${pferdeschwemme}/tour-2027`]);

    await locationsTab.click();
    await expect(page).toHaveURL(/q=Pferde/);
    await expect(page).toHaveURL(/locationsView=edit/);
    await expect(tourRowCheckbox(2027)).toBeChecked();
    await expect(tourRowCheckbox(2026)).not.toBeChecked();
    await tourRowCheckbox(2027).uncheck();
    await locationSave.click();
    await expectLocationSaved();
    await expect.poll(storedPairs).toEqual(initialPairs);

    await toursTab.click();
    await expect(assignmentCount(2027)).toHaveText('1');
    await assignmentCount(2027).click();
    await expect(locationCheckbox).not.toBeChecked();
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();

    await locationsTab.click();
    await tourRowCheckbox(2026).check();
    await locationSave.click();
    await expectLocationSaved();
    await expect.poll(storedPairs).toEqual([...initialPairs, `${pferdeschwemme}/tour-2026`]);

    await toursTab.click();
    await expect(assignmentCount(2026)).toHaveText('1');
    await assignmentCount(2026).click();
    await expect(locationCheckbox).toBeChecked();
    await locationCheckbox.uncheck();
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();
    await expect(assignmentHeading).toBeHidden();
    await expect.poll(storedPairs).toEqual(initialPairs);

    await locationsTab.click();
    await expect(tourRowCheckbox(2026)).not.toBeChecked();
    await expect(tourRowCheckbox(2027)).not.toBeChecked();

    await toursTab.click();
    const tourRow = page.getByRole('row').filter({ has: assignmentCount(2026) });
    await tourRow.getByRole('link', { name: 'Restmüll', exact: true }).click();
    await page.getByRole('button', { name: 'Abholpunkte zuordnen', exact: true }).click();
    await expect(assignmentHeading).toBeVisible();
    await expect(page).toHaveURL(/tourId=tour-2026/);
    await page.setViewportSize({ width: 640, height: 780 });
    await expect(page.getByRole('textbox', { name: 'Suche' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Änderungen speichern' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 780 });
    await returnToList.focus();
    await page.keyboard.press('Tab');
    const search = page.getByRole('textbox', { name: 'Suche' });
    await expect(search).toBeFocused();
    await search.fill('Pferdeschwemme');
    await expect(locationCheckbox).toBeVisible();
    await locationCheckbox.focus();
    await page.keyboard.press('Space');
    await expect(locationCheckbox).toBeChecked();
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await expect(confirmDiscard).toBeVisible();
    await confirmDiscard.getByRole('button', { name: 'Verwerfen und zurück' }).click();
    await expect(assignmentHeading).toBeHidden();
    await expect(page).toHaveURL(/q=Restm/);
    await expect.poll(storedPairs).toEqual(initialPairs);
  });

  test('keeps partial annual-calendar dates visible and explains missing recurring data', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-06-01T12:00:00Z'));
    await mockSharedShellRequests(page, {
      instanceId: 'de-musterhausen',
      permissionActions: ['waste-management.read', 'waste-management.tours.manage'],
    });
    const tour = {
      id: 'partial-tour',
      name: 'Unvollständige Tour',
      recurrence: 'weekly' as const,
      wasteFractionIds: [],
      status: 'published' as const,
      customDates: [{ date: '2026-03-02' }],
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    };
    await mockWasteFacade(page, {
      instanceId: 'de-musterhausen',
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_calendar',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
      },
      fractions: [],
      tours: [tour],
    });
    await page.goto('/health/live');
    await establishServerReadableAuthSession(page.context(), page);
    await openWastePlugin(page);
    await page.getByRole('tab', { name: 'Touren' }).click();
    await page.getByRole('button', { name: 'Jahreskalender anzeigen' }).click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByText('Die Terminübersicht ist möglicherweise unvollständig.')
    ).toBeVisible();
    await expect(dialog.getByText('Für die regelmäßige Tour fehlt das Startdatum.')).toBeVisible();
    await expect(dialog.getByText('2026-03-02', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Keine berechneten Termine in diesem Monat.')).toHaveCount(0);
    await captureStudioDesignState(page, 'waste-calendar-partial', '[role=dialog]');
    await page.getByRole('button', { name: 'Folgejahr', exact: true }).click();
    await expect(dialog.getByText('Termine können derzeit nicht berechnet werden.')).toBeVisible();
    await expect(dialog.getByText('2026-03-02', { exact: true })).toHaveCount(0);
  });

  test('distinguishes annual-calendar loading from a failed scheduling request', async ({
    page,
  }) => {
    await mockSharedShellRequests(page, {
      instanceId: 'de-musterhausen',
      permissionActions: ['waste-management.read'],
    });
    await mockWasteFacade(page, {
      instanceId: 'de-musterhausen',
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_calendar',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
      },
      fractions: [],
      tours: [
        {
          id: 'empty-tour',
          name: 'Einzeltermine',
          wasteFractionIds: [],
          recurrence: 'custom',
          status: 'published',
          createdAt: '2026-01-01T10:00:00.000Z',
          updatedAt: '2026-01-01T10:00:00.000Z',
        },
      ],
    });
    let release: (() => void) | undefined;
    const responseReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/v1/waste-management/scheduling**', async (route) => {
      await responseReady;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/health/live');
    await establishServerReadableAuthSession(page.context(), page);
    await openWastePlugin(page);
    await page.getByRole('tab', { name: 'Touren' }).click();
    await page.getByRole('button', { name: 'Jahreskalender anzeigen' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Termine werden geladen …')).toBeVisible();
    release?.();
    await expect(dialog.getByText('Die Planungsdaten konnten nicht geladen werden.')).toBeVisible();
    await expect(dialog.getByText('Termine werden geladen …')).toHaveCount(0);
    await expect(dialog.getByText('Keine berechneten Termine in diesem Monat.')).toHaveCount(0);
  });

  test('opens separate assignment and date-shift tabs from the same tour', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    await mockSharedShellRequests(context, {
      instanceId: 'de-musterhausen',
      permissionActions: [
        'waste-management.read',
        'waste-management.tours.manage',
        'waste-management.scheduling.manage',
      ],
    });
    await mockWasteFacade(context, {
      instanceId: 'de-musterhausen',
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_calendar',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
      },
      fractions: [],
      tours: [
        {
          id: 'tour-1',
          name: 'Restmüll Nord',
          wasteFractionIds: [],
          recurrence: 'weekly',
          firstDate: '2026-05-12',
          status: 'published',
          createdAt: '2026-05-10T11:00:00.000Z',
          updatedAt: '2026-05-10T11:00:00.000Z',
        },
      ],
    });
    await page.goto('/health/live');
    await establishServerReadableAuthSession(context, page);
    await openWastePlugin(page);
    await navigateClientSide(
      page,
      '/plugins/waste-management?tab=tours&toursView=edit&tourId=tour-1'
    );

    for (const [linkLabel, tabLabel, tabParam] of [
      ['Tour-Einsätze', 'Tour-Einsätze', 'tourAssignments'],
      ['Tourbezogene Ausweichtermine', 'Ausweichtermine', 'scheduling'],
    ]) {
      const popupPromise = page.waitForEvent('popup');
      await page.getByRole('link', { name: new RegExp(`^${linkLabel}`) }).click();
      const popup = await popupPromise;
      // A new document initializes authentication and permissions before rendering the tabs.
      await expect(popup.getByRole('tab', { name: tabLabel, exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
        { timeout: 30_000 }
      );
      const params = new URL(popup.url()).searchParams;
      expect(params.get('tab')).toBe(tabParam);
      expect(params.get('tourId')).toBe('tour-1');
      await popup.close();
    }
    await expect(page).toHaveURL(/toursView=edit/u);
  });

  test('opens contextual tour-shift creation in a new tab without losing the tour workflow', async ({
    context,
    page,
  }) => {
    test.setTimeout(180_000);
    await page.clock.setFixedTime(new Date('2026-05-12T12:00:00.000Z'));
    await mockSharedShellRequests(context, {
      instanceId: 'de-tour-shift-context',
      permissionActions: [
        'waste-management.read',
        'waste-management.tours.manage',
        'waste-management.scheduling.manage',
      ],
    });
    await mockWasteFacade(context, {
      instanceId: 'de-tour-shift-context',
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_shift_context',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
      },
      fractions: [],
      tours: [
        {
          id: 'tour-1',
          name: 'Restmüll Nord',
          wasteFractionIds: [],
          recurrence: 'weekly',
          firstDate: '2026-05-12',
          status: 'published',
          createdAt: '2026-05-10T11:00:00.000Z',
          updatedAt: '2026-05-10T11:00:00.000Z',
        },
      ],
    });

    await page.goto('/health/live');
    await establishServerReadableAuthSession(context, page);
    await openWastePlugin(page);
    await page.getByRole('tab', { name: 'Touren' }).click();
    await page.getByRole('button', { name: 'Jahreskalender anzeigen' }).click();
    await captureStudioDesignState(page, 'waste-year-calendar', '[role=dialog]');

    const createShiftLink = page
      .getByRole('link', {
        name: /Termin .* der Tour Restmüll Nord verschieben Öffnet in neuem Tab/u,
      })
      .first();
    await expect(createShiftLink).toHaveAttribute('target', '_blank');
    await expect(createShiftLink).toHaveAttribute('rel', 'noopener noreferrer');

    const sourceUrl = page.url();
    const popupPromise = page.waitForEvent('popup');
    await createShiftLink.click();
    const popup = await popupPromise;

    await expect(popup.getByRole('heading', { name: 'Abfallkalender' })).toBeVisible();
    await expect(popup.locator('#waste-tour-shift-tour')).toHaveValue('tour-1', {
      timeout: 30_000,
    });
    await expect(popup.locator('#waste-tour-shift-original-date')).toHaveValue('12.05.2026');
    await expect(popup).toHaveURL(/schedulingTourId=tour-1/u);
    await expect(popup).toHaveURL(/schedulingOriginalDate=2026-05-12/u);
    await expect(page).toHaveURL(sourceUrl);
    await expect(page.getByRole('heading', { name: 'Jahreskalender' })).toBeVisible();
  });

  test('supports settings, fraction creation and technical job starters through the host facade', async ({
    page,
  }) => {
    page.setDefaultTimeout(8_000);
    page.setDefaultNavigationTimeout(45_000);
    await mockSharedShellRequests(page, {
      instanceId: 'de-musterhausen',
      permissionActions: [
        'waste-management.read',
        'waste-management.master-data.manage',
        'waste-management.tours.manage',
        'waste-management.scheduling.manage',
        'waste-management.export.execute',
        'waste-management.import.execute',
        'waste-management.seed.execute',
        'waste-management.reset.execute',
        'waste-management.settings.manage',
      ],
    });

    const harness = await mockWasteFacade(page, {
      instanceId: 'de-musterhausen',
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_ops',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
        lastCheckedAt: '2026-05-10T12:00:00.000Z',
      },
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#111111',
          active: true,
          createdAt: '2026-05-10T11:00:00.000Z',
          updatedAt: '2026-05-10T11:00:00.000Z',
        },
      ],
      tours: [
        {
          id: 'tour-1',
          name: 'Restmüll Nord',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          firstDate: '2026-05-12',
          status: 'published',
          createdAt: '2026-05-10T11:00:00.000Z',
          updatedAt: '2026-05-10T11:00:00.000Z',
        },
      ],
      regions: [
        {
          id: 'region-1',
          name: 'Nord',
          createdAt: '2026-05-10T11:00:00.000Z',
          updatedAt: '2026-05-10T11:00:00.000Z',
        },
      ],
      cities: [
        {
          id: 'city-1',
          regionId: 'region-1',
          name: 'Musterhausen',
          createdAt: '2026-05-10T11:00:00.000Z',
          updatedAt: '2026-05-10T11:00:00.000Z',
        },
      ],
      streets: [
        {
          id: 'street-1',
          cityId: 'city-1',
          name: 'Hauptstraße',
          createdAt: '2026-05-10T11:00:00.000Z',
          updatedAt: '2026-05-10T11:00:00.000Z',
        },
        ...['Bahnhofstraße', 'Dorfstraße', 'Gartenstraße', 'Marktstraße', 'Wallstraße'].map(
          (name, index) => ({
            id: `street-filter-${index}`,
            cityId: 'city-1',
            name,
            createdAt: '2026-05-10T11:00:00.000Z',
            updatedAt: '2026-05-10T11:00:00.000Z',
          })
        ),
      ],
      houseNumbers: [
        {
          id: 'house-1',
          streetId: 'street-1',
          number: '7',
          createdAt: '2026-05-10T11:00:00.000Z',
          updatedAt: '2026-05-10T11:00:00.000Z',
        },
      ],
      collectionLocations: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          regionId: 'region-1',
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
          active: true,
          createdAt: '2026-05-10T11:00:00.000Z',
          updatedAt: '2026-05-10T11:00:00.000Z',
        },
      ],
    });

    await openWastePlugin(page);

    const tabs = [
      ['Abfallarten', 'fractions'],
      ['Touren', 'tours'],
      ['Abholpunkte', 'locations'],
      ['Stammdaten', 'addresses'],
      ['Ausweichtermine', 'shifts'],
      ['Tour-Einsätze', 'visits'],
      ['Ausgabe', 'output'],
      ['Datentools', 'tools'],
      ['Einstellungen', 'settings'],
    ] as const;
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [index, [name, id]] of tabs.entries()) {
        if (width === 390) {
          await page
            .getByRole('combobox', { name: 'Abfallmanagement-Bereiche' })
            .selectOption({ label: name });
        } else {
          await page.getByRole('tab', { name, exact: true }).click();
        }
        const panel = page.getByRole('tabpanel', { name, exact: true });
        await expect(panel).toBeVisible();
        await expect(panel.getByRole('heading', { name, exact: true })).toHaveCount(0);
        if (id === 'addresses') {
          await expect(panel.getByRole('combobox', { name: 'Datentyp' })).toBeVisible();
        } else if (index < 6) {
          await expect(panel.getByRole('button', { name: 'Filter', exact: true })).toBeVisible();
          if (id === 'locations') await expect(panel.getByRole('table')).toBeVisible();
        } else {
          await expect(panel.locator('summary').first()).toBeVisible();
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: test.info().outputPath(`waste-${id}-closed-${width}.png`) });
        if (index >= 6) continue;
        if (id === 'addresses') {
          await panel.getByRole('combobox', { name: 'Datentyp' }).selectOption('city');
        }
        const button = panel.getByRole('button', { name: 'Filter', exact: true });
        await button.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        if (id === 'visits') {
          await expect(dialog.getByRole('combobox')).toHaveCount(1);
        }
        if (id === 'shifts') {
          await expect(dialog.getByRole('group', { name: 'Ursprünglicher Termin' })).toBeVisible();
        }
        await page.screenshot({ path: test.info().outputPath(`waste-${id}-filter-${width}.png`) });
        if (id === 'locations' && width === 1280) {
          const street = dialog.getByRole('combobox', { name: 'Straße', exact: true });
          await street.click();
          const streetOptions = page.getByRole('listbox', { name: 'Straße', exact: true });
          await streetOptions.getByRole('option').first().hover();
          await page.mouse.wheel(0, 600);
          const lastStreet = streetOptions.getByRole('option', { name: /Wallstraße/ });
          await expect(lastStreet).toBeInViewport({ ratio: 1 });
          await lastStreet.click();
          await expect(street).toHaveValue('street-filter-4');
        }
        if (id === 'shifts' && width === 1280) {
          const from = dialog.getByRole('textbox', { name: 'Von', exact: true });
          await from.fill('26.12.2026');
          await from.press('Tab');
          await expect(page).not.toHaveURL(/shiftDateFrom=/);
          await dialog.getByRole('button', { name: 'Filter anwenden' }).click();
          await expect(page).toHaveURL(/shiftDateFrom=2026-12-26/);
          await panel.getByRole('button', { name: /Filter entfernen: Von/ }).click();
          await expect(page).not.toHaveURL(/shiftDateFrom=/);
          await button.click();
        }
        await page.keyboard.press('Escape');
        await expect(button).toBeFocused();
      }
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByRole('tab', { name: 'Einstellungen' }).click();
    await page.locator('summary').filter({ hasText: 'Bereitstellung' }).click();
    await expect(
      page
        .getByText(
          'Die Abfalldatenbank wird automatisch für diese Instanz bereitgestellt und verwaltet.'
        )
        .first()
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Schema' })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Schema' })).toHaveValue('waste_ops');
    await expect(page.locator('input[placeholder="https://example.supabase.co"]')).toHaveCount(0);

    await captureStudioDesignState(page, 'waste-settings');
    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();

    await expect(page.getByRole('button', { name: 'Gespeichert' })).toBeVisible();
    expect(harness.requests.settingsUpdates).toHaveLength(1);
    expect(harness.requests.settingsUpdates[0]).toMatchObject({
      provider: 'postgresql',
      schemaName: 'waste_ops',
      enabled: true,
    });

    await page.getByRole('tab', { name: 'Abfallarten' }).click();
    await expect(page.getByRole('button', { name: 'Fraktion anlegen' })).toBeVisible();
    await page.getByRole('button', { name: 'Fraktion anlegen' }).click();
    await page.locator('#waste-fraction-name').fill('Papier');
    await page.locator('#waste-fraction-pdf-short-label').fill('PPK');
    await page.locator('#waste-fraction-color-text').fill('#00aaee');
    await page.locator('#waste-fraction-container-size').fill('240l');
    await page.locator('#waste-fraction-description').fill('Papierfraktion für den E2E-Pfad.');
    await page
      .locator('#waste-fraction-create-form')
      .getByRole('button', { name: 'Abfallart speichern' })
      .click();

    await expect(page.getByRole('button', { name: 'Fraktion anlegen' })).toBeVisible();
    await expect(
      page.getByRole('row', { name: /Papier \(240l\).*Papierfraktion für den E2E-Pfad\./ })
    ).toBeVisible();
    expect(harness.requests.createdFractions).toHaveLength(1);
    expect(harness.requests.createdFractions[0]).toMatchObject({
      name: 'Papier',
      pdfShortLabel: 'PPK',
      color: '#00aaee',
      containerSize: '240l',
    });

    await page.getByRole('tab', { name: 'Datentools' }).click();
    await page.locator('summary').filter({ hasText: 'Fachdaten exportieren' }).click();
    await page.getByRole('checkbox', { name: 'Touren' }).click();
    await page.getByRole('button', { name: 'Export starten' }).click();
    expect(harness.requests.exportInputs).toEqual([
      {
        profileIds: ['waste-management.fraktionen', 'waste-management.touren'],
        targetFormat: 'application/zip',
      },
    ]);
    await page
      .locator('summary')
      .filter({ hasText: /^Importe$/ })
      .click();
    await page.getByRole('button', { name: /Tourzuordnungen nach Fraktionen/ }).click();
    await page.locator('input[type="file"]:visible').setInputFiles({
      name: 'tenant-a.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'Ort;Straße;Hausmüll;Papier;Gelbe Säcke\nPerleberg;Ackerstr.;HM.3.3;PPK.7.2;LVP.9.4\n'
      ),
    });
    await page.getByRole('button', { name: 'Vorschau prüfen' }).click();
    await expect(page.getByRole('button', { name: 'Import starten' })).toBeVisible();
    await page.getByRole('button', { name: 'Import starten' }).click();
    await page.locator('summary').filter({ hasText: 'Erweiterte Systemfunktionen' }).click();
    await page.getByLabel('Zielschema').fill('waste_ops_v2');
    await page.getByLabel('Anfordernde Version').fill('2026.05.10');
    await page.getByRole('button', { name: 'Migrationen starten' }).click();
    await page.getByRole('button', { name: 'Initialdaten laden' }).click();
    await page.getByRole('button', { name: 'Daten zurücksetzen' }).click();
    await page.getByLabel('Bestätigungstoken').fill('RESET');
    await page.getByRole('button', { name: 'Zurücksetzen bestätigen' }).click();

    await expect(page.getByText('Prozess job-reset-1 wurde gestartet.')).toBeVisible();

    await page.getByRole('tab', { name: 'Ausgabe' }).click();
    const outputPanel = page.getByRole('tabpanel', { name: 'Ausgabe' });
    await expect(outputPanel).toBeVisible();
    const pdfDisclosure = outputPanel.locator('summary').filter({ hasText: 'PDF-Inhalte' });
    await pdfDisclosure.click();
    await outputPanel.getByLabel('Branding-Grafik').fill('https://cdn.example/logo.svg');
    await outputPanel.getByLabel('Kontakt- und Freitextblock').fill('Service-Telefon 03395 123456');
    await pdfDisclosure.click();
    await expect(outputPanel.getByLabel('Kontakt- und Freitextblock')).toBeHidden();
    await pdfDisclosure.click();
    await expect(outputPanel.getByLabel('Kontakt- und Freitextblock')).toHaveValue(
      'Service-Telefon 03395 123456'
    );
    await outputPanel.getByRole('button', { name: 'PDF-Inhalte speichern' }).click();
    await expect(outputPanel.getByRole('button', { name: 'Gespeichert' })).toBeVisible();
    expect(harness.requests.settingsUpdates.at(-1)).toMatchObject({
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Service-Telefon 03395 123456',
    });

    expect(harness.requests.startedJobTypes).toEqual([
      'waste-management.export-data',
      'waste-management.import-data',
      'waste-management.apply-migrations',
      'waste-management.seed-data',
      'waste-management.reset-data',
    ]);
  });

  test('keeps settings instance-scoped and hides master-data mutations without the dedicated permission', async ({
    page,
  }) => {
    await mockSharedShellRequests(page, {
      instanceId: 'de-zweitstadt',
      permissionActions: ['waste-management.read', 'waste-management.settings.manage'],
    });

    await mockWasteFacade(page, {
      instanceId: 'de-zweitstadt',
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_b',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
        lastCheckedAt: '2026-05-10T13:00:00.000Z',
      },
      fractions: [
        {
          id: 'fraction-2',
          name: 'Bioabfall',
          color: '#22aa44',
          active: true,
          createdAt: '2026-05-10T11:30:00.000Z',
          updatedAt: '2026-05-10T11:30:00.000Z',
        },
      ],
      tours: [],
      allowFractionCreate: false,
    });

    await openWastePlugin(page);
    await page.getByRole('tab', { name: 'Einstellungen' }).click();
    await page.locator('summary').filter({ hasText: 'Bereitstellung' }).click();
    await expect(page.getByRole('textbox', { name: 'Schema' })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Schema' })).toHaveValue('waste_b');
    await expect(page.getByRole('textbox', { name: 'Schema' })).not.toHaveValue('waste_ops');
    await expect(page.locator('input[placeholder="https://example.supabase.co"]')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Abfallarten' }).click();
    await expect(
      page.getByRole('table', { name: 'Tabelle der Abfallfraktionen' }).getByText('Bioabfall')
    ).toBeVisible();
    await page.getByRole('button', { name: 'Fraktion anlegen' }).click();
    await page.locator('#waste-fraction-name').fill('Papier Plus');
    await page.locator('#waste-fraction-pdf-short-label').fill('PP');
    await page.locator('#waste-fraction-color-text').fill('#123456');
    await page
      .locator('#waste-fraction-create-form')
      .getByRole('button', { name: 'Abfallart speichern' })
      .click();
    await expect(
      page.getByText('Für das Speichern von Abfall-Fraktionen fehlt die Berechtigung.').first()
    ).toBeVisible();
  });

  test('supports custom recurrence preset creation, tour selection, editing and fallback deletion', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.clock.setFixedTime(new Date('2026-06-01T12:00:00Z'));
    await mockSharedShellRequests(page, {
      instanceId: 'de-recurring',
      permissionActions: [
        'waste-management.read',
        'waste-management.settings.manage',
        'waste-management.tours.manage',
      ],
    });

    const extraStreets = ['Bahnhofstraße', 'Dorfstraße', 'Gartenstraße', 'Schulstraße', 'Wallstraße'].map(
      (name, index) => ({
        id: `street-custom-${index + 1}`,
        cityId: 'city-custom',
        name,
        createdAt: '2026-05-10T11:00:00Z',
        updatedAt: '2026-05-10T11:00:00Z',
      })
    );
    const harness = await mockWasteFacade(page, {
      instanceId: 'de-recurring',
      settings: {
        provider: 'supabase',
        projectUrl: 'https://tenant-c.supabase.co',
        schemaName: 'waste_custom',
        enabled: true,
        databaseUrlConfigured: true,
        serviceRoleKeyConfigured: true,
        visibleStatus: 'ok',
        lastCheckedAt: '2026-05-10T14:00:00.000Z',
        customRecurrencePresets: [],
      },
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#111111',
          active: true,
          createdAt: '2026-05-10T11:00:00.000Z',
          updatedAt: '2026-05-10T11:00:00.000Z',
        },
      ],
      regions: [
        {
          id: 'region-custom',
          name: 'Musterregion',
          createdAt: '2026-05-10T11:00:00Z',
          updatedAt: '2026-05-10T11:00:00Z',
        },
      ],
      cities: [
        {
          id: 'city-custom',
          regionId: 'region-custom',
          name: 'Musterhausen',
          createdAt: '2026-05-10T11:00:00Z',
          updatedAt: '2026-05-10T11:00:00Z',
        },
      ],
      streets: [
        {
          id: 'street-custom',
          cityId: 'city-custom',
          name: 'Markt',
          createdAt: '2026-05-10T11:00:00Z',
          updatedAt: '2026-05-10T11:00:00Z',
        },
        ...extraStreets,
      ],
      collectionLocations: [
        {
          id: 'location-custom',
          cityId: 'city-custom',
          streetId: 'street-custom',
          active: true,
          createdAt: '2026-05-10T11:00:00Z',
          updatedAt: '2026-05-10T11:00:00Z',
        },
        ...extraStreets.map((street, index) => ({
          id: `location-custom-${index + 1}`,
          cityId: street.cityId,
          streetId: street.id,
          active: true,
          createdAt: street.createdAt,
          updatedAt: street.updatedAt,
        })),
      ],
      tours: [],
    });

    await openWastePlugin(page);
    await page.getByRole('tab', { name: 'Einstellungen' }).click();
    await page.locator('summary').filter({ hasText: 'Eigene Turnusse' }).click();

    await page.getByRole('button', { name: 'Abstand hinzufügen' }).click();
    await page.locator('#waste-settings-custom-recurrence-name').fill('Ferien 10 Tage');
    await page.locator('#waste-settings-custom-recurrence-interval-days').selectOption('10');
    await page
      .locator('#waste-settings-custom-recurrence-description')
      .fill('Saisonaler Sommerturnus');
    await page.getByRole('button', { name: 'Abstand übernehmen' }).click();

    await page.getByRole('button', { name: 'Abstand hinzufügen' }).click();
    await page.locator('#waste-settings-custom-recurrence-name').fill('14 Tage Fallback');
    await page.locator('#waste-settings-custom-recurrence-interval-days').selectOption('14');
    await page
      .locator('#waste-settings-custom-recurrence-description')
      .fill('Fallback für entfernte Sommerturnusse');
    await page.getByRole('button', { name: 'Abstand übernehmen' }).click();

    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
    await expect(page.getByRole('button', { name: 'Gespeichert' })).toBeVisible();

    const createdPresetIds = (
      (harness.requests.settingsUpdates[0]?.customRecurrencePresets as
        Array<Record<string, unknown>> | undefined) ?? []
    ).map((preset) => String(preset.id));
    expect(createdPresetIds).toHaveLength(2);

    await page.getByRole('tab', { name: 'Touren' }).click();
    await page.getByRole('button', { name: 'Neue Tour' }).click();
    await page.locator('#waste-tour-name').fill('Ferienroute');
    await page.getByRole('button', { name: 'Abfallfraktionen', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Restmüll', exact: true }).check();
    await page.keyboard.press('Escape');
    const recurrenceSelect = page.locator('#waste-tour-recurrence');
    await recurrenceSelect.press('ArrowDown');
    const recurrenceOptions = page.getByRole('listbox');
    await recurrenceOptions.hover();
    const recurrenceScrollStart = await recurrenceOptions.evaluate((list) => list.scrollTop);
    await page.mouse.wheel(0, 120);
    await expect.poll(() => recurrenceOptions.evaluate((list) => list.scrollTop)).toBeGreaterThan(
      recurrenceScrollStart
    );
    await page.keyboard.press('Escape');
    await recurrenceSelect.selectOption('custom');
    await page.getByRole('button', { name: 'Tage im Kalender auswählen' }).click();
    const selectedDay = page.getByRole('button', { name: 'Dienstag, 2. Juni 2026', exact: true });
    await selectedDay.focus();
    await selectedDay.press('Space');
    await expect(selectedDay.locator('..')).toHaveAttribute('aria-selected', 'true');
    await selectedDay.press('ArrowRight');
    await expect(
      page.getByRole('button', { name: 'Mittwoch, 3. Juni 2026', exact: true })
    ).toBeFocused();
    await captureStudioDesignState(page, 'waste-custom-date-picker', '[role=dialog]');
    await page.getByRole('button', { name: 'Auswahl übernehmen', exact: true }).click();
    await page.getByRole('button', { name: 'Termin bearbeiten', exact: true }).click();
    await page.getByRole('button', { name: 'Abholpunkt zuweisen', exact: true }).click();
    const locationTrigger = page.getByRole('button', { name: 'Abholpunkt', exact: true });
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: viewport.width, height: 420 });
    await locationTrigger.evaluate((trigger) =>
      trigger.scrollIntoView({ block: 'center', behavior: 'instant' })
    );
    await locationTrigger.press('Enter');
    const locationOptions = page.getByRole('listbox', { name: 'Abholpunkt', exact: true });
    const locationSearch = page.getByRole('combobox', { name: 'Abholpunkt suchen', exact: true });
    await locationOptions.getByRole('option').first().hover();
    await page.mouse.wheel(0, 600);
    const lastLocation = locationOptions.getByRole('option', { name: /Wallstraße/ });
    await expect(lastLocation.getByText(/Wallstraße/)).toBeInViewport({ ratio: 1 });
    await expect(locationSearch).toBeInViewport({ ratio: 1 });
    await lastLocation.click();
    await expect(locationTrigger).toContainText('Wallstraße');
    await page.setViewportSize(viewport);
    await locationTrigger.press('Enter');
    await locationSearch.fill('Markt');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(locationTrigger).toBeFocused();
    await expect(locationTrigger).toContainText('Markt');
    await locationTrigger.press('Enter');
    await page.getByRole('combobox', { name: 'Abholpunkt suchen', exact: true }).press('Tab');
    const clearLocation = page.getByRole('button', {
      name: 'Abholpunktauswahl aufheben',
      exact: true,
    });
    await expect(clearLocation).toBeFocused();
    await clearLocation.press('Tab');
    await expect(page.getByRole('textbox', { name: 'Hinweis', exact: true })).toBeFocused();
    await expect(
      page.getByRole('combobox', { name: 'Abholpunkt suchen', exact: true })
    ).toHaveCount(0);
    await locationTrigger.press('Enter');
    await captureStudioDesignState(page, 'waste-location-search', 'main, [role=dialog]');
    await expect(
      page.getByRole('combobox', { name: 'Abholpunkt suchen', exact: true })
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(locationTrigger).toBeFocused();
    await expect(page.locator('#waste-tour-form')).toBeVisible();
    // Discard this temporary custom-date draft before exercising the preset mutation.
    await page
      .locator('#waste-tour-form')
      .getByRole('button', { name: 'Abbrechen', exact: true })
      .click();
    await expect.poll(() => harness.requests.createdTours.length).toBe(0);
    await page.getByRole('button', { name: 'Neue Tour' }).click();
    await page.locator('#waste-tour-name').fill('Ferienroute');
    await page.getByRole('button', { name: 'Abfallfraktionen', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Restmüll', exact: true }).check();
    await page.keyboard.press('Escape');
    await page
      .locator('#waste-tour-recurrence')
      .selectOption({ label: 'Ferien 10 Tage (alle 10 Tage)' });
    await page.locator('#waste-tour-first-date').fill('2026-06-01');
    await page.locator('#waste-tour-end-date').fill('2026-08-31');

    await page.locator('#waste-tour-form').getByRole('button', { name: 'Tour speichern' }).click();

    await expect.poll(() => harness.requests.createdTours.length).toBe(1);
    expect(harness.requests.createdTours[0]).toMatchObject({
      name: 'Ferienroute',
      wasteFractionIds: ['fraction-1'],
      customRecurrenceId: createdPresetIds[0],
      firstDate: '2026-06-01',
      endDate: '2026-08-31',
      status: 'draft',
    });
    expect(harness.requests.createdTours[0]).not.toHaveProperty('recurrence');

    await expect(
      page.getByRole('row', { name: /Ferienroute.*Ferien 10 Tage \(alle 10 Tage\)/ })
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Einstellungen' }).click();
    await page.locator('summary').filter({ hasText: 'Eigene Turnusse' }).click();
    const editedPresetRow = page.getByRole('row', { name: /Ferien 10 Tage.*Alle 10 Tage/ });
    await editedPresetRow.getByRole('button', { name: 'Bearbeiten' }).click();
    await page.locator('#waste-settings-custom-recurrence-name').fill('Ferien 12 Tage');
    await page.locator('#waste-settings-custom-recurrence-interval-days').selectOption('12');
    await page.getByRole('button', { name: 'Abstand übernehmen' }).click();
    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();

    await expect(page.getByRole('button', { name: 'Gespeichert' })).toBeVisible();

    await page.getByRole('tab', { name: 'Touren' }).click();
    await expect(
      page.getByRole('row', { name: /Ferienroute.*Ferien 12 Tage \(alle 12 Tage\)/ })
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Einstellungen' }).click();
    await page.locator('summary').filter({ hasText: 'Eigene Turnusse' }).click();
    const presetRowToDelete = page.getByRole('row', { name: /Ferien 12 Tage.*Alle 12 Tage/ });
    await presetRowToDelete.getByRole('button', { name: 'Löschen' }).click();
    await page.locator('#waste-settings-custom-recurrence-fallback').selectOption({
      label: '14 Tage Fallback (alle 14 Tage)',
    });
    await page.getByRole('button', { name: 'Löschen' }).click();
    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();

    await expect(page.getByRole('button', { name: 'Gespeichert' })).toBeVisible();

    const finalSettingsUpdate = harness.requests.settingsUpdates.at(-1) as
      | {
          deletedPresetFallbacks?: Record<string, { kind: string; value: string }>;
        }
      | undefined;
    expect(finalSettingsUpdate?.deletedPresetFallbacks?.[createdPresetIds[0]]).toEqual({
      kind: 'preset',
      value: createdPresetIds[1],
    });

    await page.getByRole('tab', { name: 'Touren' }).click();
    await expect(
      page.getByRole('row', { name: /Ferienroute.*14 Tage Fallback \(alle 14 Tage\)/ })
    ).toBeVisible();
  });

  test('updates selected tour validity atomically and blocks inapplicable selections', async ({
    page,
  }) => {
    await mockSharedShellRequests(page, {
      instanceId: 'de-tour-validity',
      permissionActions: ['waste-management.read', 'waste-management.tours.manage'],
    });
    const harness = await mockWasteFacade(page, {
      instanceId: 'de-tour-validity',
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_validity',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
      },
      fractions: [],
      tours: [
        {
          id: 'tour-weekly',
          name: 'Restmüll Nord',
          wasteFractionIds: [],
          recurrence: 'weekly',
          firstDate: '2026-01-01',
          endDate: '2026-12-31',
          status: 'published',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'tour-biweekly',
          name: 'Biomüll Süd',
          wasteFractionIds: [],
          recurrence: 'biweekly',
          firstDate: '2026-02-01',
          endDate: '2026-11-30',
          status: 'published',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'tour-on-demand',
          name: 'Schadstoffmobil',
          wasteFractionIds: [],
          recurrence: 'on-demand',
          status: 'published',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    await openWastePlugin(page);
    await page.getByRole('tab', { name: 'Touren' }).click();
    await page.getByRole('checkbox', { name: 'Tour Restmüll Nord auswählen' }).check();
    await page.getByRole('checkbox', { name: 'Tour Biomüll Süd auswählen' }).check();
    await captureStudioDesignState(page, 'waste-tours-selected');
    await page.getByRole('button', { name: 'Gültigkeitszeitraum ändern' }).click();
    await page.getByLabel('Gültig ab').selectOption('set');
    await page
      .getByRole('textbox', { name: 'Neuer Gültigkeitsbeginn', exact: true })
      .fill('01.03.2026');
    await page.getByLabel('Gültig bis').selectOption('clear');
    await page.getByRole('button', { name: 'Zeitraum ändern' }).click();

    await expect(
      page.getByText('Der Gültigkeitszeitraum von 2 Touren wurde aktualisiert.')
    ).toBeVisible();
    expect(harness.requests.tourValidityUpdates).toEqual([
      {
        tourIds: ['tour-weekly', 'tour-biweekly'],
        firstDate: { mode: 'set', value: '2026-03-01' },
        endDate: { mode: 'clear' },
      },
    ]);

    await page.getByRole('checkbox', { name: 'Tour Restmüll Nord auswählen' }).check();
    await page.getByRole('checkbox', { name: 'Tour Schadstoffmobil auswählen' }).check();
    await page.getByRole('button', { name: 'Gültigkeitszeitraum ändern' }).click();
    await expect(page.getByRole('alert')).toContainText('Schadstoffmobil');
    await expect(page.getByRole('button', { name: 'Zeitraum ändern' })).toBeDisabled();
    expect(harness.requests.tourValidityUpdates).toHaveLength(1);
  });

  test('changes the status of every explicitly selected filtered tour across pages', async ({
    page,
  }) => {
    await mockSharedShellRequests(page, {
      instanceId: 'de-bulk-tour-status',
      permissionActions: ['waste-management.read', 'waste-management.tours.manage'],
    });
    const draftTours: WasteTourState[] = Array.from({ length: 11 }, (_, index) => ({
      id: `tour-draft-${index + 1}`,
      name: `Tourentwurf ${String(index + 1).padStart(2, '0')}`,
      wasteFractionIds: [],
      recurrence: 'weekly',
      firstDate: '2026-01-01',
      status: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    const harness = await mockWasteFacade(page, {
      instanceId: 'de-bulk-tour-status',
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_bulk_status',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
      },
      fractions: [],
      tours: [
        ...draftTours,
        {
          id: 'tour-published',
          name: 'Bereits veröffentlichte Tour',
          wasteFractionIds: [],
          recurrence: 'weekly',
          firstDate: '2026-01-01',
          status: 'published',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    await openWastePlugin(page);
    await page.getByRole('tab', { name: 'Touren' }).click();
    await page.getByRole('combobox', { name: 'Zeige', exact: true }).selectOption('10');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    const filterDialog = page.getByRole('dialog');
    await filterDialog.getByLabel('Status', { exact: true }).selectOption('draft');
    await filterDialog.getByRole('button', { name: 'Filter anwenden' }).click();
    await page.getByRole('button', { name: 'Alle 11 gefilterten Touren auswählen' }).click();
    await expect(page.getByText('11 Touren ausgewählt')).toBeVisible();

    await page.getByRole('button', { name: 'Status ändern' }).click();
    const statusDialog = page.getByRole('dialog');
    await statusDialog.getByLabel('Zielstatus').selectOption('archived');
    await statusDialog.getByRole('button', { name: 'Status ändern' }).click();

    await expect(page.getByText('Der Status von 11 Touren wurde aktualisiert.')).toBeVisible();
    expect(harness.requests.tourStatusUpdates).toEqual([
      { tourIds: draftTours.map((tour) => tour.id), status: 'archived' },
    ]);
  });

  test('previews and confirms the fixed following-year tour set as drafts', async ({ page }) => {
    await mockSharedShellRequests(page, {
      instanceId: 'de-annual-transfer',
      permissionActions: [
        'waste-management.read',
        'waste-management.tours.manage',
        'waste-management.scheduling.manage',
      ],
    });
    const harness = await mockWasteFacade(page, {
      instanceId: 'de-annual-transfer',
      settings: {
        provider: 'postgresql',
        schemaName: 'waste_annual_transfer',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'ok',
      },
      fractions: [],
      tours: [
        {
          id: 'tour-weekly',
          name: 'Restmüll Nord',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          firstDate: '2026-01-05',
          endDate: '2026-12-31',
          status: 'published',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    await openWastePlugin(page);
    await page.getByRole('tab', { name: 'Touren' }).click();
    await page.getByRole('button', { name: 'Tourensatz ins Folgejahr übernehmen' }).click();
    await expect(page.getByText('Unveränderliches Folgejahr: 2027')).toBeVisible();
    await page.getByRole('button', { name: 'Vorschau erstellen' }).click();
    await expect(page.getByText('05.01.2026 (Montag) → 04.01.2027 (Montag)')).toBeVisible();
    await page.getByRole('button', { name: 'Auswahl prüfen' }).click();
    await page.getByRole('button', { name: 'Als Entwurf übernehmen' }).click();

    await expect(page.getByRole('status')).toContainText(
      '1 Touren wurden als Entwurf für 2027 angelegt; 0 bereits identische Touren wurden wiederverwendet.'
    );
    expect(harness.requests.annualTourTransfers).toEqual([
      expect.objectContaining({
        sourceYear: 2026,
        selectedTourIds: ['tour-weekly'],
        previewFingerprint: `sha256:${'a'.repeat(64)}`,
      }),
    ]);
  });
});
