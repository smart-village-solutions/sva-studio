import { describe, expect, it, vi } from 'vitest';

import { enqueueContractJobs } from './graphile-worker-contract-jobs.js';

describe('graphile worker contract jobs', () => {
  it('proves both the normal job and delayed lifecycle retry allowlist entries', () => {
    const executeAsApp = vi.fn((_sql: string) => '');
    const queryAsWorker = vi.fn((_sql: string) => '1');

    enqueueContractJobs({ executeAsApp, queryAsWorker });

    expect(executeAsApp).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("'studio_job_execute'")
    );
    expect(executeAsApp).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("'plugin_tenant_lifecycle_retry'")
    );
    expect(executeAsApp.mock.calls[1]?.[0]).toContain("interval '1 day'");
    expect(queryAsWorker).toHaveBeenCalledTimes(2);
  });

  it('fails when the delayed retry is not visible to the worker', () => {
    expect(() =>
      enqueueContractJobs({
        executeAsApp: () => '',
        queryAsWorker: vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('0'),
      })
    ).toThrow('graphile_contract_lifecycle_retry_not_visible:0');
  });
});
