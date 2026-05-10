import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';

const updateWasteVisibleStatusMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('./settings-shared.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./settings-shared.js')>();
  return {
    ...actual,
    updateWasteVisibleStatus: updateWasteVisibleStatusMock,
  };
});

import { wasteManagementReadHandlers } from './read-handlers.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const createDeps = (action = 'waste-management.read') => ({
  getRequestId: () => 'req-test',
  resolvePermissions: vi.fn(async () => ({
    ok: true as const,
    permissions: [
      {
        action,
        resourceType: 'waste-management',
        effect: 'allow' as const,
      },
    ],
  })),
});

describe('waste-management read handlers', () => {
  it('loads settings and history with sanitized payloads and paging params', async () => {
    const settingsResponse = await wasteManagementReadHandlers.getWasteManagementSettingsInternal(
      new Request('https://studio.test/api/v1/waste-management/settings'),
      actor,
      {
        ...createDeps('waste-management.settings.manage'),
        loadWasteDataSourceRecord: vi.fn(async () => ({
          instanceId: 'tenant-a',
          provider: 'supabase',
          projectUrl: 'https://tenant.example',
          schemaName: 'wm',
          enabled: true,
          databaseUrlConfigured: true,
          serviceRoleKeyConfigured: true,
          databaseUrlCiphertext: 'cipher-db',
          serviceRoleKeyCiphertext: 'cipher-key',
          visibleStatus: 'ok',
        })),
      }
    );

    expect(settingsResponse.status).toBe(200);
    await expect(settingsResponse.json()).resolves.toMatchObject({
      data: {
        instanceId: 'tenant-a',
        provider: 'supabase',
        visibleStatus: 'ok',
      },
      requestId: 'req-test',
    });

    const loadWasteHistoryOverview = vi.fn(async () => ({ audit: { items: [], total: 0 }, technical: { items: [], total: 0 } }));
    const historyResponse = await wasteManagementReadHandlers.getWasteManagementHistoryInternal(
      new Request('https://studio.test/api/v1/waste-management/history?page=2&pageSize=10&q=fraction'),
      actor,
      {
        ...createDeps(),
        loadWasteHistoryOverview,
      }
    );

    expect(historyResponse.status).toBe(200);
    expect(loadWasteHistoryOverview).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      search: 'fraction',
      page: 2,
      pageSize: 10,
    });
  });

  it('returns dependency errors for failing settings and history reads', async () => {
    const settingsResponse = await wasteManagementReadHandlers.getWasteManagementSettingsInternal(
      new Request('https://studio.test/api/v1/waste-management/settings'),
      actor,
      {
        ...createDeps('waste-management.settings.manage'),
        loadWasteDataSourceRecord: vi.fn(async () => {
          throw new Error('db down');
        }),
      }
    );
    expect(settingsResponse.status).toBe(503);

    const historyResponse = await wasteManagementReadHandlers.getWasteManagementHistoryInternal(
      new Request('https://studio.test/api/v1/waste-management/history'),
      actor,
      {
        ...createDeps(),
        loadWasteHistoryOverview: vi.fn(async () => {
          throw new Error('db down');
        }),
      }
    );
    expect(historyResponse.status).toBe(503);
  });

  it('returns guard errors before overview loaders run', async () => {
    const forbiddenResponse = await wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data'),
      actor,
      {
        getRequestId: () => 'req-test',
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [],
        })),
        loadMasterDataOverview: vi.fn(async () => ({ fractions: [] })),
      }
    );

    expect(forbiddenResponse.status).toBe(403);

    const invalidInstanceResponse = await wasteManagementReadHandlers.getWasteManagementSchedulingOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/scheduling'),
      {
        ...actor,
        user: {
          ...actor.user,
          instanceId: '',
        },
      },
      {
        ...createDeps(),
        loadSchedulingOverview: vi.fn(async () => ({ tourDateShifts: [], globalDateShifts: [] })),
      }
    );

    expect(invalidInstanceResponse.status).toBe(400);
  });

  it('updates visible status for overview reads on success and revalidation failures', async () => {
    const successCases = [
      {
        run: () =>
          wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal(
            new Request('https://studio.test/api/v1/waste-management/master-data'),
            actor,
            { ...createDeps(), loadMasterDataOverview: vi.fn(async () => ({ fractions: [], regions: [], cities: [], streets: [], houseNumbers: [], collectionLocations: [], locationTourLinks: [] })) }
          ),
      },
      {
        run: () =>
          wasteManagementReadHandlers.getWasteManagementToursOverviewInternal(
            new Request('https://studio.test/api/v1/waste-management/tours'),
            actor,
            { ...createDeps(), loadToursOverview: vi.fn(async () => ({ tours: [] })) }
          ),
      },
      {
        run: () =>
          wasteManagementReadHandlers.getWasteManagementSchedulingOverviewInternal(
            new Request('https://studio.test/api/v1/waste-management/scheduling'),
            actor,
            { ...createDeps(), loadSchedulingOverview: vi.fn(async () => ({ tourDateShifts: [], globalDateShifts: [] })) }
          ),
      },
    ];

    for (const testCase of successCases) {
      const response = await testCase.run();
      expect(response.status).toBe(200);
    }

    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(expect.any(Object), 'tenant-a', 'success');

    const failureResponse = await wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data'),
      actor,
      {
        ...createDeps(),
        loadMasterDataOverview: vi.fn(async () => {
          throw new Error('db down');
        }),
      }
    );

    expect(failureResponse.status).toBe(503);
    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(expect.any(Object), 'tenant-a', 'revalidate');
  });
});
