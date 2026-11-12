import { describe, expect, it, vi } from 'vitest';

import {
  createWasteAuthDeps,
  createWasteMutationRequest,
  createWasteTestActor,
  grantWastePermissions,
} from '../../tests/test-utils/handler-fixtures.js';

import type { AuthenticatedRequestContext } from './types.js';
import { wasteManagementLocationTourPickupDateHandlers } from './location-tour-pickup-dates.js';

const actor = createWasteTestActor();

const createDeps = () => ({
  ...createWasteAuthDeps(['waste-management.scheduling.manage']),
  emitAuditEvent: vi.fn(async () => undefined),
});

describe('waste-management location tour pickup date handlers', () => {
  it('creates, updates, and deletes pickup dates with normalized optional notes', async () => {
    const saveWasteLocationTourPickupDate = vi.fn(async () => undefined);
    const listWasteLocationTourPickupDates = vi.fn(async () => []);
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
        createWasteMutationRequest(
          'POST',
          'https://studio.test/api/v1/waste-management/location-tour-pickup-dates',
          {
            id: 'pickup-date-1',
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-12',
          }
        ),
        actor,
        {
          ...createDeps(),
          saveWasteLocationTourPickupDate,
          listWasteLocationTourPickupDates,
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
    expect(listWasteLocationTourPickupDates).toHaveBeenCalledWith('tenant-a', {
      locationId: 'location-1',
      tourId: 'tour-1',
      pickupDate: '2026-05-12',
    });

    const updateResponse =
      await wasteManagementLocationTourPickupDateHandlers.updateWasteManagementLocationTourPickupDateInternal(
        createWasteMutationRequest(
          'PUT',
          'https://studio.test/api/v1/waste-management/location-tour-pickup-dates/pickup-date-1',
          {
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-13',
            note: '  Feiertag verschoben  ',
          }
        ),
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
        createWasteMutationRequest(
          'DELETE',
          'https://studio.test/api/v1/waste-management/location-tour-pickup-dates/pickup-date-1'
        ),
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
        createWasteMutationRequest(
          'PUT',
          'https://studio.test/api/v1/waste-management/location-tour-pickup-dates',
          {
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-13',
          }
        ),
        actor,
        {
          ...createDeps(),
          listWasteLocationTourPickupDates: vi.fn(async () => []),
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
        createWasteMutationRequest(
          'POST',
          'https://studio.test/api/v1/waste-management/location-tour-pickup-dates',
          {
            id: 'pickup-date-2',
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '13-05-2026',
          }
        ),
        actor,
        createDeps()
      );
    expect(createInvalidPayload.status).toBe(400);

    const updateInvalidPayload =
      await wasteManagementLocationTourPickupDateHandlers.updateWasteManagementLocationTourPickupDateInternal(
        createWasteMutationRequest(
          'PUT',
          'https://studio.test/api/v1/waste-management/location-tour-pickup-dates/pickup-date-2',
          {
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '14-05-2026',
          }
        ),
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
      ...grantWastePermissions(),
    };

    const createAuthDenied =
      await wasteManagementLocationTourPickupDateHandlers.createWasteManagementLocationTourPickupDateInternal(
        createWasteMutationRequest(
          'POST',
          'https://studio.test/api/v1/waste-management/location-tour-pickup-dates',
          {
            id: 'pickup-date-3',
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-14',
          }
        ),
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
        createWasteMutationRequest(
          'PUT',
          'https://studio.test/api/v1/waste-management/location-tour-pickup-dates/pickup-date-1',
          {
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-14',
          }
        ),
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
        createWasteMutationRequest(
          'DELETE',
          'https://studio.test/api/v1/waste-management/location-tour-pickup-dates'
        ),
        actor,
        {
          ...createDeps(),
          loadWasteLocationTourPickupDateById: vi.fn(async () => ({ id: 'pickup-date-1' })),
          deleteWasteLocationTourPickupDate: vi.fn(async () => undefined),
        }
      );
    expect(deleteMissingId.status).toBe(400);
  });

  it('rejects duplicate pickup-date creates before mutating an existing tuple', async () => {
    const saveWasteLocationTourPickupDate = vi.fn(async () => undefined);

    const response =
      await wasteManagementLocationTourPickupDateHandlers.createWasteManagementLocationTourPickupDateInternal(
        createWasteMutationRequest(
          'POST',
          'https://studio.test/api/v1/waste-management/location-tour-pickup-dates',
          {
            id: 'pickup-date-new',
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-12',
          }
        ),
        actor,
        {
          ...createDeps(),
          saveWasteLocationTourPickupDate,
          listWasteLocationTourPickupDates: vi.fn(async () => [
            {
              id: 'pickup-date-existing',
              locationId: 'location-1',
              tourId: 'tour-1',
              pickupDate: '2026-05-12',
              note: 'Bestehend',
              createdAt: '2026-05-01T00:00:00.000Z',
              updatedAt: '2026-05-01T00:00:00.000Z',
            },
          ]),
          loadWasteLocationTourPickupDateById: vi.fn(async () => null),
        }
      );

    expect(response.status).toBe(409);
    expect(saveWasteLocationTourPickupDate).not.toHaveBeenCalled();
  });
});
