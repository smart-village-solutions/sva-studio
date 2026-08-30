import { describe, expect, it, vi } from 'vitest';

import type { StudioJobRecord } from '@sva/core';
import type {
  PluginTenantLifecycleRecord,
  PluginTenantLifecycleRepository,
} from '@sva/data-repositories';
import type { PluginTenantLifecycleRegistryEntry } from '@sva/plugin-sdk';

import {
  createPluginTenantLifecycleJobCorrelation,
  pluginTenantLifecycleJobInputKey,
} from './job-correlation.js';

const definition: PluginTenantLifecycleRegistryEntry = {
  pluginId: 'speech',
  contractVersion: 1,
  operations: [{ operation: 'provision', jobTypeId: 'speech.provisionTenant' }],
  readinessChecks: [
    { checkId: 'speech.realm', titleKey: 'speech.readiness.realm', required: true },
    { checkId: 'speech.branding', titleKey: 'speech.readiness.branding', required: false },
  ],
};

const job: StudioJobRecord = {
  id: '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
  instanceId: 'tenant-a',
  source: 'plugin',
  pluginId: 'speech',
  jobTypeId: 'speech.provisionTenant',
  queueName: 'plugin-operations',
  status: 'running',
  inputPayload: {
    [pluginTenantLifecycleJobInputKey]: { operation: 'provision', generation: 3 },
  },
  attempts: 1,
  maxAttempts: 5,
  idempotencyKey: 'speech:tenant-lifecycle:provision:3',
  scheduledAt: '2026-08-30T12:00:00.000Z',
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
};

const currentLifecycle = (completedGeneration: number): PluginTenantLifecycleRecord => ({
  instanceId: 'tenant-a',
  pluginId: 'speech',
  accessState: 'active',
  readinessStatus: 'ready',
  desiredOperation: 'provision',
  desiredGeneration: completedGeneration,
  completedGeneration,
  readinessChecks: [],
  requestedAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
});

const createDependencies = () => {
  const repository = {
    completeLifecycle: vi.fn(async () => currentLifecycle(3)),
    getLifecycle: vi.fn(async () => currentLifecycle(3)),
    failLifecycle: vi.fn(async () => currentLifecycle(3)),
  };
  return {
    repository,
    dependencies: {
      lifecycleRegistry: new Map([['speech', definition]]),
      withRepository: async <T>(
        _instanceId: string,
        work: (value: PluginTenantLifecycleRepository) => Promise<T>
      ) => work(repository as unknown as PluginTenantLifecycleRepository),
      now: () => '2026-08-30T12:05:00.000Z',
    },
  };
};

