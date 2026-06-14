import { describe, expect, it, vi } from 'vitest';

import type { PluginJobHandlerContext } from '@sva/plugin-sdk';
import { wasteManagementOperationsContract } from '@sva/plugin-sdk';

import { createImportDataHandler } from '../src/runtime-import-handler.js';

const createContext = (inputPayload: Record<string, unknown>): PluginJobHandlerContext => ({
  kind: 'job',
  pluginId: 'waste-management',
  jobId: 'job-1',
  job: {
    id: 'job-1',
    instanceId: 'tenant-a',
    pluginId: 'waste-management',
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
    queueName: 'plugin-operations',
    status: 'running',
    inputPayload,
    attempts: 1,
    maxAttempts: 3,
    idempotencyKey: 'idem-1',
    scheduledAt: '2026-06-14T12:00:00.000Z',
    createdAt: '2026-06-14T12:00:00.000Z',
    updatedAt: '2026-06-14T12:00:00.000Z',
  },
  instanceId: 'tenant-a',
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
  throwIfCancellationRequested: vi.fn(async () => undefined),
  requestId: 'req-1',
  actorAccountId: 'actor-1',
});

describe('createImportDataHandler', () => {
  it('delegates csv pickup-date imports to the runtime-managed progress reporter', async () => {
    const importData = vi.fn(async (_instanceId, _payload, progressReporter) => {
      await progressReporter?.reportProgress({
        completedSteps: 3,
        totalSteps: 4,
        currentPhase: 'runtime.phase',
        currentStepKey: 'runtime.step',
      } as never);
      return {
        durationMs: 12,
        details: {
          importProfileId: wasteManagementOperationsContract.importProfileIds.locationTourPickupDates,
          sourceFormat: 'text/csv',
          dryRun: false,
          rowCount: 12,
          rows: 12,
          upserts: 8,
          createdFractions: 0,
          createdTours: 2,
          createdLocations: 1,
          createdAssignments: 8,
          skippedRows: 0,
          errorCount: 0,
          preview: [],
        },
      };
    });
    const handler = createImportDataHandler({ importData } as never);
    const context = createContext({
      operation: 'import-data',
      importProfileId: wasteManagementOperationsContract.importProfileIds.locationTourPickupDates,
      sourceFormat: 'text/csv',
      blobRef: 'blob-1',
      dryRun: false,
    });

    const result = await handler(context);

    expect(importData).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        dryRun: false,
        sourceFormat: 'text/csv',
      }),
      expect.objectContaining({
        reportProgress: expect.any(Function),
      })
    );
    expect(context.progressReporter.reportProgress).toHaveBeenCalledTimes(1);
    expect(context.progressReporter.reportProgress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        progress: expect.objectContaining({
          completedSteps: 3,
          totalSteps: 4,
          currentPhase: 'runtime.phase',
          currentStepKey: 'runtime.step',
        }),
      })
    );
    expect(result.progress).toEqual(
      expect.objectContaining({
        completedSteps: 3,
        totalSteps: 4,
        currentPhase: 'runtime.phase',
        currentStepKey: 'runtime.step',
      })
    );
  });

  it('reports both start and finish progress for non-runtime-managed imports', async () => {
    const importData = vi.fn(async () => ({
      durationMs: 7,
      details: {
        importProfileId: 'waste-management.any-other-profile',
        sourceFormat: 'application/json',
        dryRun: true,
        rowCount: 2,
        rows: 2,
        upserts: 0,
        createdFractions: 0,
        createdTours: 0,
        createdLocations: 0,
        createdAssignments: 0,
        skippedRows: 2,
        errorCount: 0,
        preview: [],
      },
    }));
    const handler = createImportDataHandler({ importData } as never);
    const context = createContext({
      operation: 'import-data',
      importProfileId: 'waste-management.any-other-profile',
      sourceFormat: 'application/json',
      blobRef: 'blob-2',
      dryRun: true,
    });

    const result = await handler(context);

    expect(importData).toHaveBeenCalledWith('tenant-a', expect.any(Object), undefined);
    expect(context.progressReporter.reportProgress).toHaveBeenCalledTimes(2);
    expect(context.progressReporter.reportProgress).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        progress: expect.objectContaining({
          completedSteps: 2,
          totalSteps: 2,
          currentPhase: 'waste-management.completed',
          currentStepKey: 'complete-operation',
        }),
      })
    );
    expect(result.progress).toEqual(
      expect.objectContaining({
        completedSteps: 2,
        totalSteps: 2,
      })
    );
  });
});
