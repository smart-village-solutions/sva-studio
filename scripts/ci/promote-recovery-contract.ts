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

export type PromoteRecoveryContract = PromoteRecoveryEvidence;

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
  const retryableConvergence =
    authorization === 'retryable-convergence' &&
    previousFailureCode === 'PROMOTE_SWARM_CONVERGENCE_TIMEOUT';
  const documentedCause = authorization === 'documented-cause' && previousFailureCode === null;
  if (previousDigest !== targetDigest) invalidEvidence();
  if (retryableConvergence) {
    return {
      authorization: 'retryable-convergence',
      previousFailureCode: 'PROMOTE_SWARM_CONVERGENCE_TIMEOUT',
    };
  }
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

export const buildRecoveryContract = (
  input: Readonly<{
    environment: PromoteEnvironment;
    mode: string | undefined;
    recoveryReason: string | undefined;
    previousImage: string | undefined;
    targetImage: string | undefined;
    previousConfigRevision: string | undefined;
    previousFailureCode: string | undefined;
  }>
): PromoteRecoveryContract | null => {
  if (input.mode === 'standard') return null;
  if (input.mode !== 'recovery') fail(input.environment);
  if (!input.recoveryReason?.trim()) fail(input.environment);
  const previousDigest = parseDigest(input.previousImage, input.environment);
  const targetDigest = parseDigest(input.targetImage, input.environment);
  const previousConfigRevision = parseRevision(input.previousConfigRevision, input.environment);
  const rawPreviousFailureCode = input.previousFailureCode?.trim() || undefined;
  const previousFailureCode: 'PROMOTE_SWARM_CONVERGENCE_TIMEOUT' | undefined =
    rawPreviousFailureCode === undefined ||
    rawPreviousFailureCode === 'PROMOTE_SWARM_CONVERGENCE_TIMEOUT'
      ? rawPreviousFailureCode
      : fail(input.environment);
  if (previousFailureCode && previousDigest !== targetDigest) fail(input.environment);
  const sameDigestRetry =
    previousDigest === targetDigest
      ? {
          authorization: previousFailureCode
            ? ('retryable-convergence' as const)
            : ('documented-cause' as const),
          previousFailureCode: previousFailureCode ?? null,
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
): PromoteRecoveryContract | null => {
  const environment = parseEnvironment(environmentValue);
  try {
    const contract = buildRecoveryContract({
      environment,
      mode: env.PROMOTE_MODE,
      recoveryReason: env.RECOVERY_REASON,
      previousImage: env.PREVIOUS_LIVE_IMAGE,
      targetImage: env.DEPLOY_IMAGE_DIGEST,
      previousConfigRevision: env.PREVIOUS_CONFIG_REVISION,
      previousFailureCode: env.RECOVERY_FAILURE_CODE,
    });
    if (env.GITHUB_OUTPUT) {
      appendFileSync(
        env.GITHUB_OUTPUT,
        `recovery_contract=${JSON.stringify(contract)}\nforce_staging_parity=${contract?.sameDigestRetry ? 'true' : 'false'}\n`,
        'utf8'
      );
    }
    return contract;
  } catch (error) {
    const failure = redactPromoteFailure(error, { environment, phase: 'static-preflight' });
    writePromoteFailureRecord(failure, env.PROMOTE_FAILURE_PATH);
    stderr.write(`${failure.code}\n`);
    return null;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (
    runRecoveryContractFromEnvironment(process.argv[2]) === null &&
    process.env.PROMOTE_MODE !== 'standard'
  )
    process.exitCode = 1;
}
