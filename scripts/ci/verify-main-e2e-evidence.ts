#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseAppE2EEvidence, type AppE2EEvidence } from './app-e2e-evidence.ts';
import {
  buildPromoteFailure,
  PromoteContractError,
  redactPromoteFailure,
  writePromoteFailureRecord,
  type PromoteErrorCode,
} from './promote-result.ts';

export type MainE2EWorkflowRun = Readonly<{
  id?: number;
  run_attempt?: number;
  path?: string;
  event?: string;
  head_branch?: string;
  head_sha?: string;
  status?: string;
  conclusion?: string | null;
}>;

export type MainE2EArtifact = Readonly<{
  id?: number;
  name?: string;
  expired?: boolean;
  workflow_run?: Readonly<{ id?: number; head_sha?: string }>;
}>;

type Archive = Readonly<{ entries: readonly string[]; readText: (entry: string) => string }>;

export type MainE2EVerifierDependencies = Readonly<{
  readWorkflowRuns: (
    page: number
  ) => Readonly<{ workflow_runs?: MainE2EWorkflowRun[]; total_count?: number }>;
  readWorkflowRun: (runId: number) => MainE2EWorkflowRun;
  readRunArtifacts: (
    runId: number,
    page: number
  ) => Readonly<{ artifacts?: MainE2EArtifact[]; total_count?: number }>;
  readArtifactArchive: (artifactId: number) => Archive;
}>;

const expectedWorkflowPath = '.github/workflows/app-e2e.yml';
const shaPattern = /^[0-9a-f]{40}$/u;

const contractError = (code: PromoteErrorCode): PromoteContractError =>
  new PromoteContractError(
    buildPromoteFailure({ code, environment: 'staging', phase: 'main-e2e-evidence' })
  );

const readLookup = <T>(operation: () => T): T => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof PromoteContractError) throw error;
    throw contractError('PROMOTE_MAIN_E2E_LOOKUP_FAILED');
  }
};

const listPages = <T>(
  readPage: (page: number) => Readonly<{ items: readonly T[]; total?: number }>
): T[] => {
  const items: T[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const payload = readPage(page);
    items.push(...payload.items);
    if (
      payload.items.length < 100 ||
      (payload.total !== undefined && items.length >= payload.total)
    )
      break;
    if (page === 10) throw contractError('PROMOTE_MAIN_E2E_LOOKUP_FAILED');
  }
  return items;
};

export const selectCanonicalMainRun = (
  runs: readonly MainE2EWorkflowRun[],
  expectedHeadSha: string
): Required<MainE2EWorkflowRun> => {
  const matching = runs.filter((run) => run.head_sha === expectedHeadSha);
  if (matching.length === 0) throw contractError('PROMOTE_MAIN_E2E_NOT_READY');
  const canonical = matching.filter(
    (run) => run.path === expectedWorkflowPath && run.event === 'push' && run.head_branch === 'main'
  );
  if (canonical.length === 0) throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  const runIds = new Set(canonical.map((run) => run.id).filter((id): id is number => Boolean(id)));
  if (runIds.size !== 1 || canonical.some((run) => !run.id))
    throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  const latest = [...canonical].sort(
    (left, right) => (right.run_attempt ?? 0) - (left.run_attempt ?? 0)
  )[0];
  if (
    !latest ||
    !Number.isSafeInteger(latest.id) ||
    (latest.id ?? 0) < 1 ||
    !Number.isSafeInteger(latest.run_attempt) ||
    (latest.run_attempt ?? 0) < 1 ||
    latest.path !== expectedWorkflowPath ||
    latest.event !== 'push' ||
    latest.head_branch !== 'main'
  )
    throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  if (latest.status !== 'completed' || !latest.conclusion)
    throw contractError('PROMOTE_MAIN_E2E_NOT_READY');
  if (latest.conclusion !== 'success') throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  return latest as Required<MainE2EWorkflowRun>;
};

export const selectEvidenceArtifact = (
  artifacts: readonly MainE2EArtifact[],
  run: Required<MainE2EWorkflowRun>
): Required<Pick<MainE2EArtifact, 'id' | 'name'>> & MainE2EArtifact => {
  const expectedName = `app-e2e-evidence-${run.id}-${run.run_attempt}`;
  const matches = artifacts.filter(
    (artifact) =>
      artifact.expired === false &&
      artifact.name === expectedName &&
      artifact.workflow_run?.id === run.id &&
      artifact.workflow_run.head_sha === run.head_sha
  );
  if (matches.length === 0) throw contractError('PROMOTE_MAIN_E2E_NOT_READY');
  if (matches.length !== 1 || !Number.isSafeInteger(matches[0]?.id) || (matches[0]?.id ?? 0) < 1)
    throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  return matches[0] as Required<Pick<MainE2EArtifact, 'id' | 'name'>> & MainE2EArtifact;
};

export const selectEvidenceJsonFile = (
  entries: readonly string[],
  run: Required<MainE2EWorkflowRun>
): string => {
  const expected = `app-e2e-evidence-${run.id}-${run.run_attempt}.json`;
  const jsonEntries = entries.filter((entry) => entry.endsWith('.json'));
  if (jsonEntries.length !== 1 || jsonEntries[0] !== expected)
    throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  return expected;
};

