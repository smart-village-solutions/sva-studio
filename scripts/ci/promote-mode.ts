import { pathToFileURL } from 'node:url';

import {
  buildPromoteFailure,
  PromoteContractError,
  redactPromoteFailure,
  writePromoteFailureRecord,
  type PromoteEnvironment,
} from './promote-result.ts';

export type PromoteMode = 'standard' | 'recovery';

const digestPattern = /(?:^|@)sha256:[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{64}$/u;

export const validatePromoteMode = (input: {
  environment: 'dev' | 'staging' | 'prod';
  mode: string | undefined;
  recoveryReason: string | undefined;
}): PromoteMode => {
  const mode = input.mode ?? 'standard';
  if (mode !== 'standard' && mode !== 'recovery') {
    throw new PromoteContractError({
      code: 'PROMOTE_MODE_INVALID',
      environment: input.environment,
      phase: 'input-validation',
      summary: 'Der angeforderte Promote-Modus ist ungueltig.',
      retryable: false,
      nextAction: 'promote_mode auf standard oder recovery setzen.',
    });
  }
  if (mode === 'recovery' && !input.recoveryReason?.trim()) {
    throw new PromoteContractError({
      code: 'PROMOTE_RECOVERY_REASON_REQUIRED',
      environment: input.environment,
      phase: 'input-validation',
      summary: 'Der Recovery-Modus wurde ohne dokumentierten Grund angefordert.',
      retryable: false,
      nextAction: 'Recovery-Grund dokumentieren und das geschuetzte Environment erneut freigeben.',
    });
  }
  if (mode === 'recovery' && input.environment !== 'prod') {
    throw new PromoteContractError({
      code: 'PROMOTE_MODE_INVALID',
      environment: input.environment,
      phase: 'input-validation',
      summary: 'Recovery ist ausschließlich für Production zulässig.',
      retryable: false,
      nextAction: 'Dev und Staging im Standardmodus promoten.',
    });
  }
  return mode;
};

export const validatePromoteLiveRevision = (input: {
  environment: 'dev' | 'staging' | 'prod';
  mode: string | undefined;
  recoveryReason: string | undefined;
  previousImage: string | undefined;
  previousConfigRevision: string | undefined;
}): PromoteMode => {
  const mode = validatePromoteMode(input);
  const previousImage = input.previousImage?.trim();
  const previousConfigRevision = input.previousConfigRevision?.trim();
  if (
    input.environment !== 'dev' &&
    previousImage &&
    (!digestPattern.test(previousImage) ||
      !previousConfigRevision ||
      !revisionPattern.test(previousConfigRevision))
  ) {
    throw new PromoteContractError(
      buildPromoteFailure({
        code: 'PROMOTE_RECOVERY_CONTEXT_INVALID',
        environment: input.environment,
        phase: 'static-preflight',
      })
    );
  }
  return mode;
};

const parseEnvironment = (value: string | undefined): PromoteEnvironment => {
  if (value === 'dev' || value === 'staging' || value === 'prod') return value;
  return 'invalid';
};

const main = () => {
  const environment = parseEnvironment(process.argv[2]);
  if (environment === 'invalid') {
    throw new PromoteContractError(
      buildPromoteFailure({
        code: 'PROMOTE_MODE_INVALID',
        environment,
        phase: 'input-validation',
      })
    );
  }
  const input = {
    environment,
    mode: process.env.PROMOTE_MODE,
    recoveryReason: process.env.RECOVERY_REASON,
  };
  if (process.argv.includes('--mode-only')) validatePromoteMode(input);
  else {
    validatePromoteLiveRevision({
      ...input,
      previousImage: process.env.PREVIOUS_LIVE_IMAGE,
      previousConfigRevision: process.env.PREVIOUS_CONFIG_REVISION,
    });
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const environment = parseEnvironment(process.argv[2]);
    const failure = redactPromoteFailure(error, {
      environment,
      phase: process.argv.includes('--mode-only') ? 'input-validation' : 'static-preflight',
    });
    writePromoteFailureRecord(failure);
    process.stderr.write(`${failure.code}\n`);
    process.exitCode = 1;
  }
}
