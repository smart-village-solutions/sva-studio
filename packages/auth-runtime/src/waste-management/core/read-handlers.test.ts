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
  const collectionLocationId = '11111111-1111-4111-8111-111111111111';

  it('loads settings and history with sanitized payloads and paging params', async () => {
    const settingsResponse = await wasteManagementReadHandlers.getWasteManagementSettingsInternal(
      new Request('https://studio.test/api/v1/waste-management/settings'),
      actor,
      {
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
      {
        run: () =>
          wasteManagementReadHandlers.getWasteManagementOutputOverviewInternal(
            new Request('https://studio.test/api/v1/waste-management/outputs'),
            actor,
            { ...createDeps(), loadWasteOutputOverview: vi.fn(async () => ({ collectionLocations: [] })) }
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

    const outputFailureResponse = await wasteManagementReadHandlers.getWasteManagementOutputOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/outputs'),
      actor,
      {
        ...createDeps(),
        loadWasteOutputOverview: vi.fn(async () => {
          throw new Error('storage down');
        }),
      }
    );

    expect(outputFailureResponse.status).toBe(503);
    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(expect.any(Object), 'tenant-a', 'revalidate');
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

  it('loads waste output overview and creates pdf outputs through dedicated handlers', async () => {
    const loadWasteOutputOverview = vi.fn(async () => ({
      collectionLocations: [
        {
          collectionLocationId,
          pdfs: [
            {
              year: 2026,
              deliveryUrl: `https://cdn.example/${collectionLocationId}/2026.pdf`,
              expiresAt: '2026-05-21T12:00:00.000Z',
            },
          ],
        },
      ],
    }));
    const generateWasteOutputPdf = vi.fn(async () => ({
      collectionLocationId,
      year: 2026,
      storageKey: `waste-output/collection-locations/${collectionLocationId}/2026.pdf`,
      deliveryUrl: `https://cdn.example/${collectionLocationId}/2026.pdf`,
      expiresAt: '2026-05-21T12:00:00.000Z',
    }));

    const overviewResponse = await wasteManagementReadHandlers.getWasteManagementOutputOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/outputs'),
      actor,
      {
        ...createDeps(),
        loadWasteOutputOverview,
      }
    );

    expect(overviewResponse.status).toBe(200);
    expect(loadWasteOutputOverview).toHaveBeenCalledWith('tenant-a');
    await expect(overviewResponse.json()).resolves.toMatchObject({
      data: {
        collectionLocations: [
          {
            collectionLocationId,
            pdfs: [{ year: 2026 }],
          },
        ],
      },
    });

    const createResponse = await wasteManagementReadHandlers.createWasteManagementOutputPdfInternal(
      new Request('https://studio.test/api/v1/waste-management/outputs/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'https://studio.test',
        },
        body: JSON.stringify({
          collectionLocationId,
          year: 2026,
        }),
      }),
      actor,
      {
        ...createDeps('waste-management.master-data.manage'),
        generateWasteOutputPdf,
      }
    );

    expect(createResponse.status).toBe(200);
    expect(generateWasteOutputPdf).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      collectionLocationId,
      year: 2026,
    });
    await expect(createResponse.json()).resolves.toMatchObject({
      data: {
        collectionLocationId,
        year: 2026,
        deliveryUrl: `https://cdn.example/${collectionLocationId}/2026.pdf`,
      },
    });
  });

  it('forbids waste pdf generation for read-only permissions', async () => {
    const createResponse = await wasteManagementReadHandlers.createWasteManagementOutputPdfInternal(
      new Request('https://studio.test/api/v1/waste-management/outputs/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'https://studio.test',
        },
        body: JSON.stringify({
          collectionLocationId,
          year: 2026,
        }),
      }),
      actor,
      {
        ...createDeps('waste-management.read'),
        generateWasteOutputPdf: vi.fn(async () => ({
          collectionLocationId,
          year: 2026,
          storageKey: `waste-output/collection-locations/${collectionLocationId}/2026.pdf`,
          deliveryUrl: `https://cdn.example/${collectionLocationId}/2026.pdf`,
          expiresAt: '2026-05-21T12:00:00.000Z',
        })),
      }
    );

    expect(createResponse.status).toBe(403);
  });

  it('returns not_found when waste pdf generation targets a deleted location', async () => {
    const createResponse = await wasteManagementReadHandlers.createWasteManagementOutputPdfInternal(
      new Request('https://studio.test/api/v1/waste-management/outputs/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'https://studio.test',
        },
        body: JSON.stringify({
          collectionLocationId,
          year: 2026,
        }),
      }),
      actor,
      {
        ...createDeps('waste-management.master-data.manage'),
        generateWasteOutputPdf: vi.fn(async () => {
          throw new Error(`waste_output_location_not_found:${collectionLocationId}`);
        }),
      }
    );

    expect(createResponse.status).toBe(404);
    await expect(createResponse.json()).resolves.toMatchObject({
      error: {
        code: 'not_found',
      },
    });
  });

  it('returns a neutral output-generation error code for non-not-found failures', async () => {
    const createResponse = await wasteManagementReadHandlers.createWasteManagementOutputPdfInternal(
      new Request('https://studio.test/api/v1/waste-management/outputs/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'https://studio.test',
        },
        body: JSON.stringify({
          collectionLocationId,
          year: 2026,
        }),
      }),
      actor,
      {
        ...createDeps('waste-management.master-data.manage'),
        generateWasteOutputPdf: vi.fn(async () => {
          throw new Error('storage offline');
        }),
      }
    );

    expect(createResponse.status).toBe(503);
    await expect(createResponse.json()).resolves.toMatchObject({
      error: {
        code: 'internal_error',
      },
    });
  });
});
