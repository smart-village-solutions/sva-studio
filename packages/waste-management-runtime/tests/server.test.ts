import { describe, expect, it, vi } from 'vitest';

import type { PluginJobHandlerContext } from '@sva/plugin-sdk';
import { wasteManagementOperationsContract } from '@sva/plugin-sdk';

import { createWasteManagementPluginJobTypes } from '@sva/plugin-waste-management/waste-management.job-definitions';

import {
  createPluginJobExecutionHandlers,
  createWasteManagementPluginOperationExecutionHandlers,
  type WasteManagementOperationRuntime,
} from '../src/server.js';
import { createWasteRuntimeOperationHandlers } from '../src/runtime-handler-helpers.js';
import {
  assertWasteJobInput,
  createOperationResult,
  getJobTypeDefinition,
  getProgressDefinition,
} from '../src/runtime-job-helpers.js';

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

describe('waste management runtime handlers', () => {
  it('exposes handlers for all declared waste job types', () => {
    const handlers = createWasteManagementPluginOperationExecutionHandlers(createRuntime());

    expect(Object.keys(handlers).sort()).toEqual(Object.values(wasteManagementOperationsContract.jobTypeIds).sort());
  });

  it('emits declared progress keys and result details for migration jobs', async () => {
    const applyMigrations = vi.fn(async () => ({
      durationMs: 12,
      details: {
        operation: 'apply-migrations',
        requestedByVersion: '1.2.3',
        schemaInspection: { schemaVersion: 3 },
        appliedStatementCount: 5,
        undeclaredKey: 'ignored',
      },
    }));
    const handlers = createWasteManagementPluginOperationExecutionHandlers(createRuntime({ applyMigrations }));
    const context = createContext({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.applyMigrations,
      inputPayload: {
        operation: 'apply-migrations',
      },
    });

    const result = await handlers['waste-management.apply-migrations']?.(context);
    const jobType = createWasteManagementPluginJobTypes().find(
      (entry) => entry.jobTypeId === wasteManagementOperationsContract.jobTypeIds.applyMigrations
    );

    expect(context.progressReporter.reportProgress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        progress: expect.objectContaining({
          currentStepKey: jobType?.progress.stepKeys[0],
          currentPhase: jobType?.progress.phaseKeys[0],
        }),
      })
    );
    expect(context.progressReporter.reportProgress).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        progress: expect.objectContaining({
          currentStepKey: jobType?.progress.stepKeys.at(-1),
          currentPhase: jobType?.progress.phaseKeys.at(-1),
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
          mode: 'executed',
          requestedByVersion: '1.2.3',
          schemaInspection: { schemaVersion: 3 },
          appliedStatementCount: 5,
        },
      },
    });
  });

  it('re-exports the canonical runtime handler map and alias from the helper module', () => {
    const runtime = createRuntime();
    const directHandlers = createWasteRuntimeOperationHandlers(runtime);
    const exportedHandlers = createWasteManagementPluginOperationExecutionHandlers(runtime);

    expect(Object.keys(directHandlers).sort()).toEqual(Object.keys(exportedHandlers).sort());
    expect(createPluginJobExecutionHandlers).toBe(createWasteManagementPluginOperationExecutionHandlers);
  });

  it('delegates every non-import operation to its matching runtime method', async () => {
    const methodNames = [
      ['provisionTenantDatabase', 'provision-tenant-database'],
      ['initializeDataSource', 'initialize-data-source'],
      ['seedData', 'seed-data'],
      ['resetData', 'reset-data'],
      ['syncMainserver', 'sync-mainserver'],
      ['syncWasteTypes', 'sync-waste-types'],
      ['materializeEmailReminders', 'materialize-email-reminders'],
      ['processEmailReminderOutbox', 'process-email-reminder-outbox'],
    ] as const;
    const spies = Object.fromEntries(
      methodNames.map(([methodName]) => [
        methodName,
        vi.fn(async (_instanceId: string, _payload: unknown, thirdArgument?: unknown) => {
          const progressReporter =
            typeof thirdArgument === 'object' &&
            thirdArgument !== null &&
            'reportProgress' in thirdArgument &&
            typeof thirdArgument.reportProgress === 'function'
              ? thirdArgument
              : undefined;
          await progressReporter?.reportProgress({
            completedSteps: 2,
            totalSteps: 2,
            currentPhase: 'runtime.completed',
            currentStepKey: 'runtime-complete',
          } as never);
          return { durationMs: 1, details: {} };
        }),
      ])
    );
    const handlers = createWasteManagementPluginOperationExecutionHandlers(
      createRuntime(spies as Partial<WasteManagementOperationRuntime>)
    );

    for (const [methodName, operation] of methodNames) {
      const jobTypeId = Object.values(wasteManagementOperationsContract.jobTypeIds).find((candidate) =>
        candidate.endsWith(operation)
      );
      expect(jobTypeId).toBeDefined();
      await handlers[jobTypeId as keyof typeof handlers]?.(
        createContext({ jobTypeId: jobTypeId ?? '', inputPayload: { operation } })
      );
      expect(spies[methodName]).toHaveBeenCalledWith(
        'instance-1',
        expect.objectContaining({ operation }),
        ...(methodName === 'syncMainserver'
          ? [expect.objectContaining({ reportProgress: expect.any(Function) })]
          : methodName === 'provisionTenantDatabase'
            ? [{ jobId: 'job-1' }]
            : [])
      );
    }
  });

  it('rejects invalid and unknown job inputs', () => {
    expect(() => assertWasteJobInput('job.invalid', {}, 'seed-data')).toThrow(
      'invalid_waste_management_job_input:job.invalid'
    );
    expect(() => getJobTypeDefinition('waste-management.unknown')).toThrow(
      'unknown_waste_management_job_type:waste-management.unknown'
    );
  });

  it('uses safe progress fallbacks and filters undeclared result details', () => {
    expect(getProgressDefinition({ jobTypeId: 'test', queueName: 'test' } as never, 'fallback.phase')).toEqual({
      initialPhaseKey: 'fallback.phase',
      initialStepKey: 'resolve-operation',
      completedPhaseKey: 'waste-management.completed',
      completedStepKey: 'complete-operation',
    });
    expect(
      createOperationResult({
        jobTypeDefinition: { jobTypeId: 'test', queueName: 'test', result: { detailKeys: ['kept'] } } as never,
        payload: { operation: 'seed-data' } as never,
        operationResult: { durationMs: 0, details: { kept: 1, ignored: 2 } },
        startedAt: Date.now(),
        progress: {
          completedSteps: 2,
          totalSteps: 2,
          currentPhase: 'done',
          currentStepKey: 'done',
          lastUpdatedAt: new Date().toISOString(),
        },
      }).resultPayload
    ).toEqual({
      summary: { durationMs: expect.any(Number) },
      plugin: { operation: 'seed-data', mode: 'executed', kept: 1 },
    });
  });
});

