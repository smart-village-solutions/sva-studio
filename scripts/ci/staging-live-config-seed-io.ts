import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { commandExists, runCapture } from '../ops/runtime/process.ts';
import { inspectRemoteServiceContract } from '../ops/runtime/remote-service-spec.ts';
import { buildPromoteFailure, PromoteContractError } from './promote-result.ts';
import type { StagingLiveConfigSeedDependencies } from './verify-staging-live-config-seed.ts';

const rootDir = resolve(import.meta.dirname, '../..');

const rejected = (): never => {
  throw new PromoteContractError(
    buildPromoteFailure({
      code: 'PROMOTE_LIVE_CONFIG_SEED_REJECTED',
      environment: 'staging',
      phase: 'static-preflight',
    })
  );
};

export const requireSeedCliValue = (value: string | undefined): string =>
  value?.trim() || rejected();

export const parseSeedSecretReferences = (value: string | undefined): string[] => {
  try {
    const parsed = JSON.parse(requireSeedCliValue(value)) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === 'string')) rejected();
    return parsed as string[];
  } catch (error) {
    if (error instanceof PromoteContractError) throw error;
    return rejected();
  }
};

export const stagingLiveConfigSeedArtifactsPath = (
  repo: string,
  runId: number,
  page: number
): string => `repos/${repo}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`;

export const stagingLiveConfigSeedRunPath = (repo: string, runId: number): string =>
  `repos/${repo}/actions/runs/${runId}`;

export const createStagingLiveConfigSeedCliDependencies = (
  repo: string,
  token: string,
  quantumEndpoint: string
): StagingLiveConfigSeedDependencies => {
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
    readCurrentWorkflowRun: (runId) => apiJson(stagingLiveConfigSeedRunPath(repo, runId)),
    readExecutingWorkflowRun: (runId) => apiJson(stagingLiveConfigSeedRunPath(repo, runId)),
    readRunArtifacts: (runId, _attempt, page) =>
      apiJson(stagingLiveConfigSeedArtifactsPath(repo, runId, page)),
    readArtifactArchive: (artifactId) => {
      const directory = mkdtempSync(resolve(tmpdir(), 'sva-staging-config-seed-'));
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
    readLiveSnapshot: createStagingLiveConfigSeedLiveReader(quantumEndpoint),
  };
};

export const createStagingLiveConfigSeedLiveReader = (quantumEndpoint: string) => () =>
  inspectRemoteServiceContract(
    {
      commandExists: (command) => commandExists(rootDir, command),
      runCapture: (command, args, env) => runCapture(rootDir, command, args, env),
    },
    process.env,
    { quantumEndpoint, serviceName: 'app', stackName: 'studio-staging' }
  ).then((contract) => ({ image: contract?.image, labels: contract?.labels }));
