import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { mockWasteFacade, type WasteTourState } from './waste-management-plugin.helpers';

import {
  establishServerReadableAuthSession,
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
  test('opens contextual tour-shift creation in a new tab without losing the tour workflow', async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);
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

    await openWastePlugin(page);
    await page.getByRole('tab', { name: 'Touren' }).click();
    await page.getByRole('button', { name: 'Jahreskalender anzeigen' }).click();

    const createShiftLink = page
      .getByRole('link', {
        name: /Termin .* der Tour Restmüll Nord verschieben Öffnet in neuem Tab/u,
      })
      .first();
    await expect(createShiftLink).toHaveAttribute('target', '_blank');
    await expect(createShiftLink).toHaveAttribute('rel', 'noopener noreferrer');

    const sourceUrl = page.url();
    await establishServerReadableAuthSession(context, page);
    const popupPromise = page.waitForEvent('popup');
    await createShiftLink.click();
    const popup = await popupPromise;

    await expect(popup.getByRole('heading', { name: 'Abfallkalender' })).toBeVisible();
    await expect(popup.locator('#waste-tour-shift-tour')).toHaveValue('tour-1', {
      timeout: 30_000,
    });
    const originalDate = await popup.locator('#waste-tour-shift-original-date').inputValue();
    expect(originalDate).toMatch(/^2026-\d{2}-\d{2}$/u);
    await expect(popup).toHaveURL(/schedulingTourId=tour-1/u);
    await expect(popup).toHaveURL(new RegExp(`schedulingOriginalDate=${originalDate}`, 'u'));
    await expect(page).toHaveURL(sourceUrl);
    await expect(page.getByRole('heading', { name: 'Jahreskalender' })).toBeVisible();
  });

  test('supports settings, fraction creation and technical job starters through the host facade', async ({
    page,
  }) => {
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
    await page.getByRole('tab', { name: 'Einstellungen' }).click();
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
    await page.getByRole('checkbox', { name: 'Touren' }).click();
    await page.getByRole('button', { name: 'Export starten' }).click();
    expect(harness.requests.exportInputs).toEqual([
      {
        profileIds: ['waste-management.fraktionen', 'waste-management.touren'],
        targetFormat: 'application/zip',
      },
    ]);
    await page.getByRole('button', { name: /Tourzuordnungen nach Fraktionen/ }).click();
    const toolsPanel = page
      .getByText('Datei hochladen')
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")]')
      .first();
    await toolsPanel.locator('input[type="file"]').setInputFiles({
      name: 'tenant-a.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'Ort;Straße;Hausmüll;Papier;Gelbe Säcke\nPerleberg;Ackerstr.;HM.3.3;PPK.7.2;LVP.9.4\n'
      ),
    });
    await page.getByRole('button', { name: 'Vorschau prüfen' }).click();
    await expect(page.getByRole('button', { name: 'Import starten' })).toBeVisible();
    await page.getByRole('button', { name: 'Import starten' }).click();
    await page.getByRole('button', { name: 'Erweiterte Systemfunktionen' }).click();
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
    await outputPanel.getByLabel('Branding-Grafik').fill('https://cdn.example/logo.svg');
    await outputPanel.getByLabel('Kontakt- und Freitextblock').fill('Service-Telefon 03395 123456');
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
    await mockSharedShellRequests(page, {
      instanceId: 'de-recurring',
      permissionActions: [
        'waste-management.read',
        'waste-management.settings.manage',
        'waste-management.tours.manage',
      ],
    });

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
      tours: [],
    });

    await openWastePlugin(page);
    await page.getByRole('tab', { name: 'Einstellungen' }).click();

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
    await page.getByLabel('Restmüll').click();
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
    await page.getByRole('button', { name: 'Gültigkeitszeitraum ändern' }).click();
    await page.getByLabel('Gültig ab').selectOption('set');
    await page.getByLabel('Neuer Gültigkeitsbeginn').fill('2026-03-01');
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
    await page.getByRole('button', { name: 'Filtern' }).click();
    const filterDialog = page.getByRole('dialog');
    await filterDialog.getByLabel('Status', { exact: true }).selectOption('draft');
    await filterDialog.getByRole('button', { name: 'Anwenden' }).click();
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
    await expect(page.getByText('2026-01-05 (Montag) → 2027-01-04 (Montag)')).toBeVisible();
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
