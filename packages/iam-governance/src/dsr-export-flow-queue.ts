import type { DsrExportFormat } from './dsr-export-payload.js';
import {
  createAsyncExportJob,
  linkStudioJobToExportJob,
  markExportJobQueueFailed,
} from './dsr-export-flow-persistence.js';
import type { DsrExportFlowDeps } from './dsr-export-flow-types.js';
import type { QueryClient } from './query-client.js';

export const queueDsrExport = async (
  deps: DsrExportFlowDeps,
  client: QueryClient,
  input: {
    instanceId: string;
    targetAccountId: string;
    requestedByAccountId: string;
    format: DsrExportFormat;
  }
): Promise<{ id: string; status: string } | undefined> => {
  const job = await createAsyncExportJob(client, input);
  try {
    const studioJob = await deps.createAsyncStudioJob({
      instanceId: input.instanceId,
      exportJobId: job.id,
      requestedByAccountId: input.requestedByAccountId,
      targetAccountId: input.targetAccountId,
      format: input.format,
    });
    await linkStudioJobToExportJob(client, {
      exportJobId: job.id,
      studioJobId: studioJob.id,
    });
  } catch (error) {
    await markExportJobQueueFailed(client, {
      exportJobId: job.id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
  return job;
};
