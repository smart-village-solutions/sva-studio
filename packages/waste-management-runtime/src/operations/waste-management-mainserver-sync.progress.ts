import type { StudioJobProgress } from '@sva/core';

export type WasteSyncProgressReporter = {
  readonly reportProgress: (progress: StudioJobProgress) => Promise<void> | void;
};

export type WasteSyncBatchProgressDetails = Readonly<{
  operationMode: 'create' | 'delete';
  totalItemCount: number;
  totalBatchCount: number;
  currentBatchIndex: number;
  currentBatchSize: number;
  processedItemCount: number;
  createCount: number;
  deleteCount: number;
  lastSuccessfulBatchAt?: string;
  lastBatchDurationMs?: number;
  averageBatchDurationMs?: number;
}>;

const MAINSERVER_SYNC_TOTAL_STEPS = 6;

export const buildSyncProgress = (input: {
  readonly completedSteps: number;
  readonly currentStepKey:
    | 'load-studio-state'
    | 'load-mainserver-snapshot'
    | 'diff-sync-state'
    | 'create-batches'
    | 'delete-batches'
    | 'complete-operation';
  readonly currentStepLabel: string;
  readonly details?: Readonly<Record<string, unknown>>;
}): StudioJobProgress => ({
  completedSteps: input.completedSteps,
  totalSteps: MAINSERVER_SYNC_TOTAL_STEPS,
  currentStepKey: input.currentStepKey,
  currentStepLabel: input.currentStepLabel,
  details: input.details,
});

export const reportSyncProgress = async (
  progressReporter: WasteSyncProgressReporter | undefined,
  progress: StudioJobProgress
): Promise<void> => {
  await progressReporter?.reportProgress(progress);
};

export const averageBatchDuration = (values: readonly number[]): number =>
  values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

export const formatBatchStepLabel = (details: WasteSyncBatchProgressDetails): string => {
  const labelPrefix = details.operationMode === 'create' ? 'Create' : 'Delete';
  const currentBatch = details.totalBatchCount > 0 ? details.currentBatchIndex : 1;
  const totalBatches = details.totalBatchCount > 0 ? details.totalBatchCount : 1;

  return `${labelPrefix}-Batches ${currentBatch}/${totalBatches}`;
};
