import { describe, expect, it, vi } from 'vitest';

import {
  createWasteAuthDeps,
  createWasteMutationHeaders,
  createWasteMutationRequest,
  createWasteTestActor,
  grantWastePermissions,
} from '../../tests/test-utils/handler-fixtures.js';

import { wasteManagementTourAssignmentHandlers } from './tour-assignments.js';

const actor = createWasteTestActor();

const mutationHeaders = createWasteMutationHeaders();

const createDeps = () => ({
  ...createWasteAuthDeps(['waste-management.scheduling.manage']),
  getRequestId: () => 'req-tour-assignment',
  emitAuditEvent: vi.fn(async () => undefined),
});

const assignment = {
  id: 'assignment-1',
  tourId: 'tour-1',
  pickupDate: '2026-05-12',
  note: null,
  locationIds: ['location-1', 'location-2'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('waste-management tour assignment handlers', () => {
  it('creates, updates, and deletes tenant-scoped assignments with multiple locations', async () => {
    const saveWasteTourAssignment = vi.fn(async () => undefined);
    const loadWasteTourAssignmentById = vi.fn(async () => assignment);
    const deleteWasteTourAssignment = vi.fn(async () => undefined);

    const createResponse =
      await wasteManagementTourAssignmentHandlers.createWasteManagementTourAssignmentInternal(
        createWasteMutationRequest(
          'POST',
          'https://studio.test/api/v1/waste-management/tour-assignments',
          {
            id: 'assignment-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-12',
            locationIds: ['location-1', 'location-2', 'location-1'],
          }
        ),
        actor,
        {
          ...createDeps(),
          saveWasteTourAssignment,
          loadWasteTourAssignmentById,
        }
      );

    expect(createResponse.status).toBe(201);
    expect(saveWasteTourAssignment).toHaveBeenCalledWith('tenant-a', {
      id: 'assignment-1',
      tourId: 'tour-1',
      pickupDate: '2026-05-12',
      note: null,
      locationIds: ['location-1', 'location-2'],
    });

    const updateResponse =
      await wasteManagementTourAssignmentHandlers.updateWasteManagementTourAssignmentInternal(
        createWasteMutationRequest(
          'PUT',
          'https://studio.test/api/v1/waste-management/tour-assignments/assignment-1',
          {
            tourId: 'tour-2',
            pickupDate: '2026-05-13',
            note: '  Zwei Halte  ',
            locationIds: ['location-3'],
          }
        ),
        actor,
        {
          ...createDeps(),
          saveWasteTourAssignment,
          loadWasteTourAssignmentById,
        }
      );

    expect(updateResponse.status).toBe(200);
    expect(saveWasteTourAssignment).toHaveBeenLastCalledWith('tenant-a', {
      id: 'assignment-1',
      tourId: 'tour-2',
      pickupDate: '2026-05-13',
      note: 'Zwei Halte',
      locationIds: ['location-3'],
    });

    const deleteResponse =
      await wasteManagementTourAssignmentHandlers.deleteWasteManagementTourAssignmentInternal(
        createWasteMutationRequest(
          'DELETE',
          'https://studio.test/api/v1/waste-management/tour-assignments/assignment-1'
        ),
        actor,
        {
          ...createDeps(),
          deleteWasteTourAssignment,
          loadWasteTourAssignmentById,
        }
      );

    expect(deleteResponse.status).toBe(200);
    expect(deleteWasteTourAssignment).toHaveBeenCalledWith('tenant-a', 'assignment-1');
  });

  it('rejects missing locations before persistence', async () => {
    const saveWasteTourAssignment = vi.fn(async () => undefined);
    const response =
      await wasteManagementTourAssignmentHandlers.createWasteManagementTourAssignmentInternal(
        createWasteMutationRequest(
          'POST',
          'https://studio.test/api/v1/waste-management/tour-assignments',
          {
            id: 'assignment-1',
            tourId: 'tour-1',
            pickupDate: '2026-05-12',
            locationIds: [],
          }
        ),
        actor,
        { ...createDeps(), saveWasteTourAssignment }
      );

    expect(response.status).toBe(400);
    expect(saveWasteTourAssignment).not.toHaveBeenCalled();
  });

  it('enforces scheduling permission and CSRF before persistence', async () => {
    const saveWasteTourAssignment = vi.fn(async () => undefined);
    const unauthorizedDeps = {
      ...createDeps(),
      ...grantWastePermissions(),
      saveWasteTourAssignment,
    };
    const body = JSON.stringify({
      id: 'assignment-1',
      tourId: 'tour-1',
      pickupDate: '2026-05-12',
      locationIds: ['location-1'],
    });

    const unauthorizedResponse =
      await wasteManagementTourAssignmentHandlers.createWasteManagementTourAssignmentInternal(
        new Request('https://studio.test/api/v1/waste-management/tour-assignments', {
          method: 'POST',
          headers: mutationHeaders,
          body,
        }),
        actor,
        unauthorizedDeps
      );
    expect(unauthorizedResponse.status).toBe(403);

    const csrfResponse =
      await wasteManagementTourAssignmentHandlers.createWasteManagementTourAssignmentInternal(
        new Request('https://studio.test/api/v1/waste-management/tour-assignments', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        }),
        actor,
        { ...createDeps(), saveWasteTourAssignment }
      );
    expect(csrfResponse.status).toBe(403);
    expect(saveWasteTourAssignment).not.toHaveBeenCalled();
  });

  it('returns not found without updating a missing assignment', async () => {
    const saveWasteTourAssignment = vi.fn(async () => undefined);
    const response =
      await wasteManagementTourAssignmentHandlers.updateWasteManagementTourAssignmentInternal(
        createWasteMutationRequest(
          'PUT',
          'https://studio.test/api/v1/waste-management/tour-assignments/missing',
          {
            tourId: 'tour-1',
            pickupDate: '2026-05-12',
            locationIds: ['location-1'],
          }
        ),
        actor,
        {
          ...createDeps(),
          saveWasteTourAssignment,
          loadWasteTourAssignmentById: vi.fn(async () => null),
        }
      );

    expect(response.status).toBe(404);
    expect(saveWasteTourAssignment).not.toHaveBeenCalled();
  });
});
