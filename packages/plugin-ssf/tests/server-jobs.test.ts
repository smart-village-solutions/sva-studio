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
    const handler = createPluginJobExecutionHandlers({ reconcile, readiness: vi.fn() })[
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
      tenantLifecycle: {
        revision: 'sha256:confirmed',
        checks: [{ checkId: 'ssf.loginReady', status: 'ready' }],
      },
    });
    expect(reconcile).toHaveBeenCalledWith('tenant-a');
  });

  it('keeps non-ready projections in the lifecycle retry path', async () => {
    const handler = createPluginJobExecutionHandlers({
      readiness: vi.fn(),
      reconcile: vi.fn().mockResolvedValue({
        status: 'blocked',
        generation: 4,
        reason: 'target_readback_failed',
      }),
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
        details: { reason: 'target_readback_failed' },
      },
    });
  });

  it('classifies runtime failures as retryable', async () => {
    const handler = createPluginJobExecutionHandlers({
      readiness: vi.fn(),
      reconcile: vi.fn().mockRejectedValue(new Error('database unavailable')),
    })[SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID];

    await expect(
      handler?.({
        job: { instanceId: 'tenant-a' },
        tenantLifecycle: { operation: 'reconcile', generation: 4 },
        throwIfCancellationRequested: vi.fn(),
      } as never)
    ).rejects.toMatchObject({
      cause: {
        retry: { kind: 'retryable' },
        details: { errorType: 'Error' },
      },
    });
  });

  it('classifies an invalid lifecycle invocation as terminal', async () => {
    const handler = createPluginJobExecutionHandlers({ reconcile: vi.fn(), readiness: vi.fn() })[
      SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID
    ];

    await expect(
      handler?.({
        job: { instanceId: 'tenant-a' },
        tenantLifecycle: { operation: 'suspend', generation: 4 },
        throwIfCancellationRequested: vi.fn(),
      } as never)
    ).rejects.toMatchObject({ cause: { retry: { kind: 'terminal' } } });
  });
});

it.each([null, 'sha256:confirmed'])(
  'runs the readiness operation without provisioning for revision %s',
  async (revision) => {
    const reconcile = vi.fn();
    const readiness = vi.fn().mockResolvedValue(revision);
    const handler = createPluginJobExecutionHandlers({ reconcile, readiness })[
      SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID
    ];
    expect(
      await handler?.({
        job: { instanceId: 'tenant-a' },
        tenantLifecycle: { operation: 'readiness' },
        throwIfCancellationRequested: vi.fn(),
      } as never)
    ).toMatchObject({
      tenantLifecycle: {
        revision: revision ?? 'ssf:not-ready',
        checks: [{ checkId: 'ssf.loginReady', status: revision ? 'ready' : 'blocked' }],
      },
    });
    expect(readiness).toHaveBeenCalledWith('tenant-a');
    expect(reconcile).not.toHaveBeenCalled();
  }
);

it('classifies readiness runtime failures as retryable plugin failures', async () => {
  const handler = createPluginJobExecutionHandlers({
    reconcile: vi.fn(),
    readiness: vi.fn().mockRejectedValue(new TypeError('keycloak unavailable')),
  })[SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID];

  await expect(
    handler?.({
      job: { instanceId: 'tenant-a' },
      tenantLifecycle: { operation: 'readiness' },
      throwIfCancellationRequested: vi.fn(),
    } as never)
  ).rejects.toMatchObject({
    cause: {
      code: 'ssf.authorization-readiness-unavailable',
      retry: { kind: 'retryable' },
      details: { errorType: 'TypeError' },
    },
  });
});
