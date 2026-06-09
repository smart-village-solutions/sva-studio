import { describe, expect, it, vi } from 'vitest';

import type { PluginJobHandlerContext } from '@sva/plugin-sdk';
import { wasteManagementOperationsContract } from '@sva/plugin-sdk';

import { createWasteManagementPluginJobTypes } from '../src/plugin-operations.js';
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
        requestedByVersion: '1.2.3',
        schemaInspection: { schemaVersion: 3 },
        appliedStatementCount: 5,
        undeclaredKey: 'ignored',
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
    const jobType = createWasteManagementPluginJobTypes().find(
      (entry) => entry.jobTypeId === wasteManagementOperationsContract.jobTypeIds.applyMigrations
    );

    expect(context.progressReporter.reportProgress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        jobId: 'job-1',
        instanceId: 'instance-1',
        progress: expect.objectContaining({
          currentStepKey: jobType?.progress.stepKeys[0],
          currentPhase: jobType?.progress.phaseKeys[0],
        }),
      })
    );
    expect(context.progressReporter.reportProgress).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobId: 'job-1',
        instanceId: 'instance-1',
        progress: expect.objectContaining({
          currentStepKey: jobType?.progress.stepKeys.at(-1),
          currentPhase: jobType?.progress.phaseKeys.at(-1),
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
          requestedByVersion: '1.2.3',
          schemaInspection: { schemaVersion: 3 },
          appliedStatementCount: 5,
        },
      },
    });
    expect(Object.keys(result?.resultPayload.plugin ?? {}).sort()).toEqual(
      ['appliedStatementCount', 'mode', 'operation', 'requestedByVersion', 'schemaInspection'].sort()
    );
  });

  it('keeps declared progress and detail keys aligned with runtime emissions for every waste job type', async () => {
    const handlers = createWasteManagementPluginOperationExecutionHandlers(createRuntime());
    const jobTypes = createWasteManagementPluginJobTypes();
    const scenarios = [
      {
        jobTypeId: wasteManagementOperationsContract.jobTypeIds.initializeDataSource,
        inputPayload: { operation: 'initialize-data-source' },
        expectedDetailKeys: ['connectionCheck', 'schemaInspection'],
      },
      {
        jobTypeId: wasteManagementOperationsContract.jobTypeIds.applyMigrations,
        inputPayload: { operation: 'apply-migrations' },
        expectedDetailKeys: ['requestedByVersion', 'schemaInspection', 'appliedStatementCount'],
      },
      {
        jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
        inputPayload: { operation: 'import-data' },
        expectedDetailKeys: [
          'importProfileId',
          'sourceFormat',
          'dryRun',
          'rowCount',
          'rows',
          'upserts',
          'createdFractions',
          'createdTours',
          'createdLocations',
          'createdAssignments',
          'skippedRows',
          'errorCount',
          'preview',
        ],
      },
      {
        jobTypeId: wasteManagementOperationsContract.jobTypeIds.seedData,
        inputPayload: { operation: 'seed-data' },
        expectedDetailKeys: ['seedKey', 'seededEntityCount'],
      },
      {
        jobTypeId: wasteManagementOperationsContract.jobTypeIds.resetData,
        inputPayload: { operation: 'reset-data' },
        expectedDetailKeys: ['confirmationTokenLength', 'deletedRows'],
      },
      {
        jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
        inputPayload: { operation: 'sync-waste-types' },
        expectedDetailKeys: ['staticContentName', 'version', 'fractionCount'],
      },
    ] as const;

    for (const scenario of scenarios) {
      const context = createContext({
        jobTypeId: scenario.jobTypeId,
        inputPayload: scenario.inputPayload,
      });

      const result = await handlers[scenario.jobTypeId]?.(context);
      const jobType = jobTypes.find((entry) => entry.jobTypeId === scenario.jobTypeId);
      const pluginPayload = result?.resultPayload.plugin ?? {};

      expect(jobType?.progress.stepKeys.length).toBeGreaterThanOrEqual(2);
      expect(context.progressReporter.reportProgress).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          progress: expect.objectContaining({
            currentPhase: jobType?.progress.phaseKeys[0],
            currentStepKey: jobType?.progress.stepKeys[0],
          }),
        })
      );
      expect(context.progressReporter.reportProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({
          progress: expect.objectContaining({
            currentPhase: jobType?.progress.phaseKeys.at(-1),
            currentStepKey: jobType?.progress.stepKeys.at(-1),
          }),
        })
      );
      expect(jobType?.result.detailKeys.slice().sort()).toEqual(scenario.expectedDetailKeys.slice().sort());
      expect(Object.keys(pluginPayload).sort()).toEqual(
        ['mode', 'operation', ...scenario.expectedDetailKeys].sort()
      );
    }
  });

  it('passes runtime-managed live import progress through for location-based csv imports', async () => {
    const importData = vi.fn(async (_instanceId: string, _input: Record<string, unknown>, progressReporter) => {
      await progressReporter?.reportProgress({
        completedSteps: 0,
        totalSteps: 12,
        currentPhase: 'waste-management.import-preparation',
        currentStepKey: 'prepare-import',
        details: {
          processedRows: 0,
          totalRows: 12,
        },
      });
      await progressReporter?.reportProgress({
        completedSteps: 12,
        totalSteps: 12,
        currentPhase: 'waste-management.completed',
        currentStepKey: 'complete-operation',
        details: {
          processedRows: 12,
          totalRows: 12,
        },
      });

      return {
        durationMs: 8,
        details: {
          operation: 'import-data',
          importProfileId: 'waste-management.ortsbezogene-tourtermine',
          sourceFormat: 'text/csv',
          dryRun: false,
          rowCount: 12,
          createdAssignments: 12,
        },
      };
    });
    const handlers = createWasteManagementPluginOperationExecutionHandlers(
      createRuntime({
        importData,
      })
    );
    const context = createContext({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
      inputPayload: {
        operation: 'import-data',
        importProfileId: 'waste-management.ortsbezogene-tourtermine',
        sourceFormat: 'text/csv',
        dryRun: false,
      },
    });

    const result = await handlers['waste-management.import-data']?.(context);

    expect(importData).toHaveBeenCalledWith(
      'instance-1',
      expect.objectContaining({
        importProfileId: 'waste-management.ortsbezogene-tourtermine',
        sourceFormat: 'text/csv',
        dryRun: false,
      }),
      expect.objectContaining({
        reportProgress: expect.any(Function),
      })
    );
    expect(context.progressReporter.reportProgress).toHaveBeenCalledTimes(2);
    expect(result?.progress).toEqual(
      expect.objectContaining({
        completedSteps: 12,
        totalSteps: 12,
        currentPhase: 'waste-management.completed',
        currentStepKey: 'complete-operation',
        details: {
          processedRows: 12,
          totalRows: 12,
        },
      })
    );
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
  initializeDataSource: vi.fn(async () => ({
    durationMs: 1,
    details: {
      operation: 'initialize-data-source',
      connectionCheck: { status: 'ok' },
      schemaInspection: { initialized: true },
    },
  })),
  applyMigrations: vi.fn(async () => ({
    durationMs: 1,
    details: {
      operation: 'apply-migrations',
      requestedByVersion: '1.0.0',
      schemaInspection: { schemaVersion: 2 },
      appliedStatementCount: 4,
    },
  })),
  importData: vi.fn(async () => ({
    durationMs: 1,
    details: {
      operation: 'import-data',
      importProfileId: 'waste-management.geografie-abholorte',
      sourceFormat: 'xlsx',
      dryRun: false,
      rowCount: 3,
      rows: 3,
      upserts: 7,
      createdFractions: 0,
      createdTours: 0,
      createdLocations: 2,
      createdAssignments: 1,
      skippedRows: 0,
      errorCount: 0,
      preview: undefined,
    },
  })),
  seedData: vi.fn(async () => ({
    durationMs: 1,
    details: {
      operation: 'seed-data',
      seedKey: 'baseline',
      seededEntityCount: 5,
    },
  })),
  resetData: vi.fn(async () => ({
    durationMs: 1,
    details: {
      operation: 'reset-data',
      confirmationTokenLength: 5,
      deletedRows: { waste_regions: 1 },
    },
  })),
  syncWasteTypes: vi.fn(async () => ({
    durationMs: 1,
    details: {
      operation: 'sync-waste-types',
      staticContentName: 'wasteTypes',
      version: '2026.06.09',
      fractionCount: 5,
    },
  })),
  ...overrides,
});