export const validateCanonicalMainEvidence = (
  value: unknown,
  run: Required<MainE2EWorkflowRun>,
  expectedHeadSha: string
): AppE2EEvidence => {
  const evidence = parseAppE2EEvidence(value);
  if (
    !evidence ||
    evidence.workflow !== 'App E2E' ||
    evidence.event !== 'push' ||
    evidence.ref !== 'refs/heads/main' ||
    evidence.branch !== 'main' ||
    evidence.headSha !== expectedHeadSha ||
    evidence.run.id !== String(run.id) ||
    evidence.run.attempt !== run.run_attempt ||
    evidence.result !== 'success' ||
    evidence.testOutcome !== 'success' ||
    evidence.evidenceClass !== 'canonical-main' ||
    evidence.subject.kind !== 'local-app-service-stack' ||
    evidence.subject.containerArtifactVerified !== false
  )
    throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  return evidence;
};

export const verifyMainE2EEvidence = (
  expectedHeadSha: string,
  dependencies: MainE2EVerifierDependencies
): AppE2EEvidence => {
  if (!shaPattern.test(expectedHeadSha)) throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  const readRuns = (): MainE2EWorkflowRun[] =>
    listPages((page) => {
      const response = readLookup(() => dependencies.readWorkflowRuns(page));
      return { items: response.workflow_runs ?? [], total: response.total_count };
    });
  const runs = readRuns();
  const run = selectCanonicalMainRun(runs, expectedHeadSha);
  const artifacts = listPages((page) => {
    const response = readLookup(() => dependencies.readRunArtifacts(run.id, page));
    return { items: response.artifacts ?? [], total: response.total_count };
  });
  const artifact = selectEvidenceArtifact(artifacts, run);
  const archive = readLookup(() => dependencies.readArtifactArchive(artifact.id));
  const evidenceFile = selectEvidenceJsonFile(archive.entries, run);
  let value: unknown;
  try {
    value = JSON.parse(readLookup(() => archive.readText(evidenceFile)));
  } catch {
    throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  }
  const evidence = validateCanonicalMainEvidence(value, run, expectedHeadSha);
  const currentSelection = selectCanonicalMainRun(readRuns(), expectedHeadSha);
  if (currentSelection.id !== run.id || currentSelection.run_attempt !== run.run_attempt)
    throw contractError('PROMOTE_MAIN_E2E_NOT_READY');
  const current = readLookup(() => dependencies.readWorkflowRun(run.id));
  if (
    current.id !== run.id ||
    current.run_attempt !== run.run_attempt ||
    current.status !== 'completed' ||
    current.conclusion !== 'success' ||
    current.head_sha !== expectedHeadSha
  )
    throw contractError('PROMOTE_MAIN_E2E_NOT_READY');
  return evidence;
};

const required = (value: string | undefined): string => {
  if (!value?.trim()) throw contractError('PROMOTE_MAIN_E2E_LOOKUP_FAILED');
  return value;
};

const createCliDependencies = (repo: string, token: string): MainE2EVerifierDependencies => {
  const apiJson = <T>(path: string): T =>
    JSON.parse(
      execFileSync('gh', ['api', path], {
        encoding: 'utf8',
        env: { ...process.env, GH_TOKEN: token },
      })
    ) as T;
  return {
    readWorkflowRuns: (page) =>
      apiJson(
        `repos/${repo}/actions/workflows/app-e2e.yml/runs?branch=main&per_page=100&page=${page}`
      ),
    readWorkflowRun: (runId) => apiJson(`repos/${repo}/actions/runs/${runId}`),
    readRunArtifacts: (runId, page) =>
      apiJson(`repos/${repo}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`),
    readArtifactArchive: (artifactId) => {
      const directory = mkdtempSync(resolve(tmpdir(), 'sva-main-e2e-evidence-'));
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
  };
};

export const runMainE2EPreflight = (
  env: NodeJS.ProcessEnv = process.env,
  stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr,
  dependenciesFactory: (
    repo: string,
    token: string
  ) => MainE2EVerifierDependencies = createCliDependencies
): AppE2EEvidence | null => {
  try {
    const evidence = verifyMainE2EEvidence(
      required(env.EXPECTED_CHANGE_HEAD),
      dependenciesFactory(required(env.GITHUB_REPOSITORY), required(env.GITHUB_TOKEN))
    );
    if (env.GITHUB_OUTPUT)
      appendFileSync(env.GITHUB_OUTPUT, `e2e_attestation=${JSON.stringify(evidence)}\n`, 'utf8');
    return evidence;
  } catch (error) {
    const failure = redactPromoteFailure(error, {
      environment: 'staging',
      phase: 'main-e2e-evidence',
    });
    writePromoteFailureRecord(failure, env.PROMOTE_FAILURE_PATH);
    stderr.write(`${JSON.stringify(failure)}\n`);
    return null;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!runMainE2EPreflight()) process.exitCode = 1;
}
