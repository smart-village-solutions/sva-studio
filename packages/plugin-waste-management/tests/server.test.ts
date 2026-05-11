import { describe, expect, it, vi } from 'vitest';

import type { PluginJobHandlerContext } from '@sva/plugin-sdk';
import { wasteManagementOperationsContract } from '@sva/plugin-sdk';

import {
  createWasteManagementPluginOperationExecutionHandlers,
  type WasteManagementOperationRuntime,
} from '../src/server.js';

const createContext = (input: {
  readonly jobTypeId: string;
  readonly inputPayload: Record<string, unknown>;
}): PluginJobHandlerContext => ({
  kind: 'job',
  pluginId: 'waste-management',
  jobId: 'job-1',
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
  instanceId: 'instance-1',
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  capabilities: {
    requestContext: true,
    auditReporter: false,
    progressReporter: true,
    secretAccess: false,
  },
  progressReporter: {
    report: vi.fn(async () => undefined),
    reportProgress: vi.fn(async () => undefined),
  },
  abortSignal: new AbortController().signal,
  isCancellationRequested: async () => false,
  throwIfCancellationRequested: async () => undefined,
  requestId: 'req-1',
  actorAccountId: 'actor-1',
});

describe('waste management plugin server handlers', () => {
  it('exposes handlers for all declared waste job types', () => {
    const handlers = createWasteManagementPluginOperationExecutionHandlers(createRuntime());

    expect(Object.keys(handlers).sort()).toEqual(Object.values(wasteManagementOperationsContract.jobTypeIds).sort());
  });

  it('reports progress and returns a structured result for migration-oriented jobs', async () => {
    const applyMigrations = vi.fn(async () => ({
      durationMs: 12,
      details: {
        operation: 'apply-migrations',
        appliedStatementCount: 5,
      },
    }));
    const handlers = createWasteManagementPluginOperationExecutionHandlers(
      createRuntime({
        applyMigrations,
      })
    );
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
    expect(applyMigrations).toHaveBeenCalledWith('instance-1', {
      operation: 'apply-migrations',
    });
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
          mode: 'executed',
          appliedStatementCount: 5,
        },
      },
    });
  });

  it('rejects malformed waste job payloads fail-closed', async () => {
    const handlers = createWasteManagementPluginOperationExecutionHandlers(createRuntime());
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

const createRuntime = (
  overrides: Partial<WasteManagementOperationRuntime> = {}
): WasteManagementOperationRuntime => ({
  initializeDataSource: vi.fn(async () => ({ durationMs: 1, details: { operation: 'initialize-data-source' } })),
  applyMigrations: vi.fn(async () => ({ durationMs: 1, details: { operation: 'apply-migrations' } })),
  importData: vi.fn(async () => ({ durationMs: 1, details: { operation: 'import-data' } })),
  seedData: vi.fn(async () => ({ durationMs: 1, details: { operation: 'seed-data' } })),
  resetData: vi.fn(async () => ({ durationMs: 1, details: { operation: 'reset-data' } })),
  ...overrides,
});
