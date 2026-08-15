import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeContext = vi.hoisted<{
  requestId?: string;
  traceId?: string;
}>(() => ({}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: () => runtimeContext,
}));

import {
  appendDsrRequestEvent,
  emitDsrAuditEvent,
  isDsrLegalHoldActive,
} from './dsr-persistence.js';
import type { QueryClient } from './query-client.js';

describe('dsr-persistence', () => {
  beforeEach(() => {
    delete runtimeContext.requestId;
    delete runtimeContext.traceId;
  });

  it.each([
    ['active', 1, true],
    ['inactive', 0, false],
    ['expired', 0, false],
    ['foreign-instance', 0, false],
  ] as const)('maps a %s legal hold result without weakening its SQL scope', async (_case, rowCount, expected) => {
    const query = vi.fn<QueryClient['query']>().mockResolvedValueOnce({
      rowCount,
      rows: rowCount === 1 ? [{ id: 'hold-1' }] : [],
    });

    await expect(
      isDsrLegalHoldActive({ query }, { instanceId: 'de-musterhausen', accountId: 'account-1' })
    ).resolves.toBe(expected);
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(
        /WHERE instance_id = \$1[\s\S]*account_id = \$2::uuid[\s\S]*active = true[\s\S]*hold_until IS NULL OR hold_until > NOW\(\)/
      ),
      ['de-musterhausen', 'account-1']
    );
  });

  it.each([
    ['with account and context', 'account-1', 'request-1', 'trace-1'],
    ['without account or context', undefined, undefined, undefined],
  ] as const)('persists an audit event %s', async (_case, accountId, requestId, traceId) => {
    runtimeContext.requestId = requestId;
    runtimeContext.traceId = traceId;
    const query = vi.fn<QueryClient['query']>().mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await emitDsrAuditEvent(
      { query },
      {
        instanceId: 'de-musterhausen',
        ...(accountId ? { accountId } : {}),
        eventType: 'dsr_tested',
        payload: { result: 'success' },
      }
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO iam.activity_logs'), [
      'de-musterhausen',
      accountId ?? null,
      'dsr_tested',
      JSON.stringify({ result: 'success' }),
      requestId ?? null,
      traceId ?? null,
    ]);
  });

  it.each([
    ['with actor and payload', 'account-1', { reason: 'deadline' }],
    ['without actor or payload', undefined, undefined],
  ] as const)('persists a request event %s', async (_case, actorAccountId, payload) => {
    const query = vi.fn<QueryClient['query']>().mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await appendDsrRequestEvent(
      { query },
      {
        instanceId: 'de-musterhausen',
        requestId: 'request-1',
        ...(actorAccountId ? { actorAccountId } : {}),
        eventType: 'request_tested',
        ...(payload ? { payload } : {}),
      }
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO iam.data_subject_request_events'),
      [
        'de-musterhausen',
        'request-1',
        actorAccountId ?? null,
        'request_tested',
        JSON.stringify(payload ?? {}),
      ]
    );
  });

  it('propagates a query failure without issuing another query', async () => {
    const failure = new Error('query_failed');
    const query = vi.fn<QueryClient['query']>().mockRejectedValueOnce(failure);

    await expect(
      emitDsrAuditEvent(
        { query },
        { instanceId: 'de-musterhausen', eventType: 'dsr_failed', payload: {} }
      )
    ).rejects.toBe(failure);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
