import { resolvePool } from '../db.js';
import {
  pluginTenantLifecycleRetryTaskIdentifier,
  privilegedStudioJobTaskIdentifier,
  studioJobTaskIdentifier,
  type QueueStudioJobInput,
} from './runner-internal.js';

type QueueClient = {
  readonly query: (text: string, values?: readonly unknown[]) => Promise<unknown>;
};

export const enqueuePluginTenantLifecycleRetry = (
  client: QueueClient,
  input: { readonly instanceId: string; readonly runAt: Date }
): Promise<unknown> =>
  client.query(
    `SELECT graphile_worker.sva_enqueue_job(
      identifier => $1::text,
      payload => $2::json,
      queue_name => $3::text,
      max_attempts => $4::int,
      job_key => $5::text,
      run_at => $6::timestamptz
    )`,
    [
      pluginTenantLifecycleRetryTaskIdentifier,
      JSON.stringify({ instanceId: input.instanceId }),
      'plugin-tenant-lifecycle',
      5,
      `plugin-tenant-lifecycle-retry:${input.instanceId}`,
      input.runAt,
    ]
  );

export const queueStudioJob = async (input: QueueStudioJobInput): Promise<void> => {
  const pool = resolvePool();
  if (!pool) throw new Error('studio_job_queue_database_unavailable');

  await pool.query(
    `SELECT graphile_worker.sva_enqueue_job(
      identifier => $1::text,
      payload => $2::json,
      queue_name => $3::text,
      max_attempts => $4::int,
      job_key => $5::text,
      run_at => $6::timestamptz
    )`,
    [
      input.executionLane === 'privileged'
        ? privilegedStudioJobTaskIdentifier
        : studioJobTaskIdentifier,
      JSON.stringify({ instanceId: input.instanceId, jobId: input.jobId }),
      input.queueName,
      input.maxAttempts,
      `studio-job:${input.jobId}`,
      input.runAt ?? null,
    ]
  );
};

export const queuePluginOperationJob = queueStudioJob;
