#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseAppE2EEvidence, type AppE2EEvidence } from './app-e2e-evidence.ts';

type StagingPromoteEvidenceBase = Readonly<{
  completedAt: string;
  digest: string;
  environment: 'staging';
  mutation: 'completed' | 'not-run';
  postflight: 'passed';
  workflowRunId: string;
}>;

export type AttestedStagingPromoteEvidence = StagingPromoteEvidenceBase &
  Readonly<{
    schemaVersion: 2;
    sourceSha: string;
    mainE2E: AppE2EEvidence;
  }>;
export type StagingPromoteEvidence = AttestedStagingPromoteEvidence;

const shaPattern = /^[0-9a-f]{40}$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const runIdPattern = /^\d+$/u;

const required = (value: string | undefined, name: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} darf nicht leer sein.`);
  return trimmed;
};

const parseMainE2E = (serialized: string | undefined): AppE2EEvidence | null => {
  if (!serialized?.trim()) return null;
  try {
    return parseAppE2EEvidence(JSON.parse(serialized));
  } catch {
    return null;
  }
};

const validateMainE2E = (
  serialized: string | undefined,
  parsed: AppE2EEvidence | null,
  sourceSha: string
): void => {
  if (!serialized?.trim() || !parsed)
    throw new Error('Staging benötigt eine gültige MAIN_E2E_ATTESTATION.');
  const canonicalSuccess =
    parsed.evidenceClass === 'canonical-main' &&
    parsed.result === 'success' &&
    parsed.testOutcome === 'success' &&
    parsed.headSha === sourceSha;
  if (!canonicalSuccess)
    throw new Error('MAIN_E2E_ATTESTATION passt nicht zum erfolgreichen Main-Push.');
};

const buildEvidenceBase = (
  env: NodeJS.ProcessEnv,
  completedAt: string
): StagingPromoteEvidenceBase => {
  const stagingMutation = required(env.STAGING_MUTATION, 'STAGING_MUTATION');
  if (stagingMutation !== 'true' && stagingMutation !== 'false')
    throw new Error('STAGING_MUTATION muss true oder false sein.');
  const digest = required(env.DEPLOY_IMAGE_DIGEST, 'DEPLOY_IMAGE_DIGEST');
  if (!digestPattern.test(digest)) throw new Error('DEPLOY_IMAGE_DIGEST ist ungültig.');
  const workflowRunId = required(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  if (!runIdPattern.test(workflowRunId)) throw new Error('GITHUB_RUN_ID ist ungültig.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(completedAt))
    throw new Error('completedAt ist ungültig.');
  return {
    completedAt,
    digest,
    environment: 'staging',
    mutation: stagingMutation === 'true' ? 'completed' : 'not-run',
    postflight: 'passed',
    workflowRunId,
  };
};

export const buildStagingPromoteEvidence = (
  env: NodeJS.ProcessEnv,
  completedAt = new Date().toISOString()
): StagingPromoteEvidence => {
  const sourceSha = required(env.CHANGE_HEAD_SHA, 'CHANGE_HEAD_SHA');
  if (!shaPattern.test(sourceSha)) throw new Error('CHANGE_HEAD_SHA ist ungültig.');

  const serializedMainE2E = env.MAIN_E2E_ATTESTATION;
  const parsedMainE2E = parseMainE2E(serializedMainE2E);
  validateMainE2E(serializedMainE2E, parsedMainE2E, sourceSha);
  const base = buildEvidenceBase(env, completedAt);
  if (!parsedMainE2E) throw new Error('MAIN_E2E_ATTESTATION ist ungültig.');
  return { ...base, schemaVersion: 2, sourceSha, mainE2E: parsedMainE2E };
};

const main = () => {
  const runId = required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const outputPath = resolve(
    process.env.RUNNER_TEMP ?? process.cwd(),
    `promote-staging-parity-${runId}.json`
  );
  writeFileSync(
    outputPath,
    `${JSON.stringify(buildStagingPromoteEvidence(process.env), null, 2)}\n`,
    { mode: 0o600 }
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
