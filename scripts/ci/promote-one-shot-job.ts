#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { runBootstrapJobAgainstAcceptance } from '../ops/runtime/bootstrap-job.ts';
import { pickInternalNetworkName } from '../ops/runtime/internal-network.ts';
import { runMigrationJobAgainstAcceptance } from '../ops/runtime/migration-job.ts';
import { OneShotJobError } from '../ops/runtime/one-shot-job-lifecycle.ts';
import {
  commandExists,
  run,
  runCapture,
  runCaptureDetailed,
  spawnBackground,
  wait,
} from '../ops/runtime/process.ts';
import { inspectRemoteServiceContract } from '../ops/runtime/remote-service-spec.ts';
import { buildPromoteFailure, writePromoteFailureRecord } from './promote-result.ts';
import { stackNameForEnvironment } from './promote-target.ts';

type JobKind = 'bootstrap' | 'candidate' | 'migration';
type PromoteEnvironment = 'dev' | 'prod' | 'staging';
type OneShotResult =
  | Awaited<ReturnType<typeof runMigrationJobAgainstAcceptance>>
  | Awaited<ReturnType<typeof runBootstrapJobAgainstAcceptance>>;

type OneShotEvidenceResult = Pick<
  OneShotResult,
  'durationMs' | 'exitCode' | 'jobStackName' | 'state' | 'taskId'
>;

const failureContractByKind = {
  bootstrap: { code: 'PROMOTE_BOOTSTRAP_FAILED', phase: 'bootstrap' },
  candidate: { code: 'PROMOTE_CANDIDATE_JOB_FAILED', phase: 'candidate-preflight' },
  migration: { code: 'PROMOTE_MIGRATION_FAILED', phase: 'migration' },
} as const;

export const buildOneShotPromoteFailure = (
  failure: unknown,
  kind: JobKind,
  environment: PromoteEnvironment
) => {
  const contract = failureContractByKind[kind];
  return buildPromoteFailure({
    code: failure instanceof OneShotJobError ? contract.code : 'PROMOTE_INTERNAL_ERROR',
    environment,
    phase: contract.phase,
  });
};

const safeRuntimeIdentifier = (value: string | undefined) =>
  value && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value) ? value : undefined;

const terminalJobStates = new Set([
  'complete',
  'failed',
  'orphaned',
  'rejected',
  'remove',
  'shutdown',
]);

const rootDir = resolve(import.meta.dirname, '../..');

const resolveComposeSourceRoot = (value: string | undefined): string => {
  const trimmed = value?.trim();
  return trimmed ? resolve(trimmed) : rootDir;
};

