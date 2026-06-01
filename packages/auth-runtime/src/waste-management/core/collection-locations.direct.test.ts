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
        effect: 'allow' as const,
      },
    ],
  })),
});

describe('waste-management collection location handlers', () => {
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
});
