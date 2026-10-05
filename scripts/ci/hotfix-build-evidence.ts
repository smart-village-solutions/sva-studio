#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const shaPattern = /^[a-f0-9]{40}$/u;
const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const tagPattern = /^studio-v\d+\.\d+\.\d+$/u;
const refPattern = /^refs\/heads\/hotfix\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export type HotfixBuildEvidence = Readonly<{
  schemaVersion: 1;
  runId: number;
  attempt: number;
  controllerSha: string;
  sourceSha: string;
  baseTag: string;
  ref: string;
  studioDigest: string;
  ssfDigest: string;
  backupAgentDigest: string;
}>;

type WorkflowRun = Readonly<{
  id?: number;
  run_attempt?: number;
  path?: string;
  event?: string;
  head_branch?: string;
  head_sha?: string;
  status?: string;
  conclusion?: string | null;
}>;

type WorkflowJob = Readonly<{
  name?: string;
  status?: string;
  conclusion?: string | null;
}>;

export const parseHotfixBuildEvidence = (value: unknown): HotfixBuildEvidence => {
  if (!value || typeof value !== 'object') throw new Error('Hotfix-Build-Evidenz fehlt.');
  const data = value as Record<string, unknown>;
  if (
    data.schemaVersion !== 1 ||
    !Number.isSafeInteger(data.runId) ||
    Number(data.runId) < 1 ||
    !Number.isSafeInteger(data.attempt) ||
    Number(data.attempt) < 1 ||
    !shaPattern.test(String(data.controllerSha)) ||
    !shaPattern.test(String(data.sourceSha)) ||
    !tagPattern.test(String(data.baseTag)) ||
    !refPattern.test(String(data.ref)) ||
    !digestPattern.test(String(data.studioDigest)) ||
    !digestPattern.test(String(data.ssfDigest)) ||
    !digestPattern.test(String(data.backupAgentDigest))
  ) {
    throw new Error('Hotfix-Build-Evidenz verletzt den Vertrag.');
  }
  return data as HotfixBuildEvidence;
};

export const verifyHotfixBuildEvidence = (
  run: WorkflowRun,
  jobs: readonly WorkflowJob[],
  evidenceValue: unknown,
  expected: Readonly<{
    runId: number;
    controllerSha: string;
    sourceSha: string;
    baseTag: string;
    ref: string;
    studioDigest: string;
  }>
): HotfixBuildEvidence => {
  const evidence = parseHotfixBuildEvidence(evidenceValue);
  if (
    run.id !== expected.runId ||
    run.path !== '.github/workflows/build.yml' ||
    run.event !== 'workflow_dispatch' ||
    run.head_branch !== 'main' ||
    run.head_sha !== expected.controllerSha ||
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    !Number.isSafeInteger(run.run_attempt) ||
    evidence.runId !== run.id ||
    evidence.attempt !== run.run_attempt ||
    evidence.controllerSha !== expected.controllerSha ||
    evidence.sourceSha !== expected.sourceSha ||
    evidence.baseTag !== expected.baseTag ||
    evidence.ref !== expected.ref ||
    evidence.studioDigest !== expected.studioDigest
  ) {
    throw new Error('Hotfix-Build-Run und angeforderter Digest stimmen nicht überein.');
  }
  for (const name of ['Build', 'Verify distribution images']) {
    const matches = jobs.filter((job) => job.name === name);
    if (
      matches.length !== 1 ||
      matches[0]?.status !== 'completed' ||
      matches[0]?.conclusion !== 'success'
    ) {
      throw new Error(`Hotfix-Build-Job ${name} ist nicht terminal erfolgreich.`);
    }
  }
  return evidence;
};

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name];
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
};

const runId = (value: string): number => {
  const result = Number(value);
  if (!/^[1-9]\d*$/u.test(value) || !Number.isSafeInteger(result))
    throw new Error('Ungültige GitHub-Run-ID.');
  return result;
};

