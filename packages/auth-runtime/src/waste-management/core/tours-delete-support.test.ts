import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerInfoMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());
const buildLogContextMock = vi.hoisted(() => vi.fn(() => ({ request_id: 'req-ctx', trace_id: 'trace-ctx' })));
const emitWasteAuditEventMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateWasteVisibleStatusMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    error: loggerErrorMock,
    info: loggerInfoMock,
  }),
}));

vi.mock('../../log-context.js', () => ({
  buildLogContext: buildLogContextMock,
}));

vi.mock('./auth.js', () => ({
  emitWasteAuditEvent: emitWasteAuditEventMock,
}));

vi.mock('./settings-shared.js', () => ({
  updateWasteVisibleStatus: updateWasteVisibleStatusMock,
}));

import {
  createWasteTourDeleteErrorResponse,
  logWasteTourDeleteFinalDelete,
  logWasteTourDeleteLoaded,
  logWasteTourDeleteRequested,
} from './tours-delete-support.js';

describe('waste tour delete support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs delete request, loaded state, and final delete phases with instance log context', () => {
    const request = new Request('https://studio.test/api/v1/waste-management/tours/tour-1', {
      method: 'DELETE',
    });

    logWasteTourDeleteRequested(request, 'tenant-a', 'tour-1');
    logWasteTourDeleteLoaded('tenant-a', 'tour-1', {
      locationCount: 2,
      name: 'Restmuell',
      recurrence: 'weekly',
      wasteFractionIds: ['fraction-1'],
    });
    logWasteTourDeleteFinalDelete('tenant-a', 'tour-1', 'started');
    logWasteTourDeleteFinalDelete('tenant-a', 'tour-1', 'completed');

    expect(loggerInfoMock).toHaveBeenNthCalledWith(
      1,
      'waste_tour_delete_requested',
      expect.objectContaining({
        operation: 'delete_waste_tour',
        request_method: 'DELETE',
        request_url: request.url,
        tour_id: 'tour-1',
      })
    );
    expect(loggerInfoMock).toHaveBeenNthCalledWith(
      2,
      'waste_tour_delete_existing_loaded',
      expect.objectContaining({
        location_count: 2,
        recurrence: 'weekly',
        tour_id: 'tour-1',
        tour_name: 'Restmuell',
        waste_fraction_ids: ['fraction-1'],
      })
    );
    expect(loggerInfoMock).toHaveBeenNthCalledWith(
      3,
      'waste_tour_delete_final_delete_started',
      expect.objectContaining({ tour_id: 'tour-1' })
    );
    expect(loggerInfoMock).toHaveBeenNthCalledWith(
      4,
      'waste_tour_delete_final_delete_completed',
      expect.objectContaining({ tour_id: 'tour-1' })
    );
    expect(buildLogContextMock).toHaveBeenCalledTimes(4);
  });

  it('maps foreign-key conflicts to a 409 response and failure audit event', async () => {
    const response = await createWasteTourDeleteErrorResponse({
      ctx: {
        user: {
          displayName: 'Ada Admin',
          email: 'ada@example.test',
          id: 'user-1',
        },
      } as never,
      deps: {} as never,
      error: {
        code: '23503',
        constraint: 'waste_location_tour_links_tour_id_fkey',
        detail: 'still referenced',
        name: 'DatabaseError',
        table: 'waste_location_tour_links',
      },
      instanceId: 'tenant-a',
      requestId: 'request-1',
      tourId: 'tour-1',
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: 'Die Waste-Tour kann wegen bestehender Zuordnungen nicht gelöscht werden.',
      },
      requestId: 'request-1',
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'waste_tour_delete_failed',
      expect.objectContaining({
        error_code: '23503',
        error_constraint: 'waste_location_tour_links_tour_id_fkey',
        error_detail: 'still referenced',
        error_table: 'waste_location_tour_links',
        is_conflict: true,
        tour_id: 'tour-1',
      })
    );
    expect(emitWasteAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'waste-management.tour.deleted',
        instanceId: 'tenant-a',
        reasonCode: 'conflict',
        resourceId: 'tour-1',
        resourceType: 'waste_tour',
        result: 'failure',
      })
    );
    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith({}, 'tenant-a', 'revalidate');
  });

  it('maps generic delete errors to a 503 response and database_unavailable audit reason', async () => {
    const response = await createWasteTourDeleteErrorResponse({
      ctx: {
        user: {
          displayName: 'Ada Admin',
          email: 'ada@example.test',
          id: 'user-1',
        },
      } as never,
      deps: {} as never,
      error: new Error('db offline'),
      instanceId: 'tenant-a',
      requestId: 'request-2',
      tourId: 'tour-2',
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: 'Die Waste-Tour konnte nicht gelöscht werden.',
      },
      requestId: 'request-2',
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'waste_tour_delete_failed',
      expect.objectContaining({
        error_message: 'db offline',
        error_type: 'Error',
        is_conflict: false,
        tour_id: 'tour-2',
      })
    );
    expect(emitWasteAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: 'database_unavailable',
        resourceId: 'tour-2',
        result: 'failure',
      })
    );
  });
});
