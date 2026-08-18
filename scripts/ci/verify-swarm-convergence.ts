#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { commandExists, runCapture, wait as defaultWait } from '../ops/runtime/process.ts';
import { inspectRemoteStack, type RemoteStackSnapshot } from '../ops/runtime/remote-stack-state.ts';
import {
  buildPromoteFailure,
  PromoteContractError,
  redactPromoteFailure,
  writePromoteFailureRecord,
} from './promote-result.ts';
import { stackNameForEnvironment, type PromoteEnvironment } from './promote-target.ts';

type ConvergenceServiceEvidence = Readonly<{
  desiredReplicas: number;
  latestTaskExitCode?: number;
  latestTaskState?: string;
  runningReplicas: number;
  shortName: string;
  updateState?: string;
}>;

export type SwarmConvergenceResult = Readonly<{
  services: readonly ConvergenceServiceEvidence[];
  status: 'converged' | 'pending' | 'terminal-failure';
}>;

export const classifySwarmConvergenceFailure = (error: unknown, environment: PromoteEnvironment) =>
  redactPromoteFailure(error, { environment, phase: 'swarm-convergence' });

const failedUpdateStates = new Set(['paused', 'rollback_paused']);
const activeUpdateStates = new Set(['updating', 'rollback_started', 'rollback_paused']);
const taskStates = new Set([
  'accepted',
  'assigned',
  'complete',
  'failed',
  'new',
  'orphaned',
  'pending',
  'preparing',
  'ready',
  'rejected',
  'remove',
  'running',
  'shutdown',
  'starting',
]);
const updateStates = new Set([
  'completed',
  'paused',
  'rollback_completed',
  'rollback_paused',
  'rollback_started',
  'updating',
]);

const normalizeAllowlistedState = (value: string | undefined, allowed: ReadonlySet<string>) => {
  const normalized = value?.trim().toLowerCase();
  return normalized && allowed.has(normalized) ? normalized : undefined;
};
const normalizeServiceName = (value: string) =>
  /^[a-z0-9][a-z0-9_-]{0,63}$/u.test(value) ? value : 'invalid-service';

export const evaluateSwarmConvergence = (snapshot: RemoteStackSnapshot): SwarmConvergenceResult => {
  const services = snapshot.services
    .filter((service) => service.desiredReplicas > 0)
    .map<ConvergenceServiceEvidence>((service) => {
      const latestTask = service.tasks[0];
      return {
        desiredReplicas: service.desiredReplicas,
        latestTaskExitCode: latestTask?.exitCode,
        latestTaskState: normalizeAllowlistedState(latestTask?.state, taskStates),
        runningReplicas: service.runningReplicas,
        shortName: normalizeServiceName(service.shortName),
        updateState: normalizeAllowlistedState(service.updateState, updateStates),
      };
    });
  const terminalFailure = services.some((service) =>
    failedUpdateStates.has(service.updateState ?? '')
  );
  if (terminalFailure) return { services, status: 'terminal-failure' };
  const converged =
    services.length > 0 &&
    services.every(
      (service) =>
        service.runningReplicas === service.desiredReplicas &&
        !activeUpdateStates.has(service.updateState ?? '')
    );
  return { services, status: converged ? 'converged' : 'pending' };
};

export const waitForSwarmConvergence = async (
  input: Readonly<{
    inspect: () => Promise<RemoteStackSnapshot>;
    now?: () => number;
    pollIntervalMs: number;
    timeoutMs: number;
    wait: (delayMs: number) => Promise<void>;
  }>
): Promise<SwarmConvergenceResult> => {
  const now = input.now ?? Date.now;
  const startedAt = now();
  for (;;) {
    const result = evaluateSwarmConvergence(await input.inspect());
    if (result.status !== 'pending') return result;
    if (now() - startedAt >= input.timeoutMs) return result;
    await input.wait(input.pollIntervalMs);
  }
};

const required = (value: string | undefined, label: string) => {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} fehlt.`);
  return normalized;
};

const parseEnvironment = (value: string | undefined): PromoteEnvironment => {
  if (value === 'dev' || value === 'staging' || value === 'prod') return value;
  throw new Error('Ungültige Promote-Umgebung.');
};

export const parsePositiveDuration = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('Die Swarm-Konvergenzzeit verletzt den internen Vertrag.');
  }
  return parsed;
};

const main = async () => {
  const environment = parseEnvironment(process.argv[2]);
  const quantumEndpoint = required(process.env.QUANTUM_ENDPOINT, 'QUANTUM_ENDPOINT');
  const stackName = stackNameForEnvironment(environment);
  const result = await waitForSwarmConvergence({
    inspect: () =>
      inspectRemoteStack(
        {
          commandExists: (command) => commandExists(resolve(import.meta.dirname, '../..'), command),
          runCapture: (command, args, env) =>
            runCapture(resolve(import.meta.dirname, '../..'), command, args, env),
        },
        process.env,
        { quantumEndpoint, stackName }
      ),
    pollIntervalMs: parsePositiveDuration(
      process.env.SVA_SWARM_CONVERGENCE_POLL_INTERVAL_MS,
      3_000
    ),
    timeoutMs: parsePositiveDuration(process.env.SVA_SWARM_CONVERGENCE_TIMEOUT_MS, 300_000),
    wait: async (delayMs) => {
      await defaultWait(delayMs);
    },
  });
  const outputPath = resolve(
    process.env.RUNNER_TEMP ?? process.cwd(),
    `promote-swarm-convergence-${process.env.GITHUB_RUN_ID ?? 'local'}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}.json`
  );
  writeFileSync(outputPath, `${JSON.stringify({ environment, ...result }, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `evidence_path=${outputPath}\n`);
  if (result.status !== 'converged') {
    const failure = buildPromoteFailure({
      code: 'PROMOTE_SWARM_CONVERGENCE_TIMEOUT',
      environment,
      phase: 'swarm-convergence',
    });
    if (process.env.PROMOTE_FAILURE_PATH)
      writePromoteFailureRecord(failure, process.env.PROMOTE_FAILURE_PATH);
    throw new PromoteContractError(failure);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cliEnvironment = process.argv[2];
  if (cliEnvironment !== 'dev' && cliEnvironment !== 'staging' && cliEnvironment !== 'prod') {
    process.stderr.write('PROMOTE_INPUT_INVALID: Die Promote-Umgebung ist ungültig.\n');
    process.exitCode = 1;
  } else {
    main().catch((error: unknown) => {
      const failure = classifySwarmConvergenceFailure(error, cliEnvironment);
      if (process.env.PROMOTE_FAILURE_PATH) {
        writePromoteFailureRecord(failure, process.env.PROMOTE_FAILURE_PATH);
      }
      process.stderr.write(`${failure.code}: ${failure.summary}\n`);
      process.exitCode = 1;
    });
  }
}
