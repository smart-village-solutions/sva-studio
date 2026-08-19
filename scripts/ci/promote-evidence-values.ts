import type { PromoteEvidence } from './promote-evidence-types.ts';

export const normalizePromoteMode = (value: string | null | undefined): PromoteEvidence['mode'] => {
  if (value === undefined || value === null || value === '' || value === 'standard') {
    return 'standard';
  }
  return value === 'recovery' ? 'recovery' : 'invalid';
};

export const normalizeReasonProvided = (value: boolean | string | null | undefined): boolean =>
  value === true || value === 'true';
