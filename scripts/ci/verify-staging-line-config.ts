#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildPromoteFailure, writePromoteFailureRecord } from './promote-result.ts';

type WorkflowRun = Readonly<{
  id?: number;
  run_attempt?: number;
  path?: string;
  event?: string;
  head_branch?: string;
  status?: string;
  conclusion?: string | null;
}>;

type PromoteArtifact = Readonly<{
  id?: number;
  name?: string;
  expired?: boolean;
  workflow_run?: Readonly<{ id?: number }>;
}>;

export const validateStagingLineConfig = (
  run: WorkflowRun,
  value: unknown,
  expected: Readonly<{
    runId: number;
    attempt: number;
    digest: string;
    configRevision: string;
    secretReferences: readonly string[];
  }>
): void => {
  if (!value || typeof value !== 'object') throw new Error('Vorherige Promote-Evidenz fehlt.');
  const evidence = value as Record<string, unknown>;
  const recordedRun = evidence.run as Record<string, unknown> | undefined;
  const image = evidence.image as Record<string, unknown> | undefined;
  const config = evidence.config as Record<string, unknown> | undefined;
  if (
    run.id !== expected.runId ||
    run.run_attempt !== expected.attempt ||
    run.path !== '.github/workflows/promote.yml' ||
    run.event !== 'workflow_dispatch' ||
    run.head_branch !== 'main' ||
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    evidence.schemaVersion !== 2 ||
    evidence.environment !== 'staging' ||
    evidence.status !== 'passed' ||
    recordedRun?.id !== String(expected.runId) ||
    recordedRun.attempt !== expected.attempt ||
    image?.targetDigest !== expected.digest ||
    config?.revision !== expected.configRevision ||
    !Array.isArray(config.externalSecretReferences) ||
    JSON.stringify(config.externalSecretReferences) !== JSON.stringify(expected.secretReferences)
  ) {
    throw new Error('Vorherige Staging-Config oder Secret-Referenzen sind nicht belegt.');
  }
};

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name];
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
};

const positiveInteger = (value: string): number => {
  const result = Number(value);
  if (!/^[1-9]\d*$/u.test(value) || !Number.isSafeInteger(result))
    throw new Error('Ungültige Run-Identität.');
  return result;
};

export const verifyStagingLineConfig = (env: NodeJS.ProcessEnv = process.env): void => {
  const repo = required(env, 'GITHUB_REPOSITORY');
  const token = required(env, 'GITHUB_TOKEN');
  const runId = positiveInteger(required(env, 'PREVIOUS_PARITY_RUN_ID'));
  const attempt = positiveInteger(required(env, 'PREVIOUS_PARITY_ATTEMPT'));
  const liveImage = required(env, 'PREVIOUS_LIVE_IMAGE');
  const digest = liveImage.match(/@(?<digest>sha256:[a-f0-9]{64})$/u)?.groups?.digest;
  const configRevision = required(env, 'PREVIOUS_CONFIG_REVISION');
  const secretReferences: unknown = JSON.parse(required(env, 'TARGET_SECRET_REFERENCES'));
  if (
    !digest ||
    !/^[a-f0-9]{64}$/u.test(configRevision) ||
    !Array.isArray(secretReferences) ||
    !secretReferences.every((value) => typeof value === 'string' && value.length > 0)
  ) {
    throw new Error('Ungültige Live- oder Zielbindung des Staging-Wechsels.');
  }
  const api = <T>(path: string): T =>
    JSON.parse(
      execFileSync('gh', ['api', path], {
        encoding: 'utf8',
        env: { ...env, GH_TOKEN: token },
      })
    ) as T;
  const run = api<WorkflowRun>(`repos/${repo}/actions/runs/${runId}`);
  const artifactName = `promote-evidence-${runId}-${attempt}`;
  const artifacts =
    api<{ artifacts?: PromoteArtifact[] }>(
      `repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`
    ).artifacts ?? [];
  const matches = artifacts.filter(
    (artifact) =>
      artifact.name === artifactName &&
      artifact.expired === false &&
      Number.isSafeInteger(artifact.id) &&
      artifact.workflow_run?.id === runId
  );
  if (matches.length !== 1) throw new Error('Vorherige Promote-Evidenz ist nicht eindeutig.');
  const directory = mkdtempSync(resolve(tmpdir(), 'sva-staging-line-config-'));
  try {
    const zip = resolve(directory, 'evidence.zip');
    writeFileSync(
      zip,
      execFileSync('gh', ['api', `repos/${repo}/actions/artifacts/${matches[0]!.id}/zip`], {
        env: { ...env, GH_TOKEN: token },
      })
    );
    const filename = `${artifactName}.json`;
    const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
    if (entries.length !== 1 || entries[0] !== filename)
      throw new Error('Vorheriges Promote-Evidenzarchiv ist ungültig.');
    const output = execFileSync('unzip', ['-p', zip, filename], { encoding: 'utf8' });
    validateStagingLineConfig(run, JSON.parse(output), {
      runId,
      attempt,
      digest,
      configRevision,
      secretReferences,
    });
    const current = api<WorkflowRun>(`repos/${repo}/actions/runs/${runId}`);
    if (
      current.run_attempt !== attempt ||
      current.status !== 'completed' ||
      current.conclusion !== 'success'
    )
      throw new Error('Vorheriger Promote-Run wurde verändert.');
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    verifyStagingLineConfig();
  } catch {
    const failure = buildPromoteFailure({
      code: 'PROMOTE_CONFIG_INVALID',
      environment: 'staging',
      phase: 'static-preflight',
    });
    writePromoteFailureRecord(failure, process.env.PROMOTE_FAILURE_PATH);
    process.stderr.write(`${JSON.stringify(failure)}\n`);
    process.exitCode = 1;
  }
}
