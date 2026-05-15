import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

type WasteSettingsState = {
  provider: 'supabase';
  projectUrl: string;
  schemaName: string;
  enabled: boolean;
  databaseUrlConfigured: boolean;
  serviceRoleKeyConfigured: boolean;
  visibleStatus: 'ok' | 'error' | 'unknown' | 'not_configured';
  lastCheckedAt?: string;
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
  recurrence?: 'weekly' | 'biweekly' | 'custom';
  firstDate?: string;
  endDate?: string;
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
      body: JSON.stringify({ data: [], pagination: { page: 1, pageSize: 0, total: 0 } }),
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
  readonly allowFractionCreate?: boolean;
}) : Promise<WasteHarness> => {
  const settingsState: WasteSettingsState = { ...input.settings };
  const fractionsState = [...input.fractions];
  const toursState = [...input.tours];
  const requests = {
    settingsUpdates: [] as Array<Record<string, unknown>>,
    createdFractions: [] as Array<Record<string, unknown>>,
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
          regions: [],
          cities: [],
          streets: [],
          houseNumbers: [],
          collectionLocations: [],
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
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem(settingsState),
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
    await page.locator('#waste-fraction-color').fill('#00aaee');
    await page.locator('#waste-fraction-container-size').fill('240l');
    await page.locator('#waste-fraction-description').fill('Papierfraktion für den E2E-Pfad.');
    await page.getByRole('button', { name: 'Fraktion speichern' }).click();

    await expect(page.getByText('Die Waste-Fraktion wurde angelegt.')).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Tabelle der Waste-Abfallfraktionen' }).getByText('Papier (240l)')
    ).toBeVisible();
    expect(harness.requests.createdFractions).toHaveLength(1);
    expect(harness.requests.createdFractions[0]).toMatchObject({
      name: 'Papier',
      color: '#00aaee',
      containerSize: '240l',
    });

    await page.getByRole('tab', { name: 'Datentools' }).click();
    const toolsPanel = page.getByRole('tabpanel', { name: 'Datentools' });
    await toolsPanel.locator('input[type="file"]').setInputFiles({
      name: 'tenant-a.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('street,date\nMusterweg,2026-05-10\n'),
    });
    await page.getByRole('button', { name: 'Import starten' }).click();
    await toolsPanel.getByRole('textbox').nth(0).fill('waste_ops_v2');
    await toolsPanel.getByRole('textbox').nth(1).fill('2026.05.10');
    await page.getByRole('button', { name: 'Migrationen starten' }).click();
    await page.getByRole('button', { name: 'Seed starten' }).click();
    await page.getByRole('button', { name: 'Reset starten' }).click();
    await page.locator('input[placeholder="RESET"]').fill('RESET');
    await page.getByRole('button', { name: 'Reset bestätigen' }).click();

    await expect(page.getByText('Job job-reset-1 wurde gestartet.')).toBeVisible();
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
    await page.locator('#waste-fraction-color').fill('#123456');
    await page.getByRole('button', { name: 'Fraktion speichern' }).click();
    await expect(page.getByText('Für das Speichern von Waste-Fraktionen fehlt die Berechtigung.').first()).toBeVisible();
  });
});
