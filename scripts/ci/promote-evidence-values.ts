import type { PromoteEvidence, PromoteRecoveryEvidence } from './promote-evidence-types.ts';

export const normalizePromoteMode = (value: string | null | undefined): PromoteEvidence['mode'] => {
  if (value === undefined || value === null || value === '' || value === 'standard') {
    return 'standard';
  }
  return value === 'recovery' ? 'recovery' : 'invalid';
};

export const normalizeReasonProvided = (value: boolean | string | null | undefined): boolean =>
  value === true || value === 'true';

export const deriveRecoveryEvidence = (input: {
  mode: PromoteEvidence['mode'];
  reasonProvided: boolean;
  previousDigest: string | null;
  targetDigest: string | null;
  previousConfigRevision: string | null;
}): PromoteRecoveryEvidence | null => {
  if (
    input.mode !== 'recovery' ||
    !input.reasonProvided ||
    !input.previousDigest ||
    !input.previousConfigRevision
  )
    return null;

  return {
    mode: 'recovery',
    reasonRecorded: true,
    previousDigest: input.previousDigest,
    previousConfigRevision: input.previousConfigRevision,
    sameDigestRetry:
      input.previousDigest === input.targetDigest
        ? { authorization: 'documented-cause', previousFailureCode: null }
        : null,
  };
};
