#!/usr/bin/env node

import {
  buildPromoteFailure,
  parsePromoteFailure,
  writePromoteFailureRecord,
  type PromoteEnvironment,
  type PromoteErrorCode,
  type PromotePhase,
} from './promote-result.ts';

export const recordPromoteFailure = (input: {
  code: PromoteErrorCode;
  environment: PromoteEnvironment;
  phase: PromotePhase;
}): void => {
  const failure = parsePromoteFailure(buildPromoteFailure(input));
  if (!failure) throw new Error('Ungültige Promote-Fehlerargumente.');
  writePromoteFailureRecord(failure);
  process.stderr.write(`${JSON.stringify(failure)}\n`);
};

const [, , code, environment, phase] = process.argv;
try {
  recordPromoteFailure({
    code: code as PromoteErrorCode,
    environment: environment as PromoteEnvironment,
    phase: phase as PromotePhase,
  });
} catch {
  recordPromoteFailure({
    code: 'PROMOTE_INTERNAL_ERROR',
    environment: environment === 'prod' ? 'prod' : environment === 'staging' ? 'staging' : 'dev',
    phase: 'evidence',
  });
  process.exitCode = 2;
}
