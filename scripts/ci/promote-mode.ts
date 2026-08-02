import { PromoteContractError } from './promote-result.ts';

export type PromoteMode = 'standard' | 'recovery';

export const validatePromoteMode = (input: {
  environment: 'dev' | 'staging' | 'prod';
  mode: string | undefined;
  recoveryReason: string | undefined;
}): PromoteMode => {
  const mode = input.mode ?? 'standard';
  if (mode !== 'standard' && mode !== 'recovery') {
    throw new Error('promote_mode muss standard oder recovery sein.');
  }
  if (mode === 'recovery' && !input.recoveryReason?.trim()) {
    throw new PromoteContractError({
      code: 'PROMOTE_RECOVERY_REASON_REQUIRED',
      environment: input.environment,
      phase: 'static-preflight',
      summary: 'Der Recovery-Modus wurde ohne dokumentierten Grund angefordert.',
      retryable: false,
      nextAction: 'Recovery-Grund dokumentieren und das geschuetzte Environment erneut freigeben.',
    });
  }
  return mode;
};

