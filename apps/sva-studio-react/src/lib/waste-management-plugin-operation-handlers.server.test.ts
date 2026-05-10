import { describe, expect, it, vi } from 'vitest';

import type { PluginOperationExecutionHandlerContext } from '@sva/auth-runtime/server';
import { wasteManagementOperationsContract } from '@sva/core';

import { createWasteManagementPluginOperationExecutionHandlers } from './waste-management-plugin-operation-handlers.server';

const createContext = (input: {
  readonly jobTypeId: string;
  readonly inputPayload: Record<string, unknown>;
}): PluginOperationExecutionHandlerContext => ({
  job: {
    id: 'job-1',
    instanceId: 'instance-1',
    pluginId: 'waste-management',
    jobTypeId: input.jobTypeId,
    queueName: 'plugin-operations',
    status: 'running',
    inputPayload: input.inputPayload,
    attempts: 1,
    maxAttempts: 3,
    idempotencyKey: 'idem-1',
    scheduledAt: '2026-05-09T12:00:00.000Z',
    createdAt: '2026-05-09T12:00:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as PluginOperationExecutionHandlerContext['logger'],
  progressReporter: {
    reportProgress: vi.fn(async () => undefined),
  },
  abortSignal: new AbortController().signal,
  isCancellationRequested: async () => false,
  throwIfCancellationRequested: async () => undefined,
  requestId: 'req-1',
  actorAccountId: 'actor-1',
});

describe('waste management plugin operation handlers', () => {
  it('exposes handlers for all declared waste job types', () => {
    const handlers = createWasteManagementPluginOperationExecutionHandlers();

    expect(Object.keys(handlers).sort()).toEqual(Object.values(wasteManagementOperationsContract.jobTypeIds).sort());
  });

  it('reports progress and returns a structured result for migration-oriented jobs', async () => {
    const handlers = createWasteManagementPluginOperationExecutionHandlers();
    const context = createContext({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.applyMigrations,
      inputPayload: {
        operation: 'apply-migrations',
      },
    });

    const result = await handlers['waste-management.apply-migrations']?.(context);

    expect(context.progressReporter.reportProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        instanceId: 'instance-1',
        progress: expect.objectContaining({
          currentStepKey: 'complete-operation',
          currentPhase: 'waste-management.completed',
        }),
      })
    );
    expect(result).toEqual({
      progress: expect.objectContaining({
        completedSteps: 2,
        totalSteps: 2,
      }),
      resultPayload: {
        summary: {
          durationMs: expect.any(Number),
        },
        plugin: {
          operation: 'apply-migrations',
          mode: 'placeholder',
        },
      },
    });
  });

  it('rejects malformed waste job payloads fail-closed', async () => {
    const handlers = createWasteManagementPluginOperationExecutionHandlers();
    const context = createContext({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.seedData,
      inputPayload: {
        operation: 'reset-data',
      },
    });

    await expect(handlers['waste-management.seed-data']?.(context)).rejects.toThrow(
      'invalid_waste_management_job_input:waste-management.seed-data'
    );
  });
});
