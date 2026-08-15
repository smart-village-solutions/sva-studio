import { describe, expect, it, vi } from 'vitest';

const runtimeContext = vi.hoisted(() => ({
  requestId: 'request-characterization',
  traceId: 'trace-characterization',
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: () => runtimeContext,
}));

import { runDsrMaintenance } from './dsr-maintenance.js';
import type { QueryClient } from './query-client.js';

describe('dsr-maintenance', () => {
  it('returns dry-run counts without mutating maintenance tables', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 2, rows: [{ id: 'job-1' }, { id: 'job-2' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'request-1', target_account_id: 'account-1' }] })
      .mockResolvedValueOnce({ rowCount: 3, rows: [{ id: 'account-1' }, { id: 'account-2' }, { id: 'account-3' }] })
      .mockResolvedValueOnce({ rowCount: 4, rows: [{ id: 'notification-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await expect(
      runDsrMaintenance({ query }, { instanceId: 'de-musterhausen', dryRun: true })
    ).resolves.toEqual({
      dryRun: true,
      queuedExports: 2,
      escalated: 1,
      finalizedDeletions: 3,
      recipientNotifications: 4,
    });

    expect(query).toHaveBeenCalledTimes(5);
    expect(query.mock.calls.at(-1)?.[0]).toContain('INSERT INTO iam.activity_logs');
  });

  it('counts queued export jobs but leaves their processing to the studio worker', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'job-1' }],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await runDsrMaintenance({ query }, { instanceId: 'de-musterhausen', dryRun: false });

    expect(result.queuedExports).toBe(1);
    expect(query.mock.calls.some(([text]) => typeof text === 'string' && text.includes("status = 'failed'"))).toBe(false);
  });

  it('persists escalation events and audits with stable tenant binding, context and ordering', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'request-1', target_account_id: 'account-1' }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await runDsrMaintenance({ query }, { instanceId: 'de-musterhausen', dryRun: false });

    expect(query.mock.calls[2]?.[0]).toContain("SET status = 'escalated'");
    expect(query.mock.calls[2]?.[1]).toEqual(['request-1']);
    expect(query.mock.calls[3]?.[0]).toContain('INSERT INTO iam.data_subject_request_events');
    expect(query.mock.calls[3]?.[1]).toEqual([
      'de-musterhausen',
      'request-1',
      null,
      'sla_escalated',
      JSON.stringify({ reason: 'soft_delete_not_completed_in_time' }),
    ]);
    expect(query.mock.calls[4]?.[0]).toContain('INSERT INTO iam.activity_logs');
    expect(query.mock.calls[4]?.[1]).toEqual([
      'de-musterhausen',
      'account-1',
      'dsr_deletion_sla_escalated',
      JSON.stringify({ request_id: 'request-1', result: 'failure' }),
      'request-characterization',
      'trace-characterization',
    ]);
    expect(query.mock.calls[7]?.[1]).toEqual([
      'de-musterhausen',
      null,
      'dsr_maintenance_executed',
      JSON.stringify({
        dry_run: false,
        queued_exports_processed: 0,
        escalated_requests: 1,
        finalized_deletions: 0,
        recipient_notifications_processed: 0,
        result: 'success',
      }),
      'request-characterization',
      'trace-characterization',
    ]);
  });

  it('does not issue a follow-up query when request-event persistence fails', async () => {
    const eventFailure = new Error('request_event_write_failed');
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'request-1', target_account_id: 'account-1' }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockRejectedValueOnce(eventFailure);

    await expect(
      runDsrMaintenance({ query }, { instanceId: 'de-musterhausen', dryRun: false })
    ).rejects.toBe(eventFailure);
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls.at(-1)?.[0]).toContain('INSERT INTO iam.data_subject_request_events');
  });
});
