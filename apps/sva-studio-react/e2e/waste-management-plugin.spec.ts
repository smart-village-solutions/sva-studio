import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

import { createEmptyPaginatedDataResponse } from './studio-shell.helpers';

type WasteSettingsState = {
  provider: 'supabase';
  projectUrl: string;
  schemaName: string;
  enabled: boolean;
  databaseUrlConfigured: boolean;
  serviceRoleKeyConfigured: boolean;
  visibleStatus: 'ok' | 'error' | 'unknown' | 'not_configured';
  lastCheckedAt?: string;
  customRecurrencePresets?: WasteCustomRecurrencePresetState[];
};

type WasteCustomRecurrencePresetState = {
  id: string;
  name: string;
  description?: string;
  intervalDays: number;
  createdAt: string;
  updatedAt: string;
};

type WasteFractionState = {
  id: string;
  name: string;
  color: string;
  containerSize?: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type WasteTourState = {
  id: string;
  name: string;
  wasteFractionIds: readonly string[];
  recurrence?: 'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom';
  customRecurrenceId?: string;
  customRecurrenceName?: string;
  customRecurrenceIntervalDays?: number;
  firstDate?: string;
  endDate?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type WasteRegionState = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type WasteCityState = {
  id: string;
  regionId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type WasteStreetState = {
  id: string;
  cityId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type WasteHouseNumberState = {
  id: string;
  streetId: string;
  number: string;
  createdAt: string;
  updatedAt: string;
};

type WasteCollectionLocationState = {
  id: string;
  regionId?: string;
  cityId: string;
  streetId?: string;
  houseNumberId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type WasteJobState = {
  id: string;
  jobTypeId: string;
  status: 'pending';
};

type WasteHarness = {
  readonly requests: {
    settingsUpdates: Array<Record<string, unknown>>;
    createdFractions: Array<Record<string, unknown>>;
    createdTours: Array<Record<string, unknown>>;
    startedJobTypes: string[];
  };
};

const createApiItem = <T>(data: T) => JSON.stringify({ data });

const mockSharedShellRequests = async (page: Page, input: {
  readonly instanceId: string;
  readonly permissionActions: readonly string[];
}) => {
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

  await page.route('**/iam/authorize', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ allowed: true, reason: 'mocked_authorize' }),
    });
  });

  await page.route('**/iam/me/legal-texts/pending', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: createEmptyPaginatedDataResponse(),
    });
  });

  await page.route('**/api/v1/iam/me/context', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { activeOrganizationId: null, organizations: [] } }),
    });
  });
};

