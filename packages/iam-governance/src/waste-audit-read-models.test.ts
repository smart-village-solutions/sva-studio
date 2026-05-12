import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  listWasteManagementAuditRecords,
  listWasteManagementTechnicalAuditRecords,
} from './waste-audit-read-models.js';

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

    expect(client.query).toHaveBeenNthCalledWith(1, expect.any(String), ['tenant-a', null, '%fraction%', 10, 10]);
    expect(client.query).toHaveBeenNthCalledWith(2, expect.any(String), ['tenant-a', null, '%fraction%']);
  });

  it('maps the technical waste audit subset into the technical history shape', async () => {
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
              action_id: 'waste-management.connection-check.failed',
              action_namespace: 'waste-management',
              reason_code: 'connection_failed',
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
              action_id: 'waste-management.import.started',
              action_namespace: 'waste-management',
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

    const result = await listWasteManagementTechnicalAuditRecords(client as never, {
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'log-2',
        eventType: 'connection-check.failed',
        outcome: 'failure',
        errorCode: 'connection_failed',
      }),
      expect.objectContaining({
        id: 'log-1',
        eventType: 'import.started',
        outcome: 'started',
      }),
    ]);
  });

  it('prefers payload outcome fallbacks and maps denied or default audit outcomes deterministically', async () => {
    const client = buildClient(
      {
        rowCount: 3,
        rows: [
          {
            id: 'log-denied',
            event_type: 'plugin_action_denied',
            created_at: '2026-05-09T12:06:00.000Z',
            account_id: null,
            request_id: null,
            trace_id: null,
            payload: {
              action_id: '',
              outcome: 'denied',
              resource_type: '',
              resource_id: '',
              reason_code: '',
            },
          },
          {
            id: 'log-fallback',
            event_type: 'plugin_action_failed',
            created_at: '2026-05-09T12:07:00.000Z',
            account_id: null,
            request_id: null,
            trace_id: null,
            payload: {
              action_id: 'waste-management.custom.action',
              outcome: 'failure',
            },
          },
          {
            id: 'log-default',
            event_type: 'plugin_action_authorized',
            created_at: '2026-05-09T12:08:00.000Z',
            account_id: null,
            request_id: null,
            trace_id: null,
            payload: {},
          },
        ],
      },
      {
        rowCount: 1,
        rows: [{ total: 3 }],
      }
    );

    const result = await listWasteManagementAuditRecords(client as never, {
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 20,
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'log-denied',
        actionId: 'plugin_action_denied',
        outcome: 'denied',
        actorAccountId: undefined,
        resourceType: undefined,
        resourceId: undefined,
        reasonCode: undefined,
      }),
      expect.objectContaining({
        id: 'log-fallback',
        outcome: 'failure',
      }),
      expect.objectContaining({
        id: 'log-default',
        actionId: 'plugin_action_authorized',
        outcome: 'success',
      }),
    ]);
  });

  it('filters unknown technical audit actions and maps success outcomes for succeeded events', async () => {
    const client = buildClient(
      {
        rowCount: 3,
        rows: [
          {
            id: 'log-success',
            event_type: 'plugin_action_authorized',
            created_at: '2026-05-09T12:00:00.000Z',
            account_id: 'account-1',
            request_id: 'req-1',
            trace_id: 'trace-1',
            payload: {
              action_id: 'waste-management.connection-check.succeeded',
            },
          },
          {
            id: 'log-ignored',
            event_type: 'plugin_action_authorized',
            created_at: '2026-05-09T12:01:00.000Z',
            account_id: 'account-2',
            request_id: 'req-2',
            trace_id: 'trace-2',
            payload: {
              action_id: 'waste-management.unknown.action',
            },
          },
          {
            id: 'log-missing',
            event_type: 'plugin_action_authorized',
            created_at: '2026-05-09T12:02:00.000Z',
            account_id: 'account-3',
            request_id: 'req-3',
            trace_id: 'trace-3',
            payload: {},
          },
        ],
      },
      {
        rowCount: 1,
        rows: [{ total: 3 }],
      }
    );

    const result = await listWasteManagementTechnicalAuditRecords(client as never, {
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(3);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'log-success',
        eventType: 'connection-check.succeeded',
        outcome: 'success',
      }),
    ]);
  });

  it('falls back to event_type-derived audit outcomes and preserves started technical events without request metadata', async () => {
    const auditClient = buildClient(
      {
        rowCount: 2,
        rows: [
          {
            id: 'log-denied-fallback',
            event_type: 'plugin_action_denied',
            created_at: '2026-05-09T12:10:00.000Z',
            account_id: null,
            request_id: null,
            trace_id: null,
            payload: {},
          },
          {
            id: 'log-failed-fallback',
            event_type: 'plugin_action_failed',
            created_at: '2026-05-09T12:11:00.000Z',
            account_id: null,
            request_id: null,
            trace_id: null,
            payload: {},
          },
        ],
      },
      {
        rowCount: 1,
        rows: [{ total: 1 }],
      }
    );

    const auditResult = await listWasteManagementAuditRecords(auditClient as never, {
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 20,
    });

    expect(auditResult.items).toEqual([
      expect.objectContaining({ id: 'log-denied-fallback', outcome: 'denied' }),
      expect.objectContaining({ id: 'log-failed-fallback', outcome: 'failure' }),
    ]);

    const technicalClient = buildClient(
      {
        rowCount: 2,
        rows: [
          {
            id: 'log-started',
            event_type: 'plugin_action_authorized',
            created_at: '2026-05-09T12:12:00.000Z',
            account_id: null,
            request_id: null,
            trace_id: null,
            payload: {
              action_id: 'waste-management.datasource.reconfigured',
              reason_code: '',
            },
          },
          {
            id: 'log-initialize-started',
            event_type: 'plugin_action_authorized',
            created_at: '2026-05-09T12:13:00.000Z',
            account_id: null,
            request_id: null,
            trace_id: null,
            payload: {
              action_id: 'waste-management.initialize.started',
            },
          },
        ],
      },
      {
        rowCount: 1,
        rows: [{ total: 1 }],
      }
    );

    const technicalResult = await listWasteManagementTechnicalAuditRecords(technicalClient as never, {
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 20,
    });

    expect(technicalResult.items).toEqual([
      expect.objectContaining({
        id: 'log-started',
        eventType: 'datasource.reconfigured',
        outcome: 'started',
        requestId: undefined,
        traceId: undefined,
        errorCode: undefined,
      }),
    ]);
    expect(technicalResult.total).toBe(1);
  });
});
