import { describe, expect, it, vi } from 'vitest';

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

  it('marks queued export jobs as failed when the target account cannot be resolved', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'job-1', target_account_id: 'account-missing', format: 'json' }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await runDsrMaintenance({ query }, { instanceId: 'de-musterhausen', dryRun: false });

    expect(result.queuedExports).toBe(1);
    expect(query.mock.calls[3]?.[0]).toContain("status = 'failed'");
    expect(query.mock.calls[3]?.[1]).toEqual(['job-1', 'target_account_not_found']);
  });
});