const required = (value: string | undefined, label: string) => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${label} darf nicht leer sein.`);
  return trimmed;
};

export const parseArgs = (args: readonly string[]) => {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--') || !value)
      throw new Error(
        'Erwartet: --kind <candidate|migration|bootstrap> --environment <dev|staging|prod>.'
      );
    values.set(flag, value);
    index += 1;
  }
  const kind = values.get('--kind');
  const environment = values.get('--environment');
  if (kind !== 'candidate' && kind !== 'migration' && kind !== 'bootstrap')
    throw new Error('Ungültiger --kind.');
  if (environment !== 'dev' && environment !== 'staging' && environment !== 'prod')
    throw new Error('Ungültiges --environment.');
  return { environment, kind } as { environment: PromoteEnvironment; kind: JobKind };
};

const runOneShot = (
  kind: JobKind,
  deps: Parameters<typeof runMigrationJobAgainstAcceptance>[0],
  env: NodeJS.ProcessEnv,
  input: Parameters<typeof runMigrationJobAgainstAcceptance>[2]
): Promise<OneShotResult> => {
  if (kind === 'bootstrap') return runBootstrapJobAgainstAcceptance(deps, env, input);
  return runMigrationJobAgainstAcceptance(deps, env, {
    ...input,
    ...(kind === 'candidate' ? { jobServiceName: 'candidate' as const } : {}),
  });
};

const throwTerminalFailure = (failure: unknown, cleanupError: unknown) => {
  if (cleanupError && failure)
    throw new AggregateError(
      [failure, cleanupError],
      'One-shot-Job und Cleanup sind fehlgeschlagen.'
    );
  if (cleanupError) throw cleanupError;
  if (failure) throw failure;
};

export const buildOneShotEvidence = ({
  cleanupError,
  environment,
  failure,
  kind,
  result,
}: {
  cleanupError?: unknown;
  environment: PromoteEnvironment;
  failure?: unknown;
  kind: JobKind;
  result?: OneShotEvidenceResult;
}) => {
  const failedJob = failure instanceof OneShotJobError ? failure.evidence : undefined;
  const job = result ?? failedJob;
  return {
    cleanup:
      cleanupError || failedJob?.cleanupFailed
        ? ('error' as const)
        : result
          ? ('ok' as const)
          : failedJob
            ? ('ok-after-failure' as const)
            : ('attempted-after-failure' as const),
    environment,
    failure: failedJob ? { kind: failedJob.failureKind } : undefined,
    job: job
      ? {
          durationMs:
            'durationMs' in job &&
            Number.isSafeInteger(job.durationMs) &&
            Number(job.durationMs) >= 0
              ? job.durationMs
              : undefined,
          exitCode:
            job.exitCode === null || Number.isSafeInteger(job.exitCode) ? job.exitCode : undefined,
          jobServiceName: kind === 'migration' ? ('migrate' as const) : kind,
          jobStackName: safeRuntimeIdentifier(job.jobStackName),
          state: job.state && terminalJobStates.has(job.state) ? job.state : undefined,
          taskId: safeRuntimeIdentifier(job.taskId),
        }
      : undefined,
    kind,
    status: failure
      ? ('failed' as const)
      : cleanupError
        ? ('cleanup_failed' as const)
        : ('ok' as const),
  };
};

const main = async () => {
  const { environment, kind } = parseArgs(process.argv.slice(2));
  const quantumEndpoint = required(process.env.QUANTUM_ENDPOINT, 'QUANTUM_ENDPOINT');
  const runId = required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const attempt = required(process.env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT');
  const sourceStackName = stackNameForEnvironment(environment);
  const resultPath = resolve(
    process.env.RUNNER_TEMP ?? rootDir,
    `promote-${kind}-${runId}-${attempt}.json`
  );
  const reportId = `gha-${runId}-${attempt}`;
  const env: NodeJS.ProcessEnv = { ...process.env, QUANTUM_ENVIRONMENT: 'studio' };
  delete env.SVA_MIGRATION_JOB_KEEP_FAILED_STACK;
  const deps = {
    commandExists,
    rootDir: resolveComposeSourceRoot(process.env.SVA_COMPOSE_SOURCE_ROOT),
    run,
    runCapture,
    runCaptureDetailed,
    spawnBackground,
    wait,
  };
  const liveAppContract = await inspectRemoteServiceContract(
    {
      commandExists: (command) => commandExists(rootDir, command),
      runCapture: (command, args, requestEnv) => runCapture(rootDir, command, args, requestEnv),
    },
    env,
    { quantumEndpoint, serviceName: 'app', stackName: sourceStackName }
  );
  const internalNetworkName = pickInternalNetworkName(liveAppContract?.networkNames);
  if (!internalNetworkName)
    throw new Error(`Das interne Live-Netz für ${sourceStackName} konnte nicht ermittelt werden.`);
  const input = {
    internalNetworkName,
    quantumEndpoint,
    remoteComposeFiles: ['compose.yaml', `deploy/compose.${environment}.yaml`] as const,
    reportId,
    runtimeProfile: 'studio' as const,
    sourceStackName,
  };

  let result: OneShotResult | undefined;
  let failure: unknown;
  let cleanupError: unknown;
  try {
    result = await runOneShot(kind, deps, env, input);
    if (result.exitCode !== 0 || !result.taskId)
      throw new Error(
        `One-shot-Job lieferte keine erfolgreiche Task-Evidenz (exitCode=${String(result.exitCode)}, taskId=${result.taskId ?? 'fehlend'}).`
      );
  } catch (error) {
    failure = error;
  } finally {
    if (result) {
      try {
        await result.cleanup();
      } catch (error) {
        cleanupError = error;
      }
    }
    const evidence = buildOneShotEvidence({ cleanupError, environment, failure, kind, result });
    writeFileSync(resultPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `evidence_path=${resultPath}\n`);
  }
  if (failure && process.env.PROMOTE_FAILURE_PATH) {
    writePromoteFailureRecord(
      buildOneShotPromoteFailure(failure, kind, environment),
      process.env.PROMOTE_FAILURE_PATH
    );
  }
  throwTerminalFailure(failure, cleanupError);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('PROMOTE_ONE_SHOT_FAILED: Siehe kanonische Promote-Evidenz und Job-Annotation.');
    process.exitCode = 1;
  });
}
