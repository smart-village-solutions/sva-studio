#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  buildPromoteFailure,
  PromoteContractError,
  redactPromoteFailure,
  writePromoteFailureRecord,
  type PromoteEnvironment,
} from './promote-result.ts';
import type { PromoteRecoveryEvidence } from './promote-evidence-types.ts';
import { projectSeedAuthorization } from './staging-live-config-seed-contract.ts';
import { projectProductionSeedAuthorization } from './production-live-config-seed-contract.ts';
import { validateProductionSeedPreparation } from './promote-evidence-seed-preparation.ts';

export type PromoteRecoveryContract = PromoteRecoveryEvidence;

type BuildRecoveryContractInput = Readonly<{
  environment: PromoteEnvironment;
  mode: string | undefined;
  recoveryReason: string | undefined;
  previousImage: string | undefined;
  targetImage: string | undefined;
  previousConfigRevision: string | undefined;
  targetConfigRevision?: string | undefined;
  sourceSha?: string | undefined;
  seedAuthorization?: unknown;
  seedPreparation?: unknown;
}>;

const digestPattern = /(?:^|@)(sha256:[a-f0-9]{64})$/u;
const revisionPattern = /^[a-f0-9]{64}$/u;

const fail = (environment: PromoteEnvironment): never => {
  throw new PromoteContractError(
    buildPromoteFailure({
      code: 'PROMOTE_RECOVERY_CONTEXT_INVALID',
      environment,
      phase: 'static-preflight',
    })
  );
};

const parseDigest = (value: string | undefined, environment: PromoteEnvironment): string => {
  const digest = value?.trim().match(digestPattern)?.[1];
  return digest ?? fail(environment);
};

const parseRevision = (value: string | undefined, environment: PromoteEnvironment): string => {
  const revision = value?.trim();
  return revision && revisionPattern.test(revision) ? revision : fail(environment);
};

const invalidEvidence = (): never => {
  throw new Error('Recovery-Evidenz ist ungültig oder nicht an den Live-Vertrag gebunden.');
};

const normalizeEvidenceDigest = (value: unknown): string =>
  typeof value === 'string'
    ? (value.trim().match(digestPattern)?.[1] ?? invalidEvidence())
    : invalidEvidence();

const normalizeEvidenceRevision = (value: unknown): string =>
  typeof value === 'string' && revisionPattern.test(value.trim())
    ? value.trim()
    : invalidEvidence();

const projectSameDigestRetry = (
  value: unknown,
  previousDigest: string,
  targetDigest: string | null
): PromoteRecoveryEvidence['sameDigestRetry'] => {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidEvidence();
  const retry = value as Record<string, unknown>;
  const authorization = retry.authorization;
  const previousFailureCode = retry.previousFailureCode;
  const documentedCause = authorization === 'documented-cause' && previousFailureCode === null;
  if (previousDigest !== targetDigest) invalidEvidence();
  if (documentedCause) {
    return { authorization: 'documented-cause', previousFailureCode: null };
  }
  return invalidEvidence();
};

export const projectRecoveryEvidence = (
  value: unknown,
  bindings: Readonly<{
    previousDigest: string | null;
    targetDigest: string | null;
    previousConfigRevision: string | null;
  }>
): PromoteRecoveryEvidence | null => {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidEvidence();
  const candidate = value as Record<string, unknown>;
  const previousDigest = normalizeEvidenceDigest(candidate.previousDigest);
  const previousConfigRevision = normalizeEvidenceRevision(candidate.previousConfigRevision);
  if (
    candidate.mode !== 'recovery' ||
    candidate.reasonRecorded !== true ||
    previousDigest !== bindings.previousDigest ||
    previousConfigRevision !== bindings.previousConfigRevision
  ) {
    invalidEvidence();
  }
  return {
    mode: 'recovery',
    reasonRecorded: true,
    previousDigest,
    previousConfigRevision,
    sameDigestRetry: projectSameDigestRetry(
      candidate.sameDigestRetry,
      previousDigest,
      bindings.targetDigest
    ),
  };
};

const buildSeedBindings = (
  input: BuildRecoveryContractInput,
  previousDigest: string | undefined
) => {
  const targetDigest = parseDigest(input.targetImage, input.environment);
  const sourceSha = input.sourceSha?.trim() ?? '';
  if (!/^[a-f0-9]{40}$/u.test(sourceSha) || previousDigest !== targetDigest) {
    fail(input.environment);
  }
  return {
    sourceSha,
    imageDigest: targetDigest,
    configRevision: parseRevision(input.targetConfigRevision, input.environment),
  };
};

