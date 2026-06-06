import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createWasteManagementCity,
  createWasteManagementCollectionLocation,
  createWasteManagementHouseNumber,
  createWasteManagementLocationTourLinksBulk,
  deleteWasteManagementFraction,
  createWasteManagementFraction,
  createWasteManagementGlobalDateShift,
  createWasteManagementLocationTourLink,
  createWasteManagementRegion,
  createWasteManagementStreet,
  createWasteManagementTour,
  createWasteManagementTourDateShift,
  deleteWasteManagementLocationTourLink,
  getWasteManagementHistoryOverview,
  getWasteManagementImportCatalog,
  getWasteManagementJobDetail,
  getWasteManagementMasterDataOverview,
  getWasteManagementSchedulingOverview,
  getWasteManagementSettings,
  getWasteManagementToursOverview,
  startWasteManagementInitialize,
  startWasteManagementImport,
  startWasteManagementMigrations,
  startWasteManagementHolidaySync,
  startWasteManagementReset,
  startWasteManagementSeed,
  updateWasteManagementHolidayRule,
  updateWasteManagementFraction,
  updateWasteManagementCity,
  updateWasteManagementCollectionLocation,
  updateWasteManagementGlobalDateShift,
  updateWasteManagementHouseNumber,
  updateWasteManagementLocationTourLink,
  updateWasteManagementRegion,
  updateWasteManagementStreet,
  updateWasteManagementTour,
  updateWasteManagementTourDateShift,
  updateWasteManagementSettings,
  WasteManagementApiError,
} from '../src/waste-management.api.js';

