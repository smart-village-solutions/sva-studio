import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listWasteManagementAuditRecords } from './waste-audit-read-models.js';

type QueryResult = {
  rowCount: number;
  rows: unknown[];
};

const buildClient = (...results: QueryResult[]) => ({
  query: vi.fn(async () => results.shift() ?? { rowCount: 0, rows: [] }),
});

describe('iam-governance/waste-audit-read-models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps waste audit activity logs into the central overview shape', async () => {
    const client = buildClient(
      {
        rowCount: 2,
        rows: [
          {
            id: 'log-2',
            event_type: 'plugin_action_failed',
            created_at: '2026-05-09T12:05:00.000Z',
            account_id: 'account-2',
            request_id: 'req-2',
            trace_id: 'trace-2',
            payload: {
              action_id: 'waste-management.reset.started',
              action_namespace: 'waste-management',
              reason_code: 'invalid_request',
              result: 'failure',
            },
          },
          {
            id: 'log-1',
            event_type: 'plugin_action_authorized',
            created_at: '2026-05-09T12:00:00.000Z',
            account_id: 'account-1',
            request_id: 'req-1',
            trace_id: 'trace-1',
            payload: {
              action_id: 'waste-management.fraction.created',
              action_namespace: 'waste-management',
              resource_type: 'waste_fraction',
              resource_id: 'fraction-1',
              result: 'success',
            },
          },
        ],
      },
      {
        rowCount: 1,
        rows: [{ total: 2 }],
      }
    );

    const result = await listWasteManagementAuditRecords(client as never, {
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'log-2',
        actionId: 'waste-management.reset.started',
        outcome: 'failure',
        reasonCode: 'invalid_request',
      }),
      expect.objectContaining({
        id: 'log-1',
        actionId: 'waste-management.fraction.created',
        outcome: 'success',
        resourceType: 'waste_fraction',
        resourceId: 'fraction-1',
      }),
    ]);
  });

  it('forwards the search term to both central audit queries', async () => {
    const client = buildClient(
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ total: 0 }] }
    );

    await listWasteManagementAuditRecords(client as never, {
      instanceId: 'tenant-a',
      search: 'fraction',
      page: 2,
      pageSize: 10,
    });

    expect(client.query).toHaveBeenNthCalledWith(1, expect.any(String), ['tenant-a', '%fraction%', 10, 10]);
    expect(client.query).toHaveBeenNthCalledWith(2, expect.any(String), ['tenant-a', '%fraction%']);
  });
});
