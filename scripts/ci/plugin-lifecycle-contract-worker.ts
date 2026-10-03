import { runTaskList } from './plugin-lifecycle-contract-database.js';
import {
  adminPassword,
  assert,
  database,
  instanceId,
  pluginId,
  rootDir,
  scalar,
  waitFor,
  workerPassword,
} from './plugin-lifecycle-contract-base.js';
import type { ContractPool, QueryClient } from './plugin-lifecycle-contract-base.js';
import type { RuntimeModules } from './plugin-lifecycle-contract-runtime.js';

import { spawn } from 'node:child_process';

export const contractWorkerProcesses = new Set<ReturnType<typeof spawn>>();

export const startLifecycle = (
  runtime: RuntimeModules,
  operation: 'provision' | 'reconcile' = 'provision',
  scheduledAt = new Date().toISOString()
) => runtime.start({ instanceId, pluginId, operation, scheduledAt });

export type ContractWorkerProcess = {
  readonly child: ReturnType<typeof spawn>;
  readonly output: { stderr: string; stdout: string };
};

export const spawnContractWorker = (
  port: string,
  jobId: string,
  mode: 'hold' | 'run' | 'shutdown'
): ContractWorkerProcess => {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'tooling/testing/fixtures/plugin-lifecycle-worker-process.ts'],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        IAM_DATABASE_URL: `postgres://postgres:${adminPassword}@127.0.0.1:${port}/${database}`,
        STUDIO_JOB_WORKER_DATABASE_URL: `postgres://sva_job_worker:${workerPassword}@127.0.0.1:${port}/${database}`,
        SVA_LIFECYCLE_CONTRACT_JOB_ID: jobId,
        SVA_LIFECYCLE_CONTRACT_WORKER_MODE: mode,
        SVA_PLUGIN_OPERATION_WORKER_ENABLED: 'true',
        SVA_PLUGIN_OPERATION_WORKER_LANE: 'privileged',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const output = { stderr: '', stdout: '' };
  contractWorkerProcesses.add(child);
  child.once('exit', () => contractWorkerProcesses.delete(child));
  child.stdout?.on('data', (chunk: Buffer) => {
    output.stdout += chunk.toString('utf8');
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output.stderr += chunk.toString('utf8');
  });
  return { child, output };
};

export const waitForWorkerOutput = async (
  workerProcess: ContractWorkerProcess,
  marker: string
): Promise<void> =>
  waitFor(`worker-process:${marker}`, async () => {
    if (workerProcess.output.stdout.includes(marker)) return true;
    if (workerProcess.child.exitCode !== null) {
      throw new Error(
        `plugin_lifecycle_worker_process_early_exit:${workerProcess.child.exitCode}:${workerProcess.output.stderr}`
      );
    }
    return false;
  });

export const waitForWorkerExit = async (
  workerProcess: ContractWorkerProcess
): Promise<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }> => {
  if (workerProcess.child.exitCode !== null || workerProcess.child.signalCode !== null) {
    return {
      code: workerProcess.child.exitCode,
      signal: workerProcess.child.signalCode,
    };
  }
  return new Promise((resolve, reject) => {
    workerProcess.child.once('error', reject);
    workerProcess.child.once('exit', (code, signal) => resolve({ code, signal }));
  });
};

export const runWorkerUntil = async (
  runtime: RuntimeModules,
  workerPool: ContractPool,
  probe: () => Promise<boolean>
): Promise<void> => {
  const runner = runTaskList(
    { concurrency: 1, noHandleSignals: true },
    runtime.createTaskList(runtime.registry),
    workerPool
  );
  try {
    await waitFor('worker-result', probe);
  } finally {
    await runner.gracefulShutdown();
  }
};

export const runWorkerAcrossExplicitRestart = async (
  runtime: RuntimeModules,
  workerPool: ContractPool,
  firstAttemptPersisted: () => Promise<boolean>,
  completed: () => Promise<boolean>
): Promise<void> => {
  const firstRunner = runTaskList(
    { concurrency: 1, noHandleSignals: true },
    runtime.createTaskList(runtime.registry),
    workerPool
  );
  await waitFor('first-worker-attempt', firstAttemptPersisted);
  await firstRunner.gracefulShutdown();
  await runWorkerUntil(runtime, workerPool, completed);
};

export const reportCase = async (name: string, work: () => Promise<void>): Promise<void> => {
  const startedAt = Date.now();
  await work();
  process.stdout.write(`LIFECYCLE-CONTRACT CASE ${name} PASS ${Date.now() - startedAt}ms\n`);
};

export const assertPersistedTerminalOutcome = async (
  pool: QueryClient,
  input: {
    readonly jobId: string;
    readonly generation: number;
    readonly status: 'succeeded' | 'failed';
    readonly eventType: 'job.succeeded' | 'job.failed';
    readonly executionKey?: string;
  }
): Promise<void> => {
  assert(
    (await scalar(pool, 'SELECT (status = $2)::text AS value FROM iam.studio_jobs WHERE id = $1', [
      input.jobId,
      input.status,
    ])) === 'true',
    `persisted_terminal_job_status:${input.jobId}`
  );
  assert(
    (await scalar(
      pool,
      `SELECT (
         count(*) = 1
         AND count(*) FILTER (WHERE event_type = $2) = 1
       )::text AS value
       FROM iam.studio_job_events
       WHERE job_id = $1
         AND event_type IN ('job.succeeded', 'job.failed', 'job.cancelled')`,
      [input.jobId, input.eventType]
    )) === 'true',
    `persisted_single_terminal_event:${input.jobId}`
  );
  const generationPredicate =
    input.status === 'succeeded'
      ? 'completed_generation = $3'
      : 'completed_generation < $3 AND claimed_generation IS NULL';
  assert(
    (await scalar(
      pool,
      `SELECT (
         active_job_id IS NULL
         AND desired_generation = $3
         AND ${generationPredicate}
       )::text AS value
       FROM iam.instance_plugin_lifecycle
       WHERE instance_id = $1 AND plugin_id = $2`,
      [instanceId, pluginId, input.generation]
    )) === 'true',
    `persisted_terminal_lifecycle_fence:${input.jobId}`
  );
  assert(
    (await scalar(
      pool,
      `SELECT count(*)::text AS value
       FROM graphile_worker.jobs
       WHERE key = $1${input.status === 'failed' ? ' AND attempts < max_attempts' : ''}`,
      [input.executionKey ?? `studio-job:${input.jobId}`]
    )) === '0',
    `persisted_execution_key_not_executable:${input.jobId}`
  );
};

export const assertPersistedPendingRetry = async (
  pool: QueryClient,
  input: { readonly jobId: string; readonly generation: number }
): Promise<void> => {
  await assertPersistedTerminalOutcome(pool, {
    jobId: input.jobId,
    generation: input.generation,
    status: 'succeeded',
    eventType: 'job.succeeded',
  });
  assert(
    (await scalar(
      pool,
      `SELECT (
         readiness_status = 'pending'
         AND retry_kind IS NULL
         AND next_recheck_at IS NOT NULL
       )::text AS value
       FROM iam.instance_plugin_lifecycle
       WHERE instance_id = $1 AND plugin_id = $2`,
      [instanceId, pluginId]
    )) === 'true',
    `persisted_pending_retry_lifecycle:${input.jobId}`
  );
  assert(
    (await scalar(pool, 'SELECT count(*)::text AS value FROM graphile_worker.jobs WHERE key = $1', [
      `plugin-tenant-lifecycle-retry:${instanceId}:${pluginId}`,
    ])) === '1',
    `persisted_single_retry_key:${input.jobId}`
  );
};