export const writeHotfixBuildEvidence = (env: NodeJS.ProcessEnv = process.env): string => {
  const evidence = parseHotfixBuildEvidence({
    schemaVersion: 1,
    runId: runId(required(env, 'GITHUB_RUN_ID')),
    attempt: runId(required(env, 'GITHUB_RUN_ATTEMPT')),
    controllerSha: required(env, 'HOTFIX_CONTROLLER_SHA'),
    sourceSha: required(env, 'HOTFIX_SOURCE_SHA'),
    baseTag: required(env, 'HOTFIX_BASE_TAG'),
    ref: required(env, 'HOTFIX_REF'),
    studioDigest: required(env, 'HOTFIX_STUDIO_DIGEST'),
    ssfDigest: required(env, 'HOTFIX_SSF_DIGEST'),
    backupAgentDigest: required(env, 'HOTFIX_BACKUP_AGENT_DIGEST'),
  });
  const path = resolve(
    `artifacts/runtime/hotfix-build-evidence-${evidence.runId}-${evidence.attempt}.json`
  );
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return path;
};

export const verifyHotfixBuildRun = (env: NodeJS.ProcessEnv = process.env): HotfixBuildEvidence => {
  const repo = required(env, 'GITHUB_REPOSITORY');
  const token = required(env, 'GITHUB_TOKEN');
  const id = runId(required(env, 'HOTFIX_BUILD_RUN_ID'));
  const api = <T>(path: string): T =>
    JSON.parse(
      execFileSync('gh', ['api', path], {
        encoding: 'utf8',
        env: { ...env, GH_TOKEN: token },
      })
    ) as T;
  const run = api<WorkflowRun>(`repos/${repo}/actions/runs/${id}`);
  const attempt = run.run_attempt;
  if (!Number.isSafeInteger(attempt) || !attempt || attempt < 1)
    throw new Error('Hotfix-Build-Run hat keinen gültigen Versuch.');
  const jobs =
    api<{ jobs?: WorkflowJob[] }>(
      `repos/${repo}/actions/runs/${id}/attempts/${attempt}/jobs?per_page=100`
    ).jobs ?? [];
  const artifactName = `hotfix-build-evidence-${id}-${attempt}`;
  const artifacts =
    api<{ artifacts?: { id?: number; name?: string; expired?: boolean }[] }>(
      `repos/${repo}/actions/runs/${id}/artifacts?per_page=100`
    ).artifacts ?? [];
  const matches = artifacts.filter(
    (artifact) =>
      artifact.name === artifactName &&
      artifact.expired === false &&
      Number.isSafeInteger(artifact.id)
  );
  if (matches.length !== 1) throw new Error('Hotfix-Build-Evidenzartefakt ist nicht eindeutig.');
  const directory = mkdtempSync(resolve(tmpdir(), 'sva-hotfix-build-'));
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
      throw new Error('Hotfix-Build-Evidenzarchiv ist ungültig.');
    const output = execFileSync('unzip', ['-p', zip, filename], { encoding: 'utf8' });
    const evidence = verifyHotfixBuildEvidence(run, jobs, JSON.parse(output), {
      runId: id,
      controllerSha: required(env, 'EXPECTED_CONTROLLER_SHA'),
      sourceSha: required(env, 'EXPECTED_CHANGE_HEAD'),
      baseTag: required(env, 'HOTFIX_BASE_TAG'),
      ref: required(env, 'HOTFIX_REF'),
      studioDigest: required(env, 'DEPLOY_IMAGE_DIGEST'),
    });
    const current = api<WorkflowRun>(`repos/${repo}/actions/runs/${id}`);
    if (
      current.run_attempt !== run.run_attempt ||
      current.status !== 'completed' ||
      current.conclusion !== 'success' ||
      current.head_sha !== run.head_sha
    )
      throw new Error('Hotfix-Build-Run wurde während der Prüfung verändert.');
    return evidence;
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'write') writeHotfixBuildEvidence();
  else if (process.argv[2] === 'verify') verifyHotfixBuildRun();
  else throw new Error('Erwartet: write oder verify.');
}
