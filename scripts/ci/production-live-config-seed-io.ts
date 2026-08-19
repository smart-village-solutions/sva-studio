import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { commandExists, runCapture } from '../ops/runtime/process.ts';
import { inspectRemoteServiceContract } from '../ops/runtime/remote-service-spec.ts';
import { buildPromoteFailure, PromoteContractError } from './promote-result.ts';
import type { ProductionLiveConfigSeedDependencies } from './verify-production-live-config-seed.ts';

const rootDir = resolve(import.meta.dirname, '../..');

const rejected = (): never => {
  throw new PromoteContractError(
    buildPromoteFailure({
      code: 'PROMOTE_LIVE_CONFIG_SEED_REJECTED',
      environment: 'prod',
      phase: 'static-preflight',
    })
  );
};

export const requireProductionSeedValue = (value: string | undefined): string =>
  value?.trim() || rejected();

export const parseProductionSeedReferences = (value: string | undefined): string[] => {
  try {
    const parsed = JSON.parse(requireProductionSeedValue(value)) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === 'string')) rejected();
    return parsed as string[];
  } catch (error) {
    if (error instanceof PromoteContractError) throw error;
    return rejected();
  }
};

const runPath = (repo: string, runId: number): string => `repos/${repo}/actions/runs/${runId}`;

export const createProductionLiveReader = (quantumEndpoint: string) => () =>
  inspectRemoteServiceContract(
    {
      commandExists: (command) => commandExists(rootDir, command),
      runCapture: (command, args, env) => runCapture(rootDir, command, args, env),
    },
    process.env,
    { quantumEndpoint, serviceName: 'app', stackName: 'studio' }
  ).then((contract) => ({ image: contract?.image, labels: contract?.labels }));

export const createProductionLiveConfigSeedDependencies = (
  repo: string,
  token: string,
  quantumEndpoint: string
): ProductionLiveConfigSeedDependencies => {
  const apiJson = <T>(path: string): T =>
    JSON.parse(
      execFileSync('gh', ['api', path], {
        encoding: 'utf8',
        env: { ...process.env, GH_TOKEN: token },
      })
    ) as T;
  return {
    readWorkflowRunAttempt: (runId, attempt) =>
      apiJson(`repos/${repo}/actions/runs/${runId}/attempts/${attempt}`),
    readCurrentWorkflowRun: (runId) => apiJson(runPath(repo, runId)),
    readExecutingWorkflowRun: (runId) => apiJson(runPath(repo, runId)),
    readRunArtifacts: (runId, page) =>
      apiJson(`repos/${repo}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`),
    readArtifactArchive: (artifactId) => {
      const directory = mkdtempSync(resolve(tmpdir(), 'sva-production-config-seed-'));
      const zipPath = resolve(directory, 'evidence.zip');
      try {
        writeFileSync(
          zipPath,
          execFileSync('gh', ['api', `repos/${repo}/actions/artifacts/${artifactId}/zip`], {
            env: { ...process.env, GH_TOKEN: token },
          })
        );
        const entries = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
          .split('\n')
          .filter(Boolean);
        const contents = new Map(
          entries.map((entry) => [
            entry,
            execFileSync('unzip', ['-p', zipPath, entry], { encoding: 'utf8' }),
          ])
        );
        return { entries, readText: (entry) => contents.get(entry) ?? '' };
      } finally {
        rmSync(directory, { force: true, recursive: true });
      }
    },
    readLiveSnapshot: createProductionLiveReader(quantumEndpoint),
  };
};