describe('waste-management api client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'idem-1'),
    });
  });

  const createJobResponse = (jobTypeId: string) =>
    new Response(
      JSON.stringify({
        data: {
          id: `job:${jobTypeId}`,
          pluginId: 'waste-management',
          jobTypeId,
          status: 'pending',
        },
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    );

  it('loads waste settings through the host facade', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            instanceId: 'tenant-a',
            provider: 'supabase',
            projectUrl: 'https://tenant-a.supabase.co',
            schemaName: 'wm',
            enabled: true,
            databaseUrlConfigured: true,
            serviceRoleKeyConfigured: true,
            visibleStatus: 'ok',
            customRecurrencePresets: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(getWasteManagementSettings()).resolves.toMatchObject({
      instanceId: 'tenant-a',
      projectUrl: 'https://tenant-a.supabase.co',
      visibleStatus: 'ok',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/settings',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('loads the waste history overview through the host facade', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            audit: {
              items: [
                {
                  id: 'log-1',
                  actionId: 'waste-management.fraction.created',
                  actionNamespace: 'waste-management',
                  actionOwner: 'waste-management',
                  outcome: 'success',
                  occurredAt: '2026-05-09T12:00:00.000Z',
                },
              ],
              total: 1,
            },
            technical: {
              items: [
                {
                  id: 'job-1',
                  eventType: 'migration.succeeded',
                  outcome: 'success',
                  occurredAt: '2026-05-09T12:05:00.000Z',
                  source: 'job',
                  jobId: 'job-1',
                  jobTypeId: 'waste-management.apply-migrations',
                },
              ],
              total: 1,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(getWasteManagementHistoryOverview({ q: 'fraction', page: 2, pageSize: 10 })).resolves.toMatchObject({
      audit: {
        total: 1,
        items: [expect.objectContaining({ actionId: 'waste-management.fraction.created' })],
      },
      technical: {
        total: 1,
        items: [expect.objectContaining({ eventType: 'migration.succeeded' })],
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/history?page=2&pageSize=10&q=fraction',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('loads a single plugin operation job detail through the host facade', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            id: 'job-1',
            instanceId: 'tenant-a',
            pluginId: 'waste-management',
            jobTypeId: 'waste-management.apply-migrations',
            queueName: 'plugin-operations',
            status: 'running',
            inputPayload: { operation: 'apply-migrations' },
            attempts: 1,
            maxAttempts: 5,
            idempotencyKey: 'idem-1',
            scheduledAt: '2026-05-10T10:00:00.000Z',
            createdAt: '2026-05-10T10:00:00.000Z',
            updatedAt: '2026-05-10T10:00:05.000Z',
            history: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(getWasteManagementJobDetail('job-1')).resolves.toMatchObject({
      id: 'job-1',
      status: 'running',
      jobTypeId: 'waste-management.apply-migrations',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/plugin-operations/jobs/job-1',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('loads the waste master-data overview through the host facade', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            fractions: [
              {
                id: 'fraction-1',
                name: 'Restmüll',
                color: '#111111',
                active: true,
                createdAt: '2026-05-09T10:00:00.000Z',
                updatedAt: '2026-05-09T10:00:00.000Z',
              },
            ],
            regions: [],
            cities: [],
            streets: [],
            houseNumbers: [],
            collectionLocations: [],
            locationTourLinks: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(getWasteManagementMasterDataOverview()).resolves.toMatchObject({
      fractions: [expect.objectContaining({ name: 'Restmüll' })],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/master-data',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('requests scoped waste master-data reads for fractions', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            fractions: [{ id: 'fraction-1', name: 'Restmüll', active: true }],
            regions: [],
            cities: [],
            streets: [],
            houseNumbers: [],
            collectionLocations: [],
            locationTourLinks: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(getWasteManagementMasterDataOverview({ scope: 'fractions' })).resolves.toMatchObject({
      fractions: [expect.objectContaining({ id: 'fraction-1' })],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/master-data?scope=fractions',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('requests scoped waste master-data reads for locations', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            fractions: [],
            regions: [{ id: 'region-1', name: 'Nord' }],
            cities: [],
            streets: [],
            houseNumbers: [],
            collectionLocations: [],
            locationTourLinks: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(getWasteManagementMasterDataOverview({ scope: 'locations' })).resolves.toMatchObject({
      regions: [expect.objectContaining({ id: 'region-1' })],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/master-data?scope=locations',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('deduplicates overlapping waste master-data reads', async () => {
    let resolveResponse: ((response: Response) => void) | null = null;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );

    const firstRequest = getWasteManagementMasterDataOverview();
    const secondRequest = getWasteManagementMasterDataOverview();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse?.(
      new Response(
        JSON.stringify({
          data: {
            fractions: [{ id: 'fraction-1', name: 'Restmüll', active: true }],
            regions: [],
            cities: [],
            streets: [],
            houseNumbers: [],
            collectionLocations: [],
            locationTourLinks: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(firstRequest).resolves.toMatchObject({
      fractions: [expect.objectContaining({ id: 'fraction-1' })],
    });
    await expect(secondRequest).resolves.toMatchObject({
      fractions: [expect.objectContaining({ id: 'fraction-1' })],
    });
  });

  it('creates and updates waste fractions through the host facade', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'fraction-3',
              name: 'Papier',
              color: '#123456',
              active: true,
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T10:00:00.000Z',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'fraction-3',
              name: 'Papier Plus',
              color: '#123456',
              active: true,
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await createWasteManagementFraction({
      id: 'fraction-3',
      name: 'Papier',
      translations: { de: 'Papier', en: 'Paper' },
      color: '#123456',
      active: true,
    });
    await updateWasteManagementFraction('fraction-3', {
      name: 'Papier Plus',
      translations: { de: 'Papier Plus', en: 'Paper Plus' },
      color: '#123456',
      active: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/waste-management/fractions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id: 'fraction-3',
          name: 'Papier',
          translations: { de: 'Papier', en: 'Paper' },
          color: '#123456',
          active: true,
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/waste-management/fractions/fraction-3',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'Papier Plus',
          translations: { de: 'Papier Plus', en: 'Paper Plus' },
          color: '#123456',
          active: true,
        }),
      })
    );
  });

  it('deletes waste fractions through the host facade', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'fraction-3' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await deleteWasteManagementFraction('fraction-3');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/fractions/fraction-3',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('creates and updates waste regions through the host facade', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'region-3',
              name: 'Region West',
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T10:00:00.000Z',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'region-3',
              name: 'Region West Plus',
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await createWasteManagementRegion({
      id: 'region-3',
      name: 'Region West',
    });
    await updateWasteManagementRegion('region-3', {
      name: 'Region West Plus',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/waste-management/regions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id: 'region-3',
          name: 'Region West',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/waste-management/regions/region-3',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'Region West Plus',
        }),
      })
    );
  });

  it('creates and updates waste collection locations through the host facade', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'location-3',
              cityId: 'city-1',
              regionId: 'region-1',
              streetId: 'street-1',
              houseNumberId: 'house-1',
              active: true,
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T10:00:00.000Z',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'location-3',
              cityId: 'city-1',
              regionId: 'region-1',
              streetId: 'street-1',
              houseNumberId: 'house-2',
              active: true,
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await createWasteManagementCollectionLocation({
      id: 'location-3',
      cityId: 'city-1',
      regionId: 'region-1',
      streetId: 'street-1',
      houseNumberId: 'house-1',
      active: true,
    });
    await updateWasteManagementCollectionLocation('location-3', {
      cityId: 'city-1',
      regionId: 'region-1',
      streetId: 'street-1',
      houseNumberId: 'house-2',
      active: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/waste-management/collection-locations',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/waste-management/collection-locations/location-3',
      expect.objectContaining({
        method: 'PUT',
      })
    );
  });

  it('creates and updates waste streets through the host facade', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'street-3',
              name: 'Parkweg',
              cityId: 'city-1',
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T10:00:00.000Z',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'street-3',
              name: 'Parkweg Nord',
              cityId: 'city-2',
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await createWasteManagementStreet({
      id: 'street-3',
      name: 'Parkweg',
      cityId: 'city-1',
    });
    await updateWasteManagementStreet('street-3', {
      name: 'Parkweg Nord',
      cityId: 'city-2',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/waste-management/streets',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id: 'street-3',
          name: 'Parkweg',
          cityId: 'city-1',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/waste-management/streets/street-3',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'Parkweg Nord',
          cityId: 'city-2',
        }),
      })
    );
  });

  it('creates and updates waste house numbers through the host facade', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'house-3',
              number: '14',
              streetId: 'street-1',
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T10:00:00.000Z',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'house-3',
              number: '14a',
              streetId: 'street-2',
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await createWasteManagementHouseNumber({
      id: 'house-3',
      number: '14',
      streetId: 'street-1',
    });
    await updateWasteManagementHouseNumber('house-3', {
      number: '14a',
      streetId: 'street-2',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/waste-management/house-numbers',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id: 'house-3',
          number: '14',
          streetId: 'street-1',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/waste-management/house-numbers/house-3',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          number: '14a',
          streetId: 'street-2',
        }),
      })
    );
  });

  it('creates waste location-tour links in bulk through the host facade', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            createdCount: 2,
            items: [
              {
                id: 'link-10',
                locationId: 'location-1',
                tourId: 'tour-1',
                startDate: '2026-05-01',
                createdAt: '2026-05-09T10:00:00.000Z',
                updatedAt: '2026-05-09T10:00:00.000Z',
              },
              {
                id: 'link-11',
                locationId: 'location-2',
                tourId: 'tour-1',
                startDate: '2026-05-01',
                createdAt: '2026-05-09T10:00:00.000Z',
                updatedAt: '2026-05-09T10:00:00.000Z',
              },
            ],
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await createWasteManagementLocationTourLinksBulk({
      locationIds: ['location-1', 'location-2'],
      tourId: 'tour-1',
      startDate: '2026-05-01',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/location-tour-links/bulk',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          locationIds: ['location-1', 'location-2'],
          tourId: 'tour-1',
          startDate: '2026-05-01',
        }),
      })
    );
  });

  it('creates and updates waste location-tour links through the host facade', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'link-3',
              locationId: 'location-1',
              tourId: 'tour-1',
              startDate: '2026-05-01',
              endDate: '2026-12-31',
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T10:00:00.000Z',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'link-3',
              locationId: 'location-1',
              tourId: 'tour-1',
              startDate: '2026-05-01',
              endDate: '2027-01-15',
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await createWasteManagementLocationTourLink({
      id: 'link-3',
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: '2026-12-31',
    });
    await updateWasteManagementLocationTourLink('link-3', {
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: '2027-01-15',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/waste-management/location-tour-links',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/waste-management/location-tour-links/link-3',
      expect.objectContaining({
        method: 'PUT',
      })
    );
  });

  it('deletes waste location-tour links through the host facade', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await deleteWasteManagementLocationTourLink('link/delete me');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/location-tour-links/link%2Fdelete%20me',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('creates and updates waste cities through the host facade', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'city-3',
              name: 'Musterstadt West',
              regionId: 'region-1',
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T10:00:00.000Z',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'city-3',
              name: 'Musterstadt Nord',
              regionId: 'region-1',
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await createWasteManagementCity({
      id: 'city-3',
      name: 'Musterstadt West',
      regionId: 'region-1',
    });
    await updateWasteManagementCity('city-3', {
      name: 'Musterstadt Nord',
      regionId: 'region-1',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/waste-management/cities',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id: 'city-3',
          name: 'Musterstadt West',
          regionId: 'region-1',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/waste-management/cities/city-3',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'Musterstadt Nord',
          regionId: 'region-1',
        }),
      })
    );
  });

  it('loads the waste tours overview through the host facade', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            tours: [
              {
                id: 'tour-1',
                name: 'Restmüll Nord',
                wasteFractionIds: ['fraction-1'],
                recurrence: 'weekly',
                active: true,
                createdAt: '2026-05-09T10:00:00.000Z',
                updatedAt: '2026-05-09T10:00:00.000Z',
              },
            ],
            customRecurrencePresets: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(getWasteManagementToursOverview()).resolves.toMatchObject({
      tours: [expect.objectContaining({ name: 'Restmüll Nord' })],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/tours',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('creates and updates waste tours through the host facade', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'tour-3',
              name: 'Papier Mitte',
              wasteFractionIds: ['fraction-2'],
              recurrence: 'biweekly',
              firstDate: '2026-05-19',
              active: true,
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T10:00:00.000Z',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'tour-3',
              name: 'Papier Mitte Plus',
              wasteFractionIds: ['fraction-2'],
              recurrence: 'biweekly',
              firstDate: '2026-05-19',
              active: true,
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await createWasteManagementTour({
      id: 'tour-3',
      name: 'Papier Mitte',
      wasteFractionIds: ['fraction-2'],
      recurrence: 'biweekly',
      customRecurrenceId: undefined,
      firstDate: '2026-05-19',
      active: true,
    });
    await updateWasteManagementTour('tour-3', {
      name: 'Papier Mitte Plus',
      wasteFractionIds: ['fraction-2'],
      recurrence: 'biweekly',
      customRecurrenceId: undefined,
      firstDate: '2026-05-19',
      active: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/waste-management/tours',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id: 'tour-3',
          name: 'Papier Mitte',
          wasteFractionIds: ['fraction-2'],
          recurrence: 'biweekly',
          customRecurrenceId: undefined,
          firstDate: '2026-05-19',
          active: true,
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/waste-management/tours/tour-3',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'Papier Mitte Plus',
          wasteFractionIds: ['fraction-2'],
          recurrence: 'biweekly',
          customRecurrenceId: undefined,
          firstDate: '2026-05-19',
          active: true,
        }),
      })
    );
  });

  it('loads the waste scheduling overview through the host facade', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            tourDateShifts: [
              {
                id: 'tour-shift-1',
                tourId: 'tour-1',
                originalDate: '2026-12-24',
                actualDate: '2026-12-23',
                hasYear: true,
                createdAt: '2026-05-09T10:00:00.000Z',
                updatedAt: '2026-05-09T10:00:00.000Z',
              },
            ],
            globalDateShifts: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(getWasteManagementSchedulingOverview()).resolves.toMatchObject({
      tourDateShifts: [expect.objectContaining({ tourId: 'tour-1' })],
      globalDateShifts: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/scheduling',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('creates and updates tour-related waste date shifts through the host facade', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'shift-3',
              tourId: 'tour-1',
              originalDate: '2026-12-24',
              actualDate: '2026-12-23',
              hasYear: true,
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T10:00:00.000Z',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'shift-3',
              tourId: 'tour-1',
              originalDate: '2026-12-24',
              actualDate: '2026-12-22',
              hasYear: true,
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await createWasteManagementTourDateShift({
      id: 'shift-3',
      tourId: 'tour-1',
      originalDate: '2026-12-24',
      actualDate: '2026-12-23',
      hasYear: true,
      reasonType: 'manual-adjustment',
      reasonKey: 'xmas-pull-forward',
      followUpMode: 'propagate-series',
    });
    await updateWasteManagementTourDateShift('shift-3', {
      tourId: 'tour-1',
      originalDate: '2026-12-24',
      actualDate: '2026-12-22',
      hasYear: true,
      reasonType: 'manual-adjustment',
      reasonKey: 'xmas-pull-forward',
      followUpMode: 'mark-follow-up-dates',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/waste-management/tour-date-shifts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id: 'shift-3',
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-23',
          hasYear: true,
          reasonType: 'manual-adjustment',
          reasonKey: 'xmas-pull-forward',
          followUpMode: 'propagate-series',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/waste-management/tour-date-shifts/shift-3',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-22',
          hasYear: true,
          reasonType: 'manual-adjustment',
          reasonKey: 'xmas-pull-forward',
          followUpMode: 'mark-follow-up-dates',
        }),
      })
    );
  });

  it('creates and updates global waste date shifts through the host facade', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'global-shift-3',
              originalDate: '2026-01-01',
              actualDate: '2026-01-02',
              hasYear: true,
              tourIds: ['tour-1'],
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T10:00:00.000Z',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'global-shift-3',
              originalDate: '2026-01-01',
              actualDate: '2026-01-03',
              hasYear: true,
              tourIds: ['tour-1', 'tour-2'],
              createdAt: '2026-05-09T10:00:00.000Z',
              updatedAt: '2026-05-09T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    await createWasteManagementGlobalDateShift({
      id: 'global-shift-3',
      originalDate: '2026-01-01',
      actualDate: '2026-01-02',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'new-year',
      tourIds: ['tour-1'],
    });
    await updateWasteManagementGlobalDateShift('global-shift-3', {
      originalDate: '2026-01-01',
      actualDate: '2026-01-03',
      hasYear: true,
      reasonType: 'global-deviation',
      reasonKey: 'holiday-backlog',
      tourIds: ['tour-1', 'tour-2'],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/waste-management/global-date-shifts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id: 'global-shift-3',
          originalDate: '2026-01-01',
          actualDate: '2026-01-02',
          hasYear: true,
          reasonType: 'holiday',
          reasonKey: 'new-year',
          tourIds: ['tour-1'],
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/waste-management/global-date-shifts/global-shift-3',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          originalDate: '2026-01-01',
          actualDate: '2026-01-03',
          hasYear: true,
          reasonType: 'global-deviation',
          reasonKey: 'holiday-backlog',
          tourIds: ['tour-1', 'tour-2'],
        }),
      })
    );
  });

  it('saves waste settings with the canonical json headers', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            instanceId: 'tenant-a',
            provider: 'supabase',
            projectUrl: 'https://tenant-a.supabase.co',
            schemaName: 'wm',
            enabled: true,
            databaseUrlConfigured: true,
            serviceRoleKeyConfigured: true,
            visibleStatus: 'ok',
            customRecurrencePresets: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await updateWasteManagementSettings({
      provider: 'supabase',
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'wm',
      enabled: true,
      databaseUrl: 'postgres://db',
      serviceRoleKey: 'srv-key',
      customRecurrencePresets: [],
      deletedPresetFallbacks: {},
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/settings',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'wm',
          enabled: true,
          databaseUrl: 'postgres://db',
          serviceRoleKey: 'srv-key',
          customRecurrencePresets: [],
          deletedPresetFallbacks: {},
        }),
        headers: expect.any(Headers),
      })
    );
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [, init] = firstCall ?? [];
    const headers = init?.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Requested-With')).toBe('XMLHttpRequest');
  });

  it('starts the waste holiday sync through the host facade', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            instanceId: 'tenant-a',
            provider: 'supabase',
            projectUrl: 'https://tenant-a.supabase.co',
            schemaName: 'wm',
            enabled: true,
            databaseUrlConfigured: true,
            serviceRoleKeyConfigured: true,
            visibleStatus: 'ok',
            holidayStateCode: 'NW',
            lastHolidaySyncStatus: 'success',
            customRecurrencePresets: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(startWasteManagementHolidaySync()).resolves.toMatchObject({
      holidayStateCode: 'NW',
      lastHolidaySyncStatus: 'success',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/settings/holiday-sync',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });

  it('updates a waste holiday rule through the host facade', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            id: 'holiday-rule-1',
            holidayDate: '2026-01-01',
            holidayName: 'Neujahr',
            year: 2026,
            stateCode: 'NW',
            sourceStatus: 'confirmed',
            configurationStatus: 'configured',
            conflictStatus: 'none',
            scope: 'holiday-only',
            strategy: 'advance',
            createdAt: '2026-05-10T10:00:00.000Z',
            updatedAt: '2026-05-10T10:30:00.000Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(
      updateWasteManagementHolidayRule('holiday-rule-1', {
        scope: 'holiday-only',
        strategy: 'advance',
      })
    ).resolves.toMatchObject({
      id: 'holiday-rule-1',
      configurationStatus: 'configured',
      scope: 'holiday-only',
      strategy: 'advance',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/holiday-rules/holiday-rule-1',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
      })
    );
  });

  it('starts initialize, migration, seed and reset jobs with idempotency keys', async () => {
    fetchMock
      .mockResolvedValueOnce(createJobResponse('waste-management.initialize-data-source'))
      .mockResolvedValueOnce(createJobResponse('waste-management.apply-migrations'))
      .mockResolvedValueOnce(createJobResponse('waste-management.seed-data'))
      .mockResolvedValueOnce(createJobResponse('waste-management.reset-data'));

    await startWasteManagementInitialize({ targetSchema: 'wm' });
    await startWasteManagementMigrations({ targetSchema: 'wm', requestedByVersion: '2026.05.0' });
    await startWasteManagementSeed();
    await startWasteManagementReset({ confirmationToken: 'RESET' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/waste-management/tools/initialize',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ targetSchema: 'wm' }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/waste-management/tools/migrations',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ targetSchema: 'wm', requestedByVersion: '2026.05.0' }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/waste-management/tools/seed',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ seedKey: 'baseline' }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/waste-management/tools/reset',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ confirmationToken: 'RESET' }),
      })
    );

    for (const [, init] of fetchMock.mock.calls) {
      const headers = init?.headers as Headers;
      expect(headers.get('Idempotency-Key')).toBe('idem-1');
    }
  });

  it('exposes a stable waste import catalog and starts import jobs with idempotency keys', async () => {
    fetchMock.mockResolvedValueOnce(createJobResponse('waste-management.import-data'));

    expect(getWasteManagementImportCatalog()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileId: 'waste-management.geografie-abholorte',
          sourceFormats: expect.arrayContaining([
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ]),
        }),
        expect.objectContaining({
          profileId: 'waste-management.touren',
          sourceFormats: expect.arrayContaining([
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ]),
        }),
        expect.objectContaining({
          profileId: 'waste-management.ausweichtermine',
          sourceFormats: expect.arrayContaining([
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ]),
        }),
      ])
    );

    await startWasteManagementImport({
      importProfileId: 'waste-management.geografie-abholorte',
      sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      blobRef: 'data:text/csv;base64,Y2F0YWxvZw==',
      dryRun: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waste-management/tools/imports',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          importProfileId: 'waste-management.geografie-abholorte',
          sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          blobRef: 'data:text/csv;base64,Y2F0YWxvZw==',
          dryRun: true,
        }),
      })
    );

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [, init] = firstCall ?? [];
    const headers = init?.headers as Headers;
    expect(headers.get('Idempotency-Key')).toBe('idem-1');
  });

  it('maps host errors into WasteManagementApiError', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'forbidden',
          message: 'Keine Berechtigung',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(getWasteManagementSettings()).rejects.toEqual(
      expect.objectContaining<Partial<WasteManagementApiError>>({
        name: 'WasteManagementApiError',
        code: 'forbidden',
        message: 'Keine Berechtigung',
      })
    );
  });
});
