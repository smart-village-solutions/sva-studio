import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';

const updateWasteVisibleStatusMock = vi.hoisted(() => vi.fn(async () => undefined));
const loggerState = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    createSdkLogger: vi.fn(() => loggerState),
    getWorkspaceContext: () => ({
      requestId: 'req-test',
      traceId: 'trace-test',
      workspaceId: 'tenant-a',
    }),
  };
});

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
  getSessionById: vi.fn(async () => ({
    activeOrganizationId: 'org-1',
  })),
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
  beforeEach(() => {
    vi.clearAllMocks();
    updateWasteVisibleStatusMock.mockResolvedValue(undefined);
  });

  it('loads settings and history with sanitized payloads and paging params', async () => {
    const settingsDeps = {
      ...createDeps('waste-management.settings.manage'),
      loadDefaultInterfaceRecord: vi.fn(async () => ({
        id: 'supabase-1',
        instanceId: 'tenant-a',
        typeKey: 'supabase',
        ownerKind: 'host',
        ownerId: 'host',
        displayName: 'Supabase',
        alias: 'default',
        enabled: true,
        isDefault: true,
        category: 'database',
        statusCheckKind: 'supabase',
        visibleStatus: 'ok',
        publicConfig: {
          projectUrl: 'https://tenant.example',
          schemaName: 'wm',
        },
        secretConfigCiphertext: 'cipher-secret',
      })),
    };
    const settingsResponse = await wasteManagementReadHandlers.getWasteManagementSettingsInternal(
      new Request('https://studio.test/api/v1/waste-management/settings'),
      actor,
      settingsDeps
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
    expect(settingsDeps.resolvePermissions).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      keycloakSubject: 'user-1',
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
        loadDefaultInterfaceRecord: vi.fn(async () => {
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

  it('rejects organization-scoped read permissions for instance-wide waste reads', async () => {
    const response = await wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data'),
      actor,
      {
        getRequestId: () => 'req-test',
        getSessionById: vi.fn(async () => ({
          id: 'session-1',
          userId: 'user-1',
          createdAt: Date.now(),
          activeOrganizationId: '11111111-1111-4111-8111-111111111111',
        })),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            {
              action: 'waste-management.read',
              resourceType: 'waste-management',
              organizationId: '11111111-1111-4111-8111-111111111111',
              effect: 'allow' as const,
            },
          ],
        })),
        loadMasterDataOverview: vi.fn(async () => ({
          fractions: [],
          regions: [],
          cities: [],
          streets: [],
          houseNumbers: [],
          collectionLocations: [],
          locationTourLinks: [],
        })),
      }
    );

    expect(response.status).toBe(403);
  });

  it('returns guard errors before overview loaders run', async () => {
    const forbiddenResponse = await wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data'),
      actor,
      {
        getRequestId: () => 'req-test',
        getSessionById: vi.fn(async () => ({
          activeOrganizationId: 'org-1',
        })),
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

  it('returns fractions data even when the visible-status update fails after a successful load', async () => {
    updateWasteVisibleStatusMock.mockRejectedValueOnce(new Error('visible status write failed'));

    const response = await wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data?scope=fractions'),
      actor,
      {
        ...createDeps(),
        loadMasterDataFractionsOverview: vi.fn(async () => ({
          fractions: [{ id: 'fraction-1' }],
          regions: [],
          cities: [],
          streets: [],
          houseNumbers: [],
          collectionLocations: [],
          locationTourLinks: [],
        })),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        fractions: [{ id: 'fraction-1' }],
      },
      requestId: 'req-test',
    });
    expect(loggerState.warn).toHaveBeenCalledWith(
      'Waste visible status update failed',
      expect.objectContaining({
        operation: 'get_waste_management_master_data_overview',
        update_outcome: 'success',
        instance_id: 'tenant-a',
        request_id: 'req-test',
        error_message: 'visible status write failed',
      })
    );
  });

  it('logs the original overview failure and still returns 503 when revalidation also fails', async () => {
    updateWasteVisibleStatusMock.mockRejectedValueOnce(new Error('revalidation write failed'));

    const response = await wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data'),
      actor,
      {
        ...createDeps(),
        loadMasterDataOverview: vi.fn(async () => {
          throw new Error('db down');
        }),
      }
    );

    expect(response.status).toBe(503);
    expect(loggerState.error).toHaveBeenCalledWith(
      'Waste master-data overview failed',
      expect.objectContaining({
        operation: 'get_waste_management_master_data_overview',
        instance_id: 'tenant-a',
        request_id: 'req-test',
        error_message: 'db down',
      })
    );
    expect(loggerState.warn).toHaveBeenCalledWith(
      'Waste visible status update failed',
      expect.objectContaining({
        operation: 'get_waste_management_master_data_overview',
        update_outcome: 'revalidate',
        instance_id: 'tenant-a',
        request_id: 'req-test',
        error_message: 'revalidation write failed',
      })
    );
  });

  it('logs scope and entity counts when master-data loads successfully', async () => {
    const response = await wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data?scope=fractions'),
      actor,
      {
        ...createDeps(),
        loadMasterDataFractionsOverview: vi.fn(async () => ({
          fractions: [{ id: 'fraction-1' }, { id: 'fraction-2' }],
          regions: [],
          cities: [],
          streets: [],
          houseNumbers: [],
          collectionLocations: [],
          locationTourLinks: [],
        })),
      }
    );

    expect(response.status).toBe(200);
    expect(loggerState.info).toHaveBeenCalledWith(
      'Waste master-data overview loaded',
      expect.objectContaining({
        operation: 'get_waste_management_master_data_overview',
        master_data_scope: 'fractions',
        fractions_count: 2,
        regions_count: 0,
        collection_locations_count: 0,
        request_id: 'req-test',
      })
    );
  });

  it('logs response serialization failures separately for master-data responses', async () => {
    const originalStringify = JSON.stringify;
    const stringifySpy = vi.spyOn(JSON, 'stringify').mockImplementation(((value: unknown, replacer?: unknown, space?: unknown) => {
      if (
        value &&
        typeof value === 'object' &&
        'data' in value &&
        Array.isArray((value as { data?: { fractions?: unknown } }).data?.fractions)
      ) {
        throw new Error('serialize failed');
      }

      return originalStringify(value, replacer as never, space as never);
    }) as typeof JSON.stringify);

    const response = await wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data?scope=fractions'),
      actor,
      {
        ...createDeps(),
        loadMasterDataFractionsOverview: vi.fn(async () => ({
          fractions: [{ id: 'fraction-1' }],
          regions: [],
          cities: [],
          streets: [],
          houseNumbers: [],
          collectionLocations: [],
          locationTourLinks: [],
        })),
      }
    );

    stringifySpy.mockRestore();

    expect(response.status).toBe(503);
    expect(loggerState.error).toHaveBeenCalledWith(
      'Waste master-data response serialization failed',
      expect.objectContaining({
        operation: 'get_waste_management_master_data_overview',
        master_data_scope: 'fractions',
        fractions_count: 1,
        request_id: 'req-test',
        error_message: 'serialize failed',
      })
    );
  });

  it('uses the scoped fractions overview loader when master-data is requested with scope=fractions', async () => {
    const loadMasterDataOverview = vi.fn(async () => ({
      fractions: [],
      regions: [{ id: 'region-1' }],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    }));
    const loadMasterDataFractionsOverview = vi.fn(async () => ({
      fractions: [{ id: 'fraction-1' }],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    }));

    const response = await wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data?scope=fractions'),
      actor,
      {
        ...createDeps(),
        loadMasterDataOverview,
        loadMasterDataFractionsOverview,
      }
    );

    expect(response.status).toBe(200);
    expect(loadMasterDataOverview).not.toHaveBeenCalled();
    expect(loadMasterDataFractionsOverview).toHaveBeenCalledWith('tenant-a');
    await expect(response.json()).resolves.toMatchObject({
      data: {
        fractions: [{ id: 'fraction-1' }],
        regions: [],
      },
    });
  });

  it('uses the scoped locations overview loader when master-data is requested with scope=locations', async () => {
    const loadMasterDataOverview = vi.fn(async () => ({
      fractions: [{ id: 'fraction-1' }],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    }));
    const loadMasterDataLocationsOverview = vi.fn(async () => ({
      fractions: [],
      regions: [{ id: 'region-1' }],
      cities: [{ id: 'city-1' }],
      streets: [{ id: 'street-1' }],
      houseNumbers: [{ id: 'house-1' }],
      collectionLocations: [{ id: 'location-1' }],
      locationTourLinks: [{ id: 'link-1' }],
    }));

    const response = await wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data?scope=locations'),
      actor,
      {
        ...createDeps(),
        loadMasterDataOverview,
        loadMasterDataLocationsOverview,
      }
    );

    expect(response.status).toBe(200);
    expect(loadMasterDataOverview).not.toHaveBeenCalled();
    expect(loadMasterDataLocationsOverview).toHaveBeenCalledWith('tenant-a');
    await expect(response.json()).resolves.toMatchObject({
      data: {
        fractions: [],
        regions: [{ id: 'region-1' }],
        collectionLocations: [{ id: 'location-1' }],
      },
    });
  });

});
