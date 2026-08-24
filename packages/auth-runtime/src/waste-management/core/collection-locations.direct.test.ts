import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { wasteManagementCollectionLocationHandlers } from './collection-locations.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const createHeaders = () => ({
  'content-type': 'application/json',
  origin: 'https://studio.test',
  'x-requested-with': 'XMLHttpRequest',
});

const filterIds = {
  region: '10000000-0000-4000-8000-000000000001',
  city: '20000000-0000-4000-8000-000000000001',
  tour: '30000000-0000-4000-8000-000000000001',
} as const;

const createDeps = () => ({
  getRequestId: () => 'req-test',
  getSessionById: vi.fn(async () => ({
    activeOrganizationId: 'org-1',
  })),
  emitAuditEvent: vi.fn(async () => undefined),
  resolvePermissions: vi.fn(async () => ({
    ok: true as const,
    permissions: [
      {
        action: 'waste-management.master-data.manage',
        resourceType: 'waste-management',
      },
      {
        action: 'waste-management.read',
        resourceType: 'waste-management',
      },
    ],
  })),
});

describe('waste-management collection location handlers', () => {
  it('loads a normalized global page and resolves filtered ids through the read contract', async () => {
    const loadWasteCollectionLocationPage = vi.fn(async (_instanceId, query) => ({
      items: [],
      page: query.page,
      pageSize: query.pageSize,
      total: 0,
      pageCount: 0,
    }));
    const pageResponse =
      await wasteManagementCollectionLocationHandlers.getWasteManagementCollectionLocationsInternal(
        new Request(
          `https://studio.test/api/v1/waste-management/collection-locations?q=Nord&status=active&regionId=${filterIds.region}&cityId=${filterIds.city}&tourId=${filterIds.tour}&sortMode=addressWithRegion&sortDirection=desc&page=2&pageSize=50`
        ),
        actor,
        { ...createDeps(), loadWasteCollectionLocationPage }
      );

    expect(pageResponse.status).toBe(200);
    expect(loadWasteCollectionLocationPage).toHaveBeenCalledWith('tenant-a', {
      q: 'Nord',
      status: 'active',
      regionId: filterIds.region,
      cityId: filterIds.city,
      tourId: filterIds.tour,
      sortMode: 'addressWithRegion',
      sortDirection: 'desc',
      page: 2,
      pageSize: 50,
    });
    await expect(pageResponse.json()).resolves.toMatchObject({
      data: { page: 2, pageSize: 50, total: 0, pageCount: 0 },
      requestId: 'req-test',
    });

    const loadWasteCollectionLocationIds = vi.fn(async () => ['location-1', 'location-2']);
    const idsResponse =
      await wasteManagementCollectionLocationHandlers.getWasteManagementCollectionLocationIdsInternal(
        new Request(
          `https://studio.test/api/v1/waste-management/collection-locations/selection?status=inactive&cityId=${filterIds.city}`
        ),
        actor,
        { ...createDeps(), loadWasteCollectionLocationIds }
      );
    expect(idsResponse.status).toBe(200);
    expect(loadWasteCollectionLocationIds).toHaveBeenCalledWith('tenant-a', {
      q: undefined,
      status: 'inactive',
      regionId: undefined,
      cityId: filterIds.city,
      tourId: undefined,
    });
    await expect(idsResponse.json()).resolves.toMatchObject({
      data: { ids: ['location-1', 'location-2'] },
    });
  });

  it.each([
    'sortMode=street',
    'sortDirection=sideways',
    'sortField=city',
    'sortMode=address&sortMode=addressWithRegion',
    'page=0',
    'pageSize=20',
    'regionId=not-a-uuid',
    'cityId=not-a-uuid',
    'tourId=not-a-uuid',
    'q=%00',
  ])('rejects invalid direct list parameters: %s', async (query) => {
    const loadWasteCollectionLocationPage = vi.fn();
    const response =
      await wasteManagementCollectionLocationHandlers.getWasteManagementCollectionLocationsInternal(
        new Request(`https://studio.test/api/v1/waste-management/collection-locations?${query}`),
        actor,
        { ...createDeps(), loadWasteCollectionLocationPage }
      );

    expect(response.status).toBe(400);
    expect(loadWasteCollectionLocationPage).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_request' },
    });
  });

  it.each(['regionId=not-a-uuid', 'cityId=not-a-uuid', 'tourId=not-a-uuid', 'q=%00'])(
    'rejects invalid selection filters before querying: %s',
    async (query) => {
      const loadWasteCollectionLocationIds = vi.fn();
      const response =
        await wasteManagementCollectionLocationHandlers.getWasteManagementCollectionLocationIdsInternal(
          new Request(
            `https://studio.test/api/v1/waste-management/collection-locations/selection?${query}`
          ),
          actor,
          { ...createDeps(), loadWasteCollectionLocationIds }
        );

      expect(response.status).toBe(400);
      expect(loadWasteCollectionLocationIds).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'invalid_request' },
      });
    }
  );

  it('rejects the list read without waste-management.read', async () => {
    const loadWasteCollectionLocationPage = vi.fn();
    const response =
      await wasteManagementCollectionLocationHandlers.getWasteManagementCollectionLocationsInternal(
        new Request('https://studio.test/api/v1/waste-management/collection-locations'),
        actor,
        {
          ...createDeps(),
          resolvePermissions: vi.fn(async () => ({
            ok: true as const,
            permissions: [],
          })),
          loadWasteCollectionLocationPage,
        }
      );

    expect(response.status).toBe(403);
    expect(loadWasteCollectionLocationPage).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'forbidden' },
    });
  });

  it('creates, updates, and deletes collection locations with normalized optional ids', async () => {
    const saveWasteCollectionLocation = vi.fn(async (_instanceId, input) => input);
    const loadWasteCollectionLocationById = vi.fn(async (_instanceId, id) => ({
      id,
      cityId: 'city-1',
      regionId: undefined,
      streetId: undefined,
      houseNumberId: undefined,
      active: true,
    }));
    const deleteWasteCollectionLocation = vi.fn(async () => undefined);

    const createResponse =
      await wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal(
        new Request('https://studio.test/api/v1/waste-management/collection-locations', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'location-1',
            cityId: 'city-1',
            active: true,
          }),
        }),
        actor,
        {
          ...createDeps(),
          saveWasteCollectionLocation,
          loadWasteCollectionLocationById,
        }
      );
    expect(createResponse.status).toBe(201);
    expect(saveWasteCollectionLocation).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        id: 'location-1',
        cityId: 'city-1',
        regionId: undefined,
        streetId: undefined,
        houseNumberId: undefined,
      })
    );

    const updateResponse =
      await wasteManagementCollectionLocationHandlers.updateWasteManagementCollectionLocationInternal(
        new Request('https://studio.test/api/v1/waste-management/collection-locations/location-1', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            cityId: 'city-1',
            regionId: 'region-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: false,
          }),
        }),
        actor,
        {
          ...createDeps(),
          saveWasteCollectionLocation,
          loadWasteCollectionLocationById,
        }
      );
    expect(updateResponse.status).toBe(200);
    expect(saveWasteCollectionLocation).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        id: 'location-1',
        regionId: 'region-1',
        streetId: 'street-1',
        houseNumberId: 'house-1',
        active: false,
      })
    );

    const deleteResponse =
      await wasteManagementCollectionLocationHandlers.deleteWasteManagementCollectionLocationInternal(
        new Request('https://studio.test/api/v1/waste-management/collection-locations/location-1', {
          method: 'DELETE',
          headers: createHeaders(),
        }),
        actor,
        {
          ...createDeps(),
          loadWasteCollectionLocationById,
          deleteWasteCollectionLocation,
        }
      );
    expect(deleteResponse.status).toBe(200);
    expect(deleteWasteCollectionLocation).toHaveBeenCalledWith('tenant-a', 'location-1');
  });

  it('returns a specific persistence hint when the data source rejects collection locations without street references', async () => {
    const response =
      await wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal(
        new Request('https://studio.test/api/v1/waste-management/collection-locations', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'location-2',
            cityId: 'city-1',
            active: true,
          }),
        }),
        actor,
        {
          ...createDeps(),
          saveWasteCollectionLocation: vi.fn(async () => {
            const error = new Error('null value in column "street_id"');
            Object.assign(error, {
              code: '23502',
              table: 'waste_collection_locations',
              column: 'street_id',
            });
            throw error;
          }),
          loadWasteCollectionLocationById: vi.fn(async () => null),
        }
      );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message:
          'Der Waste-Abholort konnte nicht gespeichert werden, weil die angebundene Waste-Datenquelle derzeit eine Straße verlangt. "Alle Straßen" ist dort aktuell nicht zulässig.',
      },
      requestId: 'req-test',
    });
  });

  it('returns a specific persistence hint when the data source rejects collection locations without house-number references', async () => {
    const response =
      await wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal(
        new Request('https://studio.test/api/v1/waste-management/collection-locations', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'location-3',
            cityId: 'city-1',
            streetId: 'street-1',
            active: true,
          }),
        }),
        actor,
        {
          ...createDeps(),
          saveWasteCollectionLocation: vi.fn(async () => {
            const error = new Error('null value in column "house_number_id"');
            Object.assign(error, {
              code: '23502',
              table: 'waste_collection_locations',
              column: 'house_number_id',
            });
            throw error;
          }),
          loadWasteCollectionLocationById: vi.fn(async () => null),
        }
      );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message:
          'Der Waste-Abholort konnte nicht gespeichert werden, weil die angebundene Waste-Datenquelle derzeit eine Hausnummer verlangt. "Alle Hausnummern" ist dort aktuell nicht zulässig.',
      },
      requestId: 'req-test',
    });
  });

  it('falls back to the generic persistence message for unrelated collection-location constraint columns', async () => {
    const response =
      await wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal(
        new Request('https://studio.test/api/v1/waste-management/collection-locations', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'location-4',
            cityId: 'city-1',
            active: true,
          }),
        }),
        actor,
        {
          ...createDeps(),
          saveWasteCollectionLocation: vi.fn(async () => {
            const error = new Error('null value in column "city_id"');
            Object.assign(error, {
              code: '23502',
              table: 'waste_collection_locations',
              column: 'city_id',
            });
            throw error;
          }),
          loadWasteCollectionLocationById: vi.fn(async () => null),
        }
      );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: 'Der Waste-Abholort konnte nicht gespeichert werden.',
      },
      requestId: 'req-test',
    });
  });
});
