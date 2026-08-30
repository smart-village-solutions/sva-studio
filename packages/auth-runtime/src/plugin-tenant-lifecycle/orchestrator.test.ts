import { describe, expect, it, vi } from 'vitest';

import type { PluginTenantLifecycleRecord } from '@sva/data-repositories';
import type { PluginTenantLifecycleRegistryEntry } from '@sva/plugin-sdk';

import {
  createPluginTenantLifecycleOrchestrator,
  pluginTenantLifecycleHostErrorCodes,
} from './orchestrator.js';

const lifecycleDefinition: PluginTenantLifecycleRegistryEntry = {
  pluginId: 'speech',
  contractVersion: 1,
  operations: [{ operation: 'provision', jobTypeId: 'speech.provisionTenant' }],
  readinessChecks: [],
};
const lifecycleRecord: PluginTenantLifecycleRecord = {
  instanceId: 'tenant-a',
  pluginId: 'speech',
  accessState: 'active',
  readinessStatus: 'pending',
  desiredOperation: 'provision',
  desiredGeneration: 3,
  completedGeneration: 2,
  readinessChecks: [],
  requestedAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
};
const job = {
  id: '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
  instanceId: 'tenant-a',
  source: 'plugin' as const,
  pluginId: 'speech',
  jobTypeId: 'speech.provisionTenant',
  queueName: 'plugin-operations',
  status: 'queued' as const,
  inputPayload: {},
  attempts: 0,
  maxAttempts: 5,
  idempotencyKey: 'speech:provision:3',
  scheduledAt: '2026-08-30T12:00:00.000Z',
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
};

const createDependencies = () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  lifecycleRegistry: new Map([['speech', lifecycleDefinition]]),
  resolveActivation: vi.fn(async () => ({ effectiveActive: true })),
  repository: {
    requestLifecycle: vi.fn(async () => lifecycleRecord),
    claimLifecycle: vi.fn(async () => ({
      ...lifecycleRecord,
      claimedGeneration: 3,
      activeJobId: job.id,
    })),
    failLifecycle: vi.fn(async () => lifecycleRecord),
  },
  resolveJobRegistration: vi.fn(() => ({ queueName: 'plugin-operations' })),
  createJob: vi.fn(async () => job),
  queueJob: vi.fn(async () => undefined),
  markEnqueueFailed: vi.fn(async () => undefined),
});

const input = {
  instanceId: 'tenant-a',
  pluginId: 'speech',
  operation: 'provision' as const,
  actorAccountId: 'account-a',
  requestId: 'request-a',
  scheduledAt: '2026-08-30T12:00:00.000Z',
};

describe('plugin tenant lifecycle orchestrator', () => {
  it('requests, creates, claims and only then queues the declared lifecycle job', async () => {
    const dependencies = createDependencies();
    const orchestrator = createPluginTenantLifecycleOrchestrator(dependencies);

    await expect(orchestrator.start(input)).resolves.toEqual({
      lifecycle: expect.objectContaining({ claimedGeneration: 3, activeJobId: job.id }),
      job,
    });
    expect(dependencies.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobTypeId: 'speech.provisionTenant',
        operation: 'provision',
        generation: 3,
      })
    );
    expect(dependencies.repository.claimLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: job.id, generation: 3 })
    );
    expect(dependencies.queueJob).toHaveBeenCalledOnce();
  });

  it('rejects an inactive plugin before mutating lifecycle state', async () => {
    const dependencies = createDependencies();
    dependencies.resolveActivation.mockResolvedValue({ effectiveActive: false });

    await expect(
      createPluginTenantLifecycleOrchestrator(dependencies).start(input)
    ).rejects.toThrow(`${pluginTenantLifecycleHostErrorCodes.inactive}:speech`);
    expect(dependencies.repository.requestLifecycle).not.toHaveBeenCalled();
    expect(dependencies.createJob).not.toHaveBeenCalled();
  });

  it('rejects missing handlers before persisting a desired generation', async () => {
    const dependencies = createDependencies();
    dependencies.resolveJobRegistration.mockReturnValue(undefined);

    await expect(
      createPluginTenantLifecycleOrchestrator(dependencies).start(input)
    ).rejects.toThrow(`${pluginTenantLifecycleHostErrorCodes.handlerMissing}:speech:provision`);
    expect(dependencies.repository.requestLifecycle).not.toHaveBeenCalled();
  });

  it('rejects lifecycle cancellation when the registered handler cannot honour it', async () => {
    const dependencies = createDependencies();
    dependencies.lifecycleRegistry = new Map([
      [
        'speech',
        {
          ...lifecycleDefinition,
          operations: [
            {
              operation: 'provision' as const,
              jobTypeId: 'speech.provisionTenant',
              supportsCancellation: true,
            },
          ],
        },
      ],
    ]);

    await expect(
      createPluginTenantLifecycleOrchestrator(dependencies).start(input)
    ).rejects.toThrow(
      `${pluginTenantLifecycleHostErrorCodes.cancellationMismatch}:speech:provision`
    );
    expect(dependencies.repository.requestLifecycle).not.toHaveBeenCalled();
  });

  it('rejects undeclared cancellation even when the registered handler supports it', async () => {
    const dependencies = createDependencies();
    dependencies.resolveJobRegistration.mockReturnValue({
      queueName: 'plugin-operations',
      supportsCancellation: true,
    });

    await expect(
      createPluginTenantLifecycleOrchestrator(dependencies).start(input)
    ).rejects.toThrow(
      `${pluginTenantLifecycleHostErrorCodes.cancellationMismatch}:speech:provision`
    );
    expect(dependencies.repository.requestLifecycle).not.toHaveBeenCalled();
  });

  it('persists a retryable blocked state when queueing fails', async () => {
    const dependencies = createDependencies();
    dependencies.queueJob.mockRejectedValue(new Error('queue unavailable'));

    await expect(
      createPluginTenantLifecycleOrchestrator(dependencies).start(input)
    ).rejects.toThrow(`${pluginTenantLifecycleHostErrorCodes.enqueueFailed}:speech:provision`);
    expect(dependencies.markEnqueueFailed).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      job,
    });
    expect(dependencies.repository.failLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: job.id,
        generation: 3,
        readinessStatus: 'blocked',
        retryKind: 'retryable',
      })
    );
  });

  it('logs secondary persistence failures after queueing fails', async () => {
    const dependencies = createDependencies();
    dependencies.queueJob.mockRejectedValue(new Error('queue unavailable'));
    dependencies.markEnqueueFailed.mockRejectedValue(new TypeError('job update unavailable'));
    dependencies.repository.failLifecycle.mockRejectedValue(new Error('lifecycle unavailable'));

    await expect(
      createPluginTenantLifecycleOrchestrator(dependencies).start(input)
    ).rejects.toThrow(`${pluginTenantLifecycleHostErrorCodes.enqueueFailed}:speech:provision`);
    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'Plugin-Tenant-Lifecycle konnte einen Enqueue-Fehler nicht vollständig persistieren',
      expect.objectContaining({
        operation: 'plugin_tenant_lifecycle_enqueue_cleanup',
        result: 'secondary_failure',
        error_code: 'plugin_tenant_lifecycle_enqueue_cleanup_failed',
        instance_id: 'tenant-a',
        plugin_id: 'speech',
        job_id: job.id,
        mark_enqueue_failed_error_type: 'TypeError',
        fail_lifecycle_error_type: 'Error',
      })
    );
  });
});