const mockWasteFacade = async (page: Page, input: {
  readonly instanceId: string;
  readonly settings: WasteSettingsState;
  readonly fractions: WasteFractionState[];
  readonly tours: WasteTourState[];
  readonly regions?: WasteRegionState[];
  readonly cities?: WasteCityState[];
  readonly streets?: WasteStreetState[];
  readonly houseNumbers?: WasteHouseNumberState[];
  readonly collectionLocations?: WasteCollectionLocationState[];
  readonly allowFractionCreate?: boolean;
}) : Promise<WasteHarness> => {
  const settingsState: WasteSettingsState = { ...input.settings };
  settingsState.customRecurrencePresets = [...(input.settings.customRecurrencePresets ?? [])];
  const fractionsState = [...input.fractions];
  const toursState = [...input.tours];
  const regionsState = [...(input.regions ?? [])];
  const citiesState = [...(input.cities ?? [])];
  const streetsState = [...(input.streets ?? [])];
  const houseNumbersState = [...(input.houseNumbers ?? [])];
  const collectionLocationsState = [...(input.collectionLocations ?? [])];
  const requests = {
    settingsUpdates: [] as Array<Record<string, unknown>>,
    createdFractions: [] as Array<Record<string, unknown>>,
    createdTours: [] as Array<Record<string, unknown>>,
    startedJobTypes: [] as string[],
  };

  await page.route('**/api/v1/waste-management/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === 'GET' && path === '/api/v1/waste-management/history') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({
          audit: {
            items: [],
            total: 0,
          },
          technical: {
            items: [],
            total: 0,
          },
        }),
      });
      return;
    }

    if (method === 'GET' && path === '/api/v1/waste-management/master-data') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({
          fractions: fractionsState,
          regions: regionsState,
          cities: citiesState,
          streets: streetsState,
          houseNumbers: houseNumbersState,
          collectionLocations: collectionLocationsState,
          locationTourLinks: [],
        }),
      });
      return;
    }

    if (method === 'POST' && path === '/api/v1/waste-management/fractions') {
      if (input.allowFractionCreate === false) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'forbidden', message: 'Keine Berechtigung.' }),
        });
        return;
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.createdFractions.push(body);
      const created: WasteFractionState = {
        id: String(body.id),
        name: String(body.name),
        color: String(body.color),
        containerSize: typeof body.containerSize === 'string' ? body.containerSize : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        active: body.active !== false,
        createdAt: '2026-05-10T12:15:00.000Z',
        updatedAt: '2026-05-10T12:15:00.000Z',
      };
      fractionsState.unshift(created);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: createApiItem(created),
      });
      return;
    }

    if (method === 'GET' && path === '/api/v1/waste-management/tours') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({
          tours: toursState,
          customRecurrencePresets: settingsState.customRecurrencePresets ?? [],
        }),
      });
      return;
    }

    if (method === 'GET' && path === '/api/v1/waste-management/scheduling') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({
          globalDateShifts: [],
          tourDateShifts: [],
        }),
      });
      return;
    }

    if (method === 'GET' && path === '/api/v1/waste-management/settings') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem(settingsState),
      });
      return;
    }

    if (method === 'PUT' && path === '/api/v1/waste-management/settings') {
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.settingsUpdates.push(body);
      settingsState.projectUrl = String(body.projectUrl ?? settingsState.projectUrl);
      settingsState.schemaName = String(body.schemaName ?? settingsState.schemaName);
      settingsState.enabled = body.enabled !== false;
      settingsState.databaseUrlConfigured = true;
      settingsState.serviceRoleKeyConfigured = true;
      settingsState.visibleStatus = 'ok';
      settingsState.lastCheckedAt = '2026-05-10T12:20:00.000Z';
      const nextPresets = Array.isArray(body.customRecurrencePresets)
        ? body.customRecurrencePresets.map((preset) => {
            const currentPreset = (settingsState.customRecurrencePresets ?? []).find(
              (candidate) => candidate.id === String((preset as Record<string, unknown>).id)
            );
            return {
              id: String((preset as Record<string, unknown>).id),
              name: String((preset as Record<string, unknown>).name),
              description:
                typeof (preset as Record<string, unknown>).description === 'string'
                  ? String((preset as Record<string, unknown>).description)
                  : undefined,
              intervalDays: Number((preset as Record<string, unknown>).intervalDays),
              createdAt: currentPreset?.createdAt ?? '2026-05-10T12:20:00.000Z',
              updatedAt: '2026-05-10T12:20:00.000Z',
            } satisfies WasteCustomRecurrencePresetState;
          })
        : (settingsState.customRecurrencePresets ?? []);
      const nextPresetMap = new Map(nextPresets.map((preset) => [preset.id, preset] as const));
      const deletedPresetFallbacks =
        typeof body.deletedPresetFallbacks === 'object' && body.deletedPresetFallbacks
          ? (body.deletedPresetFallbacks as Record<string, { kind?: string; value?: string }>)
          : {};

      for (const tour of toursState) {
        if (!tour.customRecurrenceId) {
          continue;
        }
        const resolvedPreset = nextPresetMap.get(tour.customRecurrenceId);
        if (resolvedPreset) {
          tour.customRecurrenceName = resolvedPreset.name;
          tour.customRecurrenceIntervalDays = resolvedPreset.intervalDays;
          continue;
        }

        const fallback = deletedPresetFallbacks[tour.customRecurrenceId];
        if (!fallback) {
          tour.customRecurrenceId = undefined;
          tour.customRecurrenceName = undefined;
          tour.customRecurrenceIntervalDays = undefined;
          continue;
        }

        if (fallback.kind === 'preset') {
          const fallbackPreset = nextPresetMap.get(String(fallback.value));
          tour.customRecurrenceId = fallbackPreset?.id;
          tour.customRecurrenceName = fallbackPreset?.name;
          tour.customRecurrenceIntervalDays = fallbackPreset?.intervalDays;
          tour.recurrence = undefined;
          continue;
        }

        tour.customRecurrenceId = undefined;
        tour.customRecurrenceName = undefined;
        tour.customRecurrenceIntervalDays = undefined;
        tour.recurrence = String(fallback.value) as WasteTourState['recurrence'];
      }

      settingsState.customRecurrencePresets = nextPresets;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem(settingsState),
      });
      return;
    }

    if (method === 'POST' && path === '/api/v1/waste-management/tours') {
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.createdTours.push(body);
      const preset =
        typeof body.customRecurrenceId === 'string'
          ? (settingsState.customRecurrencePresets ?? []).find((candidate) => candidate.id === body.customRecurrenceId)
          : undefined;
      const created: WasteTourState = {
        id: String(body.id),
        name: String(body.name),
        wasteFractionIds: Array.isArray(body.wasteFractionIds) ? body.wasteFractionIds.map(String) : [],
        recurrence: typeof body.recurrence === 'string' ? (body.recurrence as WasteTourState['recurrence']) : undefined,
        customRecurrenceId: typeof body.customRecurrenceId === 'string' ? body.customRecurrenceId : undefined,
        customRecurrenceName: preset?.name,
        customRecurrenceIntervalDays: preset?.intervalDays,
        firstDate: typeof body.firstDate === 'string' ? body.firstDate : undefined,
        endDate: typeof body.endDate === 'string' ? body.endDate : undefined,
        active: body.active !== false,
        createdAt: '2026-05-10T12:30:00.000Z',
        updatedAt: '2026-05-10T12:30:00.000Z',
      };
      toursState.unshift(created);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: createApiItem(created),
      });
      return;
    }

    if (method === 'POST' && path === '/api/v1/waste-management/tools/imports/preview') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({
          profileId: 'waste-management.ortsbezogene-tourtermine',
          delimiter: ';',
          detectedDelimiter: ';',
          fractionNames: ['Hausmüll', 'Papier', 'Gelbe Säcke'],
          existingFractions: ['Restmüll'],
          newFractions: ['Hausmüll', 'Papier', 'Gelbe Säcke'],
          existingTours: [],
          newTours: ['HM.3.3', 'PPK.7.2', 'LVP.9.4'],
          validRowCount: 1,
          invalidRowCount: 0,
          errors: [],
          summary: {
            fractions: { existing: 0, created: 3 },
            regions: { existing: 0, created: 0 },
            cities: { existing: 0, created: 1 },
            streets: { existing: 0, created: 1 },
            houseNumbers: { existing: 0, created: 1 },
            locations: { existing: 0, created: 1 },
            assignments: { existing: 0, created: 3 },
          },
        }),
      });
      return;
    }

    if (method === 'POST' && path === '/api/v1/waste-management/tools/imports') {
      requests.startedJobTypes.push('waste-management.import-data');
      const job: WasteJobState = {
        id: 'job-import-1',
        jobTypeId: 'waste-management.import-data',
        status: 'pending',
      };
      await route.fulfill({ status: 201, contentType: 'application/json', body: createApiItem(job) });
      return;
    }

    if (method === 'POST' && path === '/api/v1/waste-management/tools/migrations') {
      requests.startedJobTypes.push('waste-management.apply-migrations');
      const job: WasteJobState = {
        id: 'job-migrate-1',
        jobTypeId: 'waste-management.apply-migrations',
        status: 'pending',
      };
      await route.fulfill({ status: 201, contentType: 'application/json', body: createApiItem(job) });
      return;
    }

    if (method === 'POST' && path === '/api/v1/waste-management/tools/seed') {
      requests.startedJobTypes.push('waste-management.seed-data');
      const job: WasteJobState = {
        id: 'job-seed-1',
        jobTypeId: 'waste-management.seed-data',
        status: 'pending',
      };
      await route.fulfill({ status: 201, contentType: 'application/json', body: createApiItem(job) });
      return;
    }

    if (method === 'POST' && path === '/api/v1/waste-management/tools/reset') {
      requests.startedJobTypes.push('waste-management.reset-data');
      const job: WasteJobState = {
        id: 'job-reset-1',
        jobTypeId: 'waste-management.reset-data',
        status: 'pending',
      };
      await route.fulfill({ status: 201, contentType: 'application/json', body: createApiItem(job) });
      return;
    }

    await route.fallback();
  });

  return { requests };
};