const createRuntime = (
  overrides: Partial<WasteManagementOperationRuntime> = {}
): WasteManagementOperationRuntime => ({
  provisionTenantDatabase: async () => ({
    durationMs: 1,
    details: { databaseName: 'sva_waste_test', interfaceId: 'waste-management:instance-1', desiredGeneration: 1 },
  }),
  initializeDataSource: async () => ({
    durationMs: 1,
    details: { connectionCheck: 'ok', schemaInspection: { schemaVersion: 1 } },
  }),
  applyMigrations: async () => ({
    durationMs: 1,
    details: { requestedByVersion: '1.0.0', schemaInspection: { schemaVersion: 1 }, appliedStatementCount: 0 },
  }),
  importData: async () => ({
    durationMs: 1,
    details: {
      importProfileId: 'waste-management.location-tour-pickup-dates',
      sourceFormat: 'text/csv',
      dryRun: false,
      rowCount: 0,
      rows: 0,
      upserts: 0,
      createdFractions: 0,
      createdTours: 0,
      createdLocations: 0,
      createdAssignments: 0,
      skippedRows: 0,
      errorCount: 0,
      preview: [],
    },
  }),
  seedData: async () => ({
    durationMs: 1,
    details: { seedKey: 'default', seededEntityCount: 0 },
  }),
  resetData: async () => ({
    durationMs: 1,
    details: { confirmationTokenLength: 12, deletedRows: 0 },
  }),
  syncMainserver: async () => ({
    durationMs: 1,
    details: { studioItemCount: 0, mainserverItemCount: 0, createCount: 0, deleteCount: 0, errorCount: 0 },
  }),
  syncWasteTypes: async () => ({
    durationMs: 1,
    details: { staticContentName: 'waste-types', version: '1', fractionCount: 0 },
  }),
  materializeEmailReminders: async () => ({
    durationMs: 1,
    details: { activeSubscriptionCount: 0, createdOutboxCount: 0, duplicateOutboxCount: 0, skippedPickupCount: 0 },
  }),
  processEmailReminderOutbox: async () => ({
    durationMs: 1,
    details: { leasedCount: 0, sentCount: 0, retryScheduledCount: 0, failedCount: 0, batchSize: 0 },
  }),
  ...overrides,
});