describe('plugin tenant lifecycle job correlation', () => {
  it('validates readiness evidence and completes the exact claimed generation', async () => {
    const { dependencies, repository } = createDependencies();

    await createPluginTenantLifecycleJobCorrelation(dependencies).complete({
      job,
      result: {
        tenantLifecycle: {
          revision: 'realm-v3',
          checks: [
            { checkId: 'speech.realm', status: 'ready' },
            { checkId: 'speech.branding', status: 'blocked' },
          ],
        },
      },
    });

    expect(repository.completeLifecycle).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      pluginId: 'speech',
      jobId: job.id,
      generation: 3,
      operation: 'provision',
      readinessStatus: 'degraded',
      readinessRevision: 'realm-v3',
      readinessChecks: [
        { checkId: 'speech.realm', status: 'ready' },
        { checkId: 'speech.branding', status: 'blocked' },
      ],
    });
  });

  it('rejects a stale completion instead of overwriting a newer generation', async () => {
    const { dependencies, repository } = createDependencies();
    repository.completeLifecycle.mockResolvedValueOnce(null);
    repository.getLifecycle.mockResolvedValueOnce(currentLifecycle(4));

    await expect(
      createPluginTenantLifecycleJobCorrelation(dependencies).complete({
        job,
        result: {
          tenantLifecycle: {
            revision: 'realm-v3',
            checks: [
              { checkId: 'speech.realm', status: 'ready' },
              { checkId: 'speech.branding', status: 'ready' },
            ],
          },
        },
      })
    ).rejects.toThrow('plugin_tenant_lifecycle_completion_stale');
  });

  it('accepts a repeated completion of the already persisted generation', async () => {
    const { dependencies, repository } = createDependencies();
    repository.completeLifecycle.mockResolvedValueOnce(null);

    await expect(
      createPluginTenantLifecycleJobCorrelation(dependencies).complete({
        job,
        result: {
          tenantLifecycle: {
            revision: 'realm-v3',
            checks: [
              { checkId: 'speech.realm', status: 'ready' },
              { checkId: 'speech.branding', status: 'ready' },
            ],
          },
        },
      })
    ).resolves.toBeUndefined();
  });

  it('classifies invalid plugin readiness evidence as a permanent contract error', async () => {
    const { dependencies } = createDependencies();

    await expect(
      createPluginTenantLifecycleJobCorrelation(dependencies).complete({
        job,
        result: {
          tenantLifecycle: {
            revision: 'realm-v3',
            checks: [{ checkId: 'speech.realm', status: 'ready' }],
          },
        },
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('plugin_tenant_lifecycle_result_invalid'),
      cause: { category: 'permanent' },
    });
  });

  it('persists terminal lifecycle failures without touching ordinary plugin jobs', async () => {
    const { dependencies, repository } = createDependencies();
    const correlation = createPluginTenantLifecycleJobCorrelation(dependencies);

    await correlation.fail({
      job,
      error: { code: 'plugin_operation_handler_missing', category: 'permanent' },
      reason: 'missing_handler',
    });
    await correlation.fail({
      job: { ...job, inputPayload: {} },
      error: { code: 'plugin_operation_execution_failed', category: 'permanent' },
      reason: 'failed',
    });

    expect(repository.failLifecycle).toHaveBeenCalledOnce();
    expect(repository.failLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        generation: 3,
        readinessStatus: 'blocked',
        errorCode: 'plugin_operation_handler_missing',
      })
    );
  });

  it('clears a terminal lifecycle claim after its live contract was removed', async () => {
    const { dependencies, repository } = createDependencies();
    dependencies.lifecycleRegistry = new Map();

    await createPluginTenantLifecycleJobCorrelation(dependencies).fail({
      job,
      error: { code: 'plugin_operation_handler_missing', category: 'permanent' },
      reason: 'missing_handler',
    });

    expect(repository.failLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'speech',
        jobId: job.id,
        generation: 3,
      })
    );
  });

  it('preserves a validated plugin retry classification and deadline', async () => {
    const { dependencies, repository } = createDependencies();

    await createPluginTenantLifecycleJobCorrelation(dependencies).fail({
      job,
      error: {
        code: 'plugin_operation_execution_failed',
        category: 'permanent',
        details: {
          plugin: {
            code: 'speech.databaseUnavailable',
            messageKey: 'speech.errors.databaseUnavailable',
            retry: { kind: 'retryable', retryAfterMs: 5_000 },
          },
        },
      },
      reason: 'failed',
    });

    expect(repository.failLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        readinessStatus: 'degraded',
        errorCode: 'speech.databaseUnavailable',
        retryKind: 'retryable',
        retryAfter: '2026-08-30T12:05:05.000Z',
      })
    );
  });

  it('fails closed when plugin lifecycle error metadata is invalid', async () => {
    const { dependencies, repository } = createDependencies();

    await createPluginTenantLifecycleJobCorrelation(dependencies).fail({
      job,
      error: {
        code: 'plugin_operation_execution_failed',
        category: 'permanent',
        details: {
          plugin: {
            code: 'foreign.databaseUnavailable',
            messageKey: 'speech.errors.databaseUnavailable',
            retry: { kind: 'retryable' },
          },
        },
      },
      reason: 'failed',
    });

    expect(repository.failLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        readinessStatus: 'blocked',
        errorCode: 'plugin_operation_execution_failed',
        retryKind: 'terminal',
      })
    );
  });
});
