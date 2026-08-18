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

export type LegacyStagingPromoteEvidence = StagingPromoteEvidenceBase;
export type AttestedStagingPromoteEvidence = StagingPromoteEvidenceBase &
  Readonly<{
    schemaVersion: 2;
    sourceSha: string;
    mainE2E: AppE2EEvidence;
  }>;
export type StagingPromoteEvidence = LegacyStagingPromoteEvidence | AttestedStagingPromoteEvidence;

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

export const buildStagingPromoteEvidence = (
  env: NodeJS.ProcessEnv,
  completedAt = new Date().toISOString()
): StagingPromoteEvidence => {
  const promoteMode = required(env.PROMOTE_MODE, 'PROMOTE_MODE');
  if (promoteMode !== 'standard' && promoteMode !== 'recovery') {
    throw new Error('PROMOTE_MODE muss standard oder recovery sein.');
  }
  const sourceSha = required(env.CHANGE_HEAD_SHA, 'CHANGE_HEAD_SHA');
  if (!shaPattern.test(sourceSha)) throw new Error('CHANGE_HEAD_SHA ist ungültig.');
  const requestedGateMode = env.MAIN_E2E_GATE_MODE?.trim();
  const gateMode =
    requestedGateMode === 'shadow' || requestedGateMode === 'enforce'
      ? requestedGateMode
      : 'disabled';

  const serializedMainE2E = env.MAIN_E2E_ATTESTATION;
  const parsedMainE2E = parseMainE2E(serializedMainE2E);
  if (promoteMode === 'recovery' && serializedMainE2E?.trim()) {
    throw new Error('Recovery-Staging darf keine MAIN_E2E_ATTESTATION übernehmen.');
  }
  if (serializedMainE2E?.trim() && !parsedMainE2E) {
    throw new Error('MAIN_E2E_ATTESTATION ist ungültig.');
  }
  if (promoteMode === 'standard' && gateMode === 'enforce' && !parsedMainE2E) {
    throw new Error('Enforced Standard-Staging benötigt eine gültige MAIN_E2E_ATTESTATION.');
  }
  if (
    parsedMainE2E &&
    (parsedMainE2E.evidenceClass !== 'canonical-main' ||
      parsedMainE2E.result !== 'success' ||
      parsedMainE2E.testOutcome !== 'success' ||
      parsedMainE2E.headSha !== sourceSha)
  ) {
    throw new Error('MAIN_E2E_ATTESTATION passt nicht zum erfolgreichen Main-Push.');
  }

  const stagingMutation = required(env.STAGING_MUTATION, 'STAGING_MUTATION');
  if (stagingMutation !== 'true' && stagingMutation !== 'false') {
    throw new Error('STAGING_MUTATION muss true oder false sein.');
  }

  const digest = required(env.DEPLOY_IMAGE_DIGEST, 'DEPLOY_IMAGE_DIGEST');
  if (!digestPattern.test(digest)) throw new Error('DEPLOY_IMAGE_DIGEST ist ungültig.');
  const workflowRunId = required(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  if (!runIdPattern.test(workflowRunId)) throw new Error('GITHUB_RUN_ID ist ungültig.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(completedAt))
    throw new Error('completedAt ist ungültig.');

  const base: StagingPromoteEvidenceBase = {
    completedAt,
    digest,
    environment: 'staging',
    mutation: stagingMutation === 'true' ? 'completed' : 'not-run',
    postflight: 'passed',
    workflowRunId,
  };
  if (promoteMode !== 'standard' || gateMode === 'disabled' || !parsedMainE2E) return base;
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
