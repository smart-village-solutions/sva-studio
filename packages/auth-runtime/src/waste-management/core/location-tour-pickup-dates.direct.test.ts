import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { wasteManagementLocationTourPickupDateHandlers } from './location-tour-pickup-dates.js';

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
  getSessionById: vi.fn(async () => ({ activeOrganizationId: 'org-1' })),
  emitAuditEvent: vi.fn(async () => undefined),
  resolvePermissions: vi.fn(async () => ({
    ok: true as const,
    permissions: [
      {
        action: 'waste-management.scheduling.manage',
        resourceType: 'waste-management',
        effect: 'allow' as const,
      },
    ],
  })),
});

describe('waste-management location tour pickup date handlers', () => {
  it('creates, updates, and deletes pickup dates with normalized optional notes', async () => {
    const saveWasteLocationTourPickupDate = vi.fn(async () => undefined);
    const loadWasteLocationTourPickupDateById = vi.fn(async (_instanceId, id) => ({
      id,
      locationId: 'location-1',
      tourId: 'tour-1',
      pickupDate: '2026-05-12',
      note: null,
    }));
    const deleteWasteLocationTourPickupDate = vi.fn(async () => undefined);

    const createResponse =
      await wasteManagementLocationTourPickupDateHandlers.createWasteManagementLocationTourPickupDateInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-pickup-dates', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'pickup-date-1',
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-12',
          }),
        }),
        actor,
        {
          ...createDeps(),
          saveWasteLocationTourPickupDate,
          loadWasteLocationTourPickupDateById,
        }
      );

    expect(createResponse.status).toBe(201);
    expect(saveWasteLocationTourPickupDate).toHaveBeenCalledWith('tenant-a', {
      id: 'pickup-date-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      pickupDate: '2026-05-12',
      note: null,
    });

    const updateResponse =
      await wasteManagementLocationTourPickupDateHandlers.updateWasteManagementLocationTourPickupDateInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-pickup-dates/pickup-date-1', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-13',
            note: '  Feiertag verschoben  ',
          }),
        }),
        actor,
        {
          ...createDeps(),
          saveWasteLocationTourPickupDate,
          loadWasteLocationTourPickupDateById,
        }
      );

    expect(updateResponse.status).toBe(200);
    expect(saveWasteLocationTourPickupDate).toHaveBeenCalledWith('tenant-a', {
      id: 'pickup-date-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      pickupDate: '2026-05-13',
      note: 'Feiertag verschoben',
    });

    const deleteResponse =
      await wasteManagementLocationTourPickupDateHandlers.deleteWasteManagementLocationTourPickupDateInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-pickup-dates/pickup-date-1', {
          method: 'DELETE',
          headers: createHeaders(),
        }),
        actor,
        {
          ...createDeps(),
          loadWasteLocationTourPickupDateById,
          deleteWasteLocationTourPickupDate,
        }
      );

    expect(deleteResponse.status).toBe(200);
    expect(deleteWasteLocationTourPickupDate).toHaveBeenCalledWith('tenant-a', 'pickup-date-1');
  });

  it('returns specific invalid-request responses for missing path ids and invalid payloads', async () => {
    const updateMissingId =
      await wasteManagementLocationTourPickupDateHandlers.updateWasteManagementLocationTourPickupDateInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-pickup-dates', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-13',
          }),
        }),
        actor,
        {
          ...createDeps(),
          loadWasteLocationTourPickupDateById: vi.fn(async () => null),
        }
      );
    expect(updateMissingId.status).toBe(400);
    await expect(updateMissingId.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: 'pickupDateId fehlt im Pfad.',
      },
    });

    const createInvalidPayload =
      await wasteManagementLocationTourPickupDateHandlers.createWasteManagementLocationTourPickupDateInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-pickup-dates', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'pickup-date-2',
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '13-05-2026',
          }),
        }),
        actor,
        createDeps()
      );
    expect(createInvalidPayload.status).toBe(400);

    const updateInvalidPayload =
      await wasteManagementLocationTourPickupDateHandlers.updateWasteManagementLocationTourPickupDateInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-pickup-dates/pickup-date-2', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '14-05-2026',
          }),
        }),
        actor,
        {
          ...createDeps(),
          loadWasteLocationTourPickupDateById: vi.fn(async () => ({ id: 'pickup-date-2' })),
          saveWasteLocationTourPickupDate: vi.fn(async () => undefined),
        }
      );
    expect(updateInvalidPayload.status).toBe(400);
  });

  it('short-circuits create, update, and delete on auth, instance, csrf, and missing-path guard failures', async () => {
    const authError = new Response('forbidden', { status: 403 });
    const authDeniedDeps = {
      ...createDeps(),
      resolvePermissions: vi.fn(async () => ({
        ok: true as const,
        permissions: [],
      })),
    };

    const createAuthDenied =
      await wasteManagementLocationTourPickupDateHandlers.createWasteManagementLocationTourPickupDateInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-pickup-dates', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'pickup-date-3',
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-14',
          }),
        }),
        actor,
        authDeniedDeps
      );
    expect(createAuthDenied.status).toBe(authError.status);

    const missingInstanceActor: AuthenticatedRequestContext = {
      sessionId: 'session-1',
      user: {
        ...actor.user,
        instanceId: undefined,
      },
    };
    const updateMissingInstance =
      await wasteManagementLocationTourPickupDateHandlers.updateWasteManagementLocationTourPickupDateInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-pickup-dates/pickup-date-1', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-14',
          }),
        }),
        missingInstanceActor,
        {
          ...createDeps(),
          loadWasteLocationTourPickupDateById: vi.fn(async () => null),
        }
      );
    expect(updateMissingInstance.status).toBe(400);

    const deleteMissingCsrf =
      await wasteManagementLocationTourPickupDateHandlers.deleteWasteManagementLocationTourPickupDateInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-pickup-dates/pickup-date-1', {
          method: 'DELETE',
        }),
        actor,
        {
          ...createDeps(),
          loadWasteLocationTourPickupDateById: vi.fn(async () => ({ id: 'pickup-date-1' })),
          deleteWasteLocationTourPickupDate: vi.fn(async () => undefined),
        }
      );
    expect(deleteMissingCsrf.status).toBe(403);

    const deleteMissingId =
      await wasteManagementLocationTourPickupDateHandlers.deleteWasteManagementLocationTourPickupDateInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-pickup-dates', {
          method: 'DELETE',
          headers: createHeaders(),
        }),
        actor,
        {
          ...createDeps(),
          loadWasteLocationTourPickupDateById: vi.fn(async () => ({ id: 'pickup-date-1' })),
          deleteWasteLocationTourPickupDate: vi.fn(async () => undefined),
        }
      );
    expect(deleteMissingId.status).toBe(400);
  });
});