const openWastePlugin = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SVA Studio' })).toBeVisible();
  await page.getByRole('link', { name: 'Abfallkalender' }).click();
  await expect(page.getByRole('heading', { name: 'Abfallkalender' })).toBeVisible();
};

test.describe('waste management plugin', () => {
  test('supports settings, fraction creation and technical job starters through the host facade', async ({ page }) => {
    await mockSharedShellRequests(page, {
      instanceId: 'de-musterhausen',
      permissionActions: [
        'waste-management.read',
        'waste-management.master-data.manage',
        'waste-management.tours.manage',
        'waste-management.scheduling.manage',
        'waste-management.import.execute',
        'waste-management.seed.execute',
        'waste-management.reset.execute',
        'waste-management.settings.manage',
      ],
    });

    const harness = await mockWasteFacade(page, {
      instanceId: 'de-musterhausen',
      settings: {
        provider: 'supabase',
        projectUrl: 'https://tenant-a.supabase.co',
        schemaName: 'waste_ops',
        enabled: true,
        databaseUrlConfigured: true,
        serviceRoleKeyConfigured: true,
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
          active: true,
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
    await expect(page.locator('input[placeholder="https://example.supabase.co"]')).toHaveValue('https://tenant-a.supabase.co');

    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();

    await expect(page.getByText('Die Waste-Einstellungen wurden gespeichert und serverseitig geprüft.')).toBeVisible();
    expect(harness.requests.settingsUpdates).toHaveLength(1);
    expect(harness.requests.settingsUpdates[0]).toMatchObject({
      projectUrl: 'https://tenant-a.supabase.co',
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
    await page.locator('#waste-fraction-create-form').getByRole('button', { name: 'Abfallart speichern' }).click();

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
    await page.getByRole('button', { name: /Tourzuordnungen nach Fraktionen/ }).click();
    const toolsPanel = page.getByText('Datei hochladen').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")]').first();
    await toolsPanel.locator('input[type="file"]').setInputFiles({
      name: 'tenant-a.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Ort;Straße;Hausmüll;Papier;Gelbe Säcke\nPerleberg;Ackerstr.;HM.3.3;PPK.7.2;LVP.9.4\n'),
    });
    await page.getByRole('button', { name: 'Vorschau prüfen' }).click();
    await expect(page.getByRole('button', { name: 'Import starten' })).toBeVisible();
    await page.getByRole('button', { name: 'Import starten' }).click();
    await page.getByRole('button', { name: 'Erweiterte Systemfunktionen' }).click();
    await page.getByLabel('Zielschema').fill('waste_ops_v2');
    await page.getByLabel('Anfordernde Version').fill('2026.05.10');
    await page.getByRole('button', { name: 'Migrationen starten' }).click();
    await page.getByRole('button', { name: 'Seed starten' }).click();
    await page.getByRole('button', { name: 'Reset starten' }).click();
    await page.getByLabel('Bestätigungstoken').fill('RESET');
    await page.getByRole('button', { name: 'Reset bestätigen' }).click();

    await expect(page.getByText('Job job-reset-1 wurde gestartet.')).toBeVisible();

    await page.getByRole('tab', { name: 'Ausgabe' }).click();
    const outputPanel = page.getByRole('tabpanel', { name: 'Ausgabe' });
    await expect(outputPanel).toBeVisible();
    await outputPanel.getByLabel('Branding-Grafik').fill('https://cdn.example/logo.svg');
    await outputPanel.getByLabel('Kontakt- und Freitextblock').fill('Service-Telefon 03395 123456');
    await outputPanel.getByRole('button', { name: 'PDF-Inhalte speichern' }).click();
    await expect(page.getByText('Die PDF-Inhalte wurden gespeichert.')).toBeVisible();
    expect(harness.requests.settingsUpdates.at(-1)).toMatchObject({
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Service-Telefon 03395 123456',
    });

    expect(harness.requests.startedJobTypes).toEqual([
      'waste-management.import-data',
      'waste-management.apply-migrations',
      'waste-management.seed-data',
      'waste-management.reset-data',
    ]);
  });

  test('keeps settings instance-scoped and hides master-data mutations without the dedicated permission', async ({ page }) => {
    await mockSharedShellRequests(page, {
      instanceId: 'de-zweitstadt',
      permissionActions: [
        'waste-management.read',
        'waste-management.settings.manage',
      ],
    });

    await mockWasteFacade(page, {
      instanceId: 'de-zweitstadt',
      settings: {
        provider: 'supabase',
        projectUrl: 'https://tenant-b.supabase.co',
        schemaName: 'waste_b',
        enabled: true,
        databaseUrlConfigured: true,
        serviceRoleKeyConfigured: true,
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
    await expect(page.locator('input[placeholder="https://example.supabase.co"]')).toHaveValue('https://tenant-b.supabase.co');
    await expect(page.locator('input[placeholder="https://example.supabase.co"]')).not.toHaveValue('https://tenant-a.supabase.co');

    await page.getByRole('tab', { name: 'Abfallarten' }).click();
    await expect(
      page.getByRole('table', { name: 'Tabelle der Waste-Abfallfraktionen' }).getByText('Bioabfall')
    ).toBeVisible();
    await page.getByRole('button', { name: 'Fraktion anlegen' }).click();
    await page.locator('#waste-fraction-name').fill('Papier Plus');
    await page.locator('#waste-fraction-pdf-short-label').fill('PP');
    await page.locator('#waste-fraction-color-text').fill('#123456');
    await page.locator('#waste-fraction-create-form').getByRole('button', { name: 'Abfallart speichern' }).click();
    await expect(page.getByText('Für das Speichern von Waste-Fraktionen fehlt die Berechtigung.').first()).toBeVisible();
  });

  test('supports custom recurrence preset creation, tour selection, editing and fallback deletion', async ({ page }) => {
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
    await page.locator('#waste-settings-custom-recurrence-description').fill('Saisonaler Sommerturnus');
    await page.getByRole('button', { name: 'Abstand übernehmen' }).click();

    await page.getByRole('button', { name: 'Abstand hinzufügen' }).click();
    await page.locator('#waste-settings-custom-recurrence-name').fill('14 Tage Fallback');
    await page.locator('#waste-settings-custom-recurrence-interval-days').selectOption('14');
    await page.locator('#waste-settings-custom-recurrence-description').fill('Fallback für entfernte Sommerturnusse');
    await page.getByRole('button', { name: 'Abstand übernehmen' }).click();

    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
    await expect(page.getByText('Die Waste-Einstellungen wurden gespeichert und serverseitig geprüft.')).toBeVisible();

    const createdPresetIds = (
      (harness.requests.settingsUpdates[0]?.customRecurrencePresets as Array<Record<string, unknown>> | undefined) ?? []
    ).map((preset) => String(preset.id));
    expect(createdPresetIds).toHaveLength(2);

    await page.getByRole('tab', { name: 'Touren' }).click();
    await page.getByRole('button', { name: 'Neue Tour' }).click();
    await page.locator('#waste-tour-name').fill('Ferienroute');
    await page.getByLabel('Restmüll').click();
    await page.locator('#waste-tour-recurrence').selectOption({ label: 'Ferien 10 Tage (alle 10 Tage)' });
    await page.locator('#waste-tour-first-date').fill('2026-06-01');
    await page.locator('#waste-tour-end-date').fill('2026-08-31');
    await page
      .locator('#waste-tour-form')
      .getByRole('button', { name: 'Tour speichern' })
      .click();

    await expect.poll(() => harness.requests.createdTours.length).toBe(1);
    expect(harness.requests.createdTours[0]).toMatchObject({
      name: 'Ferienroute',
      wasteFractionIds: ['fraction-1'],
      customRecurrenceId: createdPresetIds[0],
      firstDate: '2026-06-01',
      endDate: '2026-08-31',
      active: true,
    });
    expect(harness.requests.createdTours[0]).not.toHaveProperty('recurrence');

    await expect(page.getByRole('row', { name: /Ferienroute.*Ferien 10 Tage \(alle 10 Tage\)/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Einstellungen' }).click();
    const editedPresetRow = page.getByRole('row', { name: /Ferien 10 Tage.*Alle 10 Tage/ });
    await editedPresetRow.getByRole('button', { name: 'Bearbeiten' }).click();
    await page.locator('#waste-settings-custom-recurrence-name').fill('Ferien 12 Tage');
    await page.locator('#waste-settings-custom-recurrence-interval-days').selectOption('12');
    await page.getByRole('button', { name: 'Abstand übernehmen' }).click();
    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();

    await expect(page.getByText('Die Waste-Einstellungen wurden gespeichert und serverseitig geprüft.')).toBeVisible();

    await page.getByRole('tab', { name: 'Touren' }).click();
    await expect(page.getByRole('row', { name: /Ferienroute.*Ferien 12 Tage \(alle 12 Tage\)/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Einstellungen' }).click();
    const presetRowToDelete = page.getByRole('row', { name: /Ferien 12 Tage.*Alle 12 Tage/ });
    await presetRowToDelete.getByRole('button', { name: 'Löschen' }).click();
    await page.locator('#waste-settings-custom-recurrence-fallback').selectOption({
      label: '14 Tage Fallback (alle 14 Tage)',
    });
    await page.getByRole('button', { name: 'Löschen' }).click();
    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();

    await expect(page.getByText('Die Waste-Einstellungen wurden gespeichert und serverseitig geprüft.')).toBeVisible();

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
    await expect(page.getByRole('row', { name: /Ferienroute.*14 Tage Fallback \(alle 14 Tage\)/ })).toBeVisible();
  });
});
