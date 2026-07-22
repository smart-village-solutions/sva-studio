#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { runBootstrapJobAgainstAcceptance } from '../ops/runtime/bootstrap-job.ts';
import { runMigrationJobAgainstAcceptance } from '../ops/runtime/migration-job.ts';
import { commandExists, run, runCapture, runCaptureDetailed, spawnBackground, wait } from '../ops/runtime/process.ts';

type JobKind = 'bootstrap' | 'migration';
type PromoteEnvironment = 'dev' | 'staging';

const rootDir = resolve(import.meta.dirname, '../..');

const required = (value: string | undefined, label: string) => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${label} darf nicht leer sein.`);
  return trimmed;
};

const parseArgs = (args: readonly string[]) => {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--') || !value) throw new Error('Erwartet: --kind <migration|bootstrap> --environment <dev|staging>.');
    values.set(flag, value);
    index += 1;
  }
  const kind = values.get('--kind');
  const environment = values.get('--environment');
  if (kind !== 'migration' && kind !== 'bootstrap') throw new Error('Ungültiger --kind.');
  if (environment !== 'dev' && environment !== 'staging') throw new Error('Ungültiges --environment.');
  return { environment, kind } as { environment: PromoteEnvironment; kind: JobKind };
};

const redact = (value: string | undefined) => {
  const appConfig = process.env.APP_CONFIG?.trim();
  const withoutAppConfig = appConfig ? (value ?? '').replaceAll(appConfig, '[REDACTED]') : (value ?? '');
  return withoutAppConfig
    .replace(/((?:password|token|secret|authorization)\s*[=:]\s*)[^\s]+/giu, '$1[REDACTED]')
    .slice(-8_000);
};

const main = async () => {
  const { environment, kind } = parseArgs(process.argv.slice(2));
  const quantumEndpoint = required(process.env.QUANTUM_ENDPOINT, 'QUANTUM_ENDPOINT');
  const runId = required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const attempt = required(process.env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT');
  const sourceStackName = `studio-${environment}`;
  const resultPath = resolve(process.env.RUNNER_TEMP ?? rootDir, `promote-${kind}-${runId}-${attempt}.json`);
  const reportId = `gha-${runId}-${attempt}`;
  const env: NodeJS.ProcessEnv = { ...process.env, QUANTUM_ENVIRONMENT: environment };
  delete env.SVA_MIGRATION_JOB_KEEP_FAILED_STACK;
  const deps = { commandExists, rootDir, run, runCapture, runCaptureDetailed, spawnBackground, wait };
  const input = {
    internalNetworkName: `${sourceStackName}_internal`,
    quantumEndpoint,
    remoteComposeFile: `deploy/compose.${environment}.yaml`,
    reportId,
    runtimeProfile: 'studio' as const,
    sourceStackName,
  };

  let result: Awaited<ReturnType<typeof runMigrationJobAgainstAcceptance>> | Awaited<ReturnType<typeof runBootstrapJobAgainstAcceptance>> | undefined;
  let failure: unknown;
  try {
    result = kind === 'migration'
      ? await runMigrationJobAgainstAcceptance(deps, env, input)
      : await runBootstrapJobAgainstAcceptance(deps, env, input);
    if (result.exitCode !== 0 || !result.taskId) throw new Error(`One-shot-Job lieferte keine erfolgreiche Task-Evidenz (exitCode=${String(result.exitCode)}, taskId=${result.taskId ?? 'fehlend'}).`);
  } catch (error) {
    failure = error;
  } finally {
    let cleanupError: unknown;
    if (result) {
      try {
        await result.cleanup();
      } catch (error) {
        cleanupError = error;
      }
    }
    const evidence = {
      cleanup: cleanupError ? 'error' : result ? 'ok' : 'attempted-after-failure',
      environment,
      error: failure instanceof Error ? redact(failure.message) : failure ? redact(String(failure)) : undefined,
      job: result ? { durationMs: result.durationMs, exitCode: result.exitCode, jobServiceName: result.jobServiceName, jobStackName: result.jobStackName, logTail: redact(result.logTail), state: result.state, taskId: result.taskId } : undefined,
      kind,
    };
    writeFileSync(resultPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `evidence_path=${resultPath}\n`);
    if (cleanupError) throw cleanupError;
  }
  if (failure) throw failure;
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? redact(error.message) : redact(String(error)));
  process.exitCode = 1;
});
