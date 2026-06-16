import type { PluginJobExecutionHandler } from '@sva/plugin-sdk';
import type { PluginJobTypeDefinition, WasteManagementJobInput } from '@sva/plugin-sdk';
import { createWasteManagementPluginJobTypes } from '@sva/plugin-waste-management/waste-management.job-definitions';

import {
  createCompletedJobProgress,
  createInitialJobProgress,
  createRuntimeProgressReporter,
  reportJobProgress,
} from './runtime-job-progress.js';
import type { WasteManagementJobProgress, WasteManagementOperationRuntime } from './runtime-types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const assertWasteJobInput = <TJobInput extends WasteManagementJobInput>(
  jobTypeId: string,
  inputPayload: Readonly<Record<string, unknown>>,
  expectedOperation: TJobInput['operation']
): TJobInput => {
  if (isRecord(inputPayload) && inputPayload.operation === expectedOperation) {
    return inputPayload as TJobInput;
  }

  throw new Error(`invalid_waste_management_job_input:${jobTypeId}`);
};

const jobTypeDefinitionsById = new Map<string, PluginJobTypeDefinition>(
  createWasteManagementPluginJobTypes().map((jobType) => [jobType.jobTypeId, jobType])
);

export const getJobTypeDefinition = (jobTypeId: string): PluginJobTypeDefinition => {
  const definition = jobTypeDefinitionsById.get(jobTypeId);
  if (!definition) {
    throw new Error(`unknown_waste_management_job_type:${jobTypeId}`);
  }
  return definition;
};

const pickDeclaredDetailKeys = (
  details: Readonly<Record<string, unknown>>,
  detailKeys: readonly string[]
): Record<string, unknown> =>
  Object.fromEntries(
    detailKeys
      .filter((detailKey) => Object.prototype.hasOwnProperty.call(details, detailKey))
      .map((detailKey) => [detailKey, details[detailKey]])
  );

export const getProgressDefinition = (
  jobTypeDefinition: PluginJobTypeDefinition,
  fallbackPhaseKey: string
) => {
  const phaseKeys = jobTypeDefinition.progress?.phaseKeys ?? [fallbackPhaseKey, 'waste-management.completed'];
  const stepKeys = jobTypeDefinition.progress?.stepKeys ?? ['resolve-operation', 'complete-operation'];

  return {
    initialPhaseKey: phaseKeys[0] ?? fallbackPhaseKey,
    initialStepKey: stepKeys[0] ?? 'resolve-operation',
    completedPhaseKey: phaseKeys[phaseKeys.length - 1] ?? 'waste-management.completed',
    completedStepKey: stepKeys[stepKeys.length - 1] ?? 'complete-operation',
  };
};

export const createOperationResult = <TJobInput extends WasteManagementJobInput>(input: {
  readonly jobTypeDefinition: PluginJobTypeDefinition;
  readonly payload: TJobInput;
  readonly operationResult: {
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  };
  readonly startedAt: number;
  readonly progress: WasteManagementJobProgress;
}) => ({
  progress: input.progress,
  resultPayload: {
    summary: {
      durationMs: Math.max(input.operationResult.durationMs, Math.max(1, Date.now() - input.startedAt)),
    },
    plugin: {
      operation: input.payload.operation,
      mode: 'executed',
      ...pickDeclaredDetailKeys(input.operationResult.details, input.jobTypeDefinition.result?.detailKeys ?? []),
    },
  },
});

export const createOperationHandler = <TJobInput extends WasteManagementJobInput>(input: {
  readonly jobTypeId: string;
  readonly expectedOperation: TJobInput['operation'];
  readonly phaseKey: string;
  readonly useRuntimeManagedProgress?: (payload: TJobInput) => boolean;
  readonly execute: (
    runtime: WasteManagementOperationRuntime,
    instanceId: string,
    payload: TJobInput,
    progressReporter?: {
      readonly reportProgress: (progress: WasteManagementJobProgress) => Promise<void> | void;
    }
  ) => Promise<{
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  }>;
}) =>
  (runtime: WasteManagementOperationRuntime): PluginJobExecutionHandler =>
  async (context) => {
    const jobTypeDefinition = getJobTypeDefinition(input.jobTypeId);
    const { initialPhaseKey, initialStepKey, completedPhaseKey, completedStepKey } = getProgressDefinition(
      jobTypeDefinition,
      input.phaseKey
    );
    const payload = assertWasteJobInput<TJobInput>(input.jobTypeId, context.job.inputPayload, input.expectedOperation);
    const startedAt = Date.now();
    const useRuntimeManagedProgress = input.useRuntimeManagedProgress?.(payload) ?? false;
    let latestRuntimeProgress: WasteManagementJobProgress | undefined;
    const runtimeProgressReporter = createRuntimeProgressReporter(context, (progress) => {
      latestRuntimeProgress = progress;
    });

    await context.throwIfCancellationRequested();
    const stepCount = jobTypeDefinition.progress?.stepKeys?.length ?? 2;
    await reportJobProgress(
      context,
      createInitialJobProgress({
        stepCount,
        initialPhaseKey,
        initialStepKey,
      }),
      useRuntimeManagedProgress
    );

    await context.throwIfCancellationRequested();
    const operationResult = await input.execute(
      runtime,
      context.job.instanceId,
      payload,
      useRuntimeManagedProgress ? runtimeProgressReporter : undefined
    );
    await context.throwIfCancellationRequested();
    const progress =
      latestRuntimeProgress ??
      createCompletedJobProgress({
        stepCount,
        completedPhaseKey,
        completedStepKey,
      });

    await reportJobProgress(context, progress, useRuntimeManagedProgress);

    return createOperationResult({
      jobTypeDefinition,
      payload,
      operationResult,
      startedAt,
      progress,
    });
  };