const validateSeedAuthorization = (
  input: BuildRecoveryContractInput,
  previousDigest: string | undefined
): void => {
  const bindings = buildSeedBindings(input, previousDigest);
  try {
    const authorization =
      input.environment === 'staging'
        ? projectSeedAuthorization(input.seedAuthorization, bindings)
        : input.environment === 'prod'
          ? projectProductionSeedAuthorization(input.seedAuthorization, bindings)
          : null;
    if (!authorization) fail(input.environment);
  } catch {
    fail(input.environment);
  }
};

const validateSeedPreparation = (
  input: BuildRecoveryContractInput,
  previousDigest: string | undefined
): void => {
  if (input.environment !== 'prod') fail(input.environment);
  const bindings = buildSeedBindings(input, previousDigest);
  try {
    validateProductionSeedPreparation(input.seedPreparation, bindings);
  } catch {
    fail(input.environment);
  }
};

const buildStandardContract = (input: BuildRecoveryContractInput): null => {
  const previousDigest = input.previousImage?.trim().match(digestPattern)?.[1];
  const previousConfigRevision = input.previousConfigRevision?.trim() ?? '';
  if (input.seedAuthorization && input.seedPreparation) fail(input.environment);
  if (input.seedAuthorization) {
    if (previousConfigRevision) fail(input.environment);
    validateSeedAuthorization(input, previousDigest);
    return null;
  }
  if (input.seedPreparation) {
    if (previousConfigRevision) fail(input.environment);
    validateSeedPreparation(input, previousDigest);
    return null;
  }
  const protectedEnvironment = input.environment === 'staging' || input.environment === 'prod';
  if (protectedEnvironment && previousDigest && !revisionPattern.test(previousConfigRevision)) {
    fail(input.environment);
  }
  return null;
};

export const buildRecoveryContract = (
  input: BuildRecoveryContractInput
): PromoteRecoveryContract | null => {
  if (input.environment === 'invalid') fail(input.environment);
  if (input.mode === 'standard') return buildStandardContract(input);
  if (input.mode !== 'recovery') fail(input.environment);
  if (!input.recoveryReason?.trim()) fail(input.environment);
  const previousDigest = parseDigest(input.previousImage, input.environment);
  const targetDigest = parseDigest(input.targetImage, input.environment);
  const previousConfigRevision = parseRevision(input.previousConfigRevision, input.environment);
  const sameDigestRetry =
    previousDigest === targetDigest
      ? {
          authorization: 'documented-cause' as const,
          previousFailureCode: null,
        }
      : null;
  return {
    mode: 'recovery',
    reasonRecorded: true,
    previousDigest,
    previousConfigRevision,
    sameDigestRetry,
  };
};

const parseEnvironment = (value: string | undefined): PromoteEnvironment => {
  if (value === 'dev' || value === 'staging' || value === 'prod') return value;
  return 'invalid';
};

export const runRecoveryContractFromEnvironment = (
  environmentValue: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr
):
  | Readonly<{ ok: true; contract: PromoteRecoveryContract | null }>
  | Readonly<{ ok: false; contract: null }> => {
  const environment = parseEnvironment(environmentValue);
  try {
    const contract = buildRecoveryContract({
      environment,
      mode: env.PROMOTE_MODE,
      recoveryReason: env.RECOVERY_REASON,
      previousImage: env.PREVIOUS_LIVE_IMAGE,
      targetImage: env.DEPLOY_IMAGE_DIGEST,
      previousConfigRevision: env.PREVIOUS_CONFIG_REVISION,
      targetConfigRevision: env.TARGET_CONFIG_REVISION,
      sourceSha: env.SOURCE_SHA,
      seedAuthorization: env.SEED_AUTHORIZATION?.trim() ? JSON.parse(env.SEED_AUTHORIZATION) : null,
      seedPreparation: env.SEED_PREPARATION?.trim() ? JSON.parse(env.SEED_PREPARATION) : null,
    });
    if (env.GITHUB_OUTPUT) {
      appendFileSync(
        env.GITHUB_OUTPUT,
        `recovery_contract=${JSON.stringify(contract)}\nforce_staging_parity=${contract?.sameDigestRetry ? 'true' : 'false'}\n`,
        'utf8'
      );
    }
    return { ok: true, contract };
  } catch (error) {
    const failure = redactPromoteFailure(error, { environment, phase: 'static-preflight' });
    writePromoteFailureRecord(failure, env.PROMOTE_FAILURE_PATH);
    stderr.write(`${failure.code}\n`);
    return { ok: false, contract: null };
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runRecoveryContractFromEnvironment(process.argv[2]);
  if (!result.ok) process.exitCode = 1;
}
