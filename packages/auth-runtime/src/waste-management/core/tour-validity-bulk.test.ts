import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';

const updateWasteVisibleStatusMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('./settings-shared.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./settings-shared.js')>();
  return {
    ...actual,
    updateWasteVisibleStatus: updateWasteVisibleStatusMock,
  };
});

import { wasteManagementTourValidityBulkHandlers } from './tour-validity-bulk.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const createRequest = (body: Record<string, unknown>) =>
  new Request('https://studio.test/api/v1/waste-management/tours/bulk-validity', {
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
    permissions: [
      {
        action: 'waste-management.tours.manage',
        resourceType: 'waste-management',
      },
    ],
  })),
  emitAuditEvent: vi.fn(async () => undefined),
  updateWasteTourValidityBulk: vi.fn(async () => ({ updatedCount: 2 })),
});

describe('waste-management tour validity bulk handler', () => {
  beforeEach(() => {
    updateWasteVisibleStatusMock.mockClear();
  });

  it('updates selected tour validity and audits the affected count', async () => {
    const deps = createDeps();
    const response =
      await wasteManagementTourValidityBulkHandlers.updateWasteManagementTourValidityBulkInternal(
        createRequest({
          tourIds: [' tour-1 ', 'tour-2'],
          firstDate: { mode: 'set', value: '2026-02-01' },
          endDate: { mode: 'clear' },
        }),
        actor,
        deps
      );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { updatedCount: 2 } });
    expect(deps.updateWasteTourValidityBulk).toHaveBeenCalledWith('tenant-a', {
      tourIds: ['tour-1', 'tour-2'],
      firstDate: { mode: 'set', value: '2026-02-01' },
      endDate: { mode: 'clear' },
    });
    expect(deps.emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginAction: expect.objectContaining({
          actionId: 'waste-management.tour.validity-bulk-updated',
          result: 'success',
          resourceType: 'waste_tour_batch',
          resourceId: 'count:2',
        }),
      })
    );
    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(deps, 'tenant-a', 'success');
  });

  it('rejects duplicate ids and an unchanged request before persistence', async () => {
    const deps = createDeps();
    const duplicateResponse =
      await wasteManagementTourValidityBulkHandlers.updateWasteManagementTourValidityBulkInternal(
        createRequest({
          tourIds: ['tour-1', ' tour-1 '],
          firstDate: { mode: 'clear' },
          endDate: { mode: 'unchanged' },
        }),
        actor,
        deps
      );
    const unchangedResponse =
      await wasteManagementTourValidityBulkHandlers.updateWasteManagementTourValidityBulkInternal(
        createRequest({
          tourIds: ['tour-1'],
          firstDate: { mode: 'unchanged' },
          endDate: { mode: 'unchanged' },
        }),
        actor,
        deps
      );

    expect(duplicateResponse.status).toBe(400);
    expect(unchangedResponse.status).toBe(400);
    expect(deps.updateWasteTourValidityBulk).not.toHaveBeenCalled();
  });

  it.each([
    ['bulk_tour_validity_not_found:tour-2', 404, 'tour_not_found'],
    ['bulk_tour_validity_not_applicable:tour-2', 400, 'tour_validity_not_applicable'],
    ['bulk_tour_validity_invalid_range:tour-2', 400, 'invalid_validity_range'],
  ])('maps %s to a client error without revalidation', async (message, status, reasonCode) => {
    const deps = createDeps();
    deps.updateWasteTourValidityBulk.mockRejectedValueOnce(new Error(message));

    const response =
      await wasteManagementTourValidityBulkHandlers.updateWasteManagementTourValidityBulkInternal(
        createRequest({
          tourIds: ['tour-1', 'tour-2'],
          firstDate: { mode: 'unchanged' },
          endDate: { mode: 'set', value: '2026-12-31' },
        }),
        actor,
        deps
      );

    expect(response.status).toBe(status);
    expect(updateWasteVisibleStatusMock).not.toHaveBeenCalled();
    expect(
      deps.emitAuditEvent.mock.calls.some(
        ([event]) => event.pluginAction.reasonCode === reasonCode
      )
    ).toBe(true);
  });

  it('rolls back to the standard database error response on infrastructure failure', async () => {
    const deps = createDeps();
    deps.updateWasteTourValidityBulk.mockRejectedValueOnce(new Error('db down'));

    const response =
      await wasteManagementTourValidityBulkHandlers.updateWasteManagementTourValidityBulkInternal(
        createRequest({
          tourIds: ['tour-1'],
          firstDate: { mode: 'clear' },
          endDate: { mode: 'unchanged' },
        }),
        actor,
        deps
      );

    expect(response.status).toBe(503);
    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(deps, 'tenant-a', 'revalidate');
  });
});
