import { describe, expect, it, vi } from 'vitest';

import { SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID } from '../src/plugin.js';
import { createPluginJobExecutionHandlers } from '../src/server.js';

describe('SSF authorization lifecycle job', () => {
  it('publishes the confirmed authorization revision to the tenant lifecycle', async () => {
    const reconcile = vi.fn().mockResolvedValue({
      status: 'ready',
      authorizationRevision: 'sha256:confirmed',
      generation: 3,
      changed: true,
    });
    const handler = createPluginJobExecutionHandlers({ reconcile })[
      SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID
    ];

    await expect(
      handler?.({
        job: { instanceId: 'tenant-a' },
        tenantLifecycle: { operation: 'reconcile', generation: 3 },
        throwIfCancellationRequested: vi.fn(),
      } as never)
    ).resolves.toMatchObject({
      resultPayload: {
        plugin: { operation: 'reconcile-authorization', changed: true, generation: 3 },
      },
      tenantLifecycle: { revision: 'sha256:confirmed', checks: [] },
    });
    expect(reconcile).toHaveBeenCalledWith('tenant-a');
  });

  it('keeps non-ready projections in the lifecycle retry path', async () => {
    const handler = createPluginJobExecutionHandlers({
      reconcile: vi.fn().mockResolvedValue({ status: 'blocked', generation: 4 }),
    })[SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID];

    const execution = expect(
      handler?.({
        job: { instanceId: 'tenant-a' },
        tenantLifecycle: { operation: 'reconcile', generation: 4 },
        throwIfCancellationRequested: vi.fn(),
      } as never)
    ).rejects;
    await execution.toThrow('ssf_authorization_reconcile_blocked');
    await execution.toMatchObject({
      cause: {
        code: 'ssf.authorization-reconcile-unavailable',
        retry: { kind: 'retryable' },
      },
    });
  });
});
