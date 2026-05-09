import type { StudioJobError, StudioJobRecord } from '@sva/core';

const readPluginErrorCause = (error: Error): Record<string, unknown> | undefined => {
  const value = (error as { readonly cause?: unknown }).cause;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
};

export const createMissingHandlerPayload = (job: Pick<StudioJobRecord, 'jobTypeId' | 'pluginId'>): StudioJobError => ({
  code: 'plugin_operation_handler_missing',
  category: 'permanent',
  details: {
    host: {
      jobTypeId: job.jobTypeId,
      pluginId: job.pluginId,
    },
  },
});

export const createExecutionErrorPayload = (error: unknown, finalFailure: boolean): StudioJobError => ({
  code: 'plugin_operation_execution_failed',
  category: finalFailure ? 'permanent' : 'retryable',
  message: error instanceof Error ? error.message : String(error),
  details:
    error instanceof Error
      ? {
          plugin: readPluginErrorCause(error),
        }
      : undefined,
});
