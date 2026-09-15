import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';

const updateWasteVisibleStatusMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('./settings-shared.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./settings-shared.js')>();
  return { ...actual, updateWasteVisibleStatus: updateWasteVisibleStatusMock };
});

import { wasteManagementTourStatusBulkHandlers } from './tour-status-bulk.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: { id: 'user-1', instanceId: 'tenant-a', roles: ['system_admin'] },
};

const tourIdOne = '11111111-1111-4111-8111-111111111111';
const tourIdTwo = '22222222-2222-4222-8222-222222222222';

const createRequest = (body: Record<string, unknown>) =>
  new Request('https://studio.test/api/v1/waste-management/tours/bulk-status', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://studio.test',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(body),
  });

const createDeps = () => ({
  getRequestId: () => 'req-test',
  resolvePermissions: vi.fn(async () => ({
    ok: true as const,
    permissions: [{ action: 'waste-management.tours.manage', resourceType: 'waste-management' }],
  })),
  emitAuditEvent: vi.fn(async () => undefined),
  updateWasteTourStatusBulk: vi.fn(async () => ({ updatedCount: 2 })),
});

describe('waste-management tour status bulk handler', () => {
  beforeEach(() => updateWasteVisibleStatusMock.mockClear());

  it('updates the desired status and audits count and target state', async () => {
    const deps = createDeps();
    const response =
      await wasteManagementTourStatusBulkHandlers.updateWasteManagementTourStatusBulkInternal(
        createRequest({ tourIds: [` ${tourIdOne} `, tourIdTwo], status: 'archived' }),
        actor,
        deps
      );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { updatedCount: 2 } });
    expect(deps.updateWasteTourStatusBulk).toHaveBeenCalledWith('tenant-a', {
      tourIds: [tourIdOne, tourIdTwo],
      status: 'archived',
    });
    expect(deps.emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginAction: expect.objectContaining({
          actionId: 'waste-management.tour.status-bulk-updated',
          result: 'success',
          resourceId: 'count:2;status:archived',
        }),
      })
    );
    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(deps, 'tenant-a', 'success');
  });

  it('rejects duplicate IDs and oversized requests before persistence', async () => {
    const deps = createDeps();
    const duplicateResponse =
      await wasteManagementTourStatusBulkHandlers.updateWasteManagementTourStatusBulkInternal(
        createRequest({ tourIds: [tourIdOne, ` ${tourIdOne} `], status: 'published' }),
        actor,
        deps
      );
    const oversizedResponse =
      await wasteManagementTourStatusBulkHandlers.updateWasteManagementTourStatusBulkInternal(
        createRequest({
          tourIds: Array.from(
            { length: 1_001 },
            (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
          ),
          status: 'published',
        }),
        actor,
        deps
      );

    expect(duplicateResponse.status).toBe(400);
    expect(oversizedResponse.status).toBe(400);
    expect(deps.updateWasteTourStatusBulk).not.toHaveBeenCalled();
  });

  it('rejects malformed tour IDs before they reach the UUID database cast', async () => {
    const deps = createDeps();
    const response =
      await wasteManagementTourStatusBulkHandlers.updateWasteManagementTourStatusBulkInternal(
        createRequest({ tourIds: ['not-a-uuid'], status: 'published' }),
        actor,
        deps
      );

    expect(response.status).toBe(400);
    expect(deps.updateWasteTourStatusBulk).not.toHaveBeenCalled();
  });

  it('maps a missing tour to 404 and keeps infrastructure errors fail closed', async () => {
    const missingDeps = createDeps();
    missingDeps.updateWasteTourStatusBulk.mockRejectedValueOnce(
      new Error(`bulk_tour_status_not_found:${tourIdTwo}`)
    );
    const missingResponse =
      await wasteManagementTourStatusBulkHandlers.updateWasteManagementTourStatusBulkInternal(
        createRequest({ tourIds: [tourIdOne, tourIdTwo], status: 'draft' }),
        actor,
        missingDeps
      );

    const failingDeps = createDeps();
    failingDeps.updateWasteTourStatusBulk.mockRejectedValueOnce(new Error('db down'));
    const failingResponse =
      await wasteManagementTourStatusBulkHandlers.updateWasteManagementTourStatusBulkInternal(
        createRequest({ tourIds: [tourIdOne], status: 'published' }),
        actor,
        failingDeps
      );

    expect(missingResponse.status).toBe(404);
    expect(failingResponse.status).toBe(503);
    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(
      failingDeps,
      'tenant-a',
      'revalidate'
    );
  });
});
