#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import { validatePromoteMode } from './promote-mode.ts';
import { PromoteContractError, redactPromoteFailure } from './promote-result.ts';

export const assertStandardProductionReadiness = (input: { environment: 'dev' | 'staging' | 'prod'; mode: 'standard' | 'recovery'; status: number }) => {
  if (input.environment === 'prod' && input.mode === 'standard' && input.status !== 200) throw new PromoteContractError({
    code: 'PROMOTE_READINESS_NOT_READY', environment: 'prod', phase: 'static-preflight', retryable: false,
    summary: `Production-Readiness ist vor der Mutation nicht bereit (HTTP ${input.status}).`,
    nextAction: 'Ursache read-only diagnostizieren oder den kontrollierten Recovery-Modus mit dokumentiertem Grund freigeben.',
  });
};

const main = async () => {
  const environment = process.argv[2] as 'dev' | 'staging' | 'prod';
  if (!['dev', 'staging', 'prod'].includes(environment)) throw new Error('Environment ist ungueltig.');
  const mode = validatePromoteMode({ environment, mode: process.env.PROMOTE_MODE, recoveryReason: process.env.RECOVERY_REASON });
  if (environment !== 'prod' || mode === 'recovery') return;
  const baseUrl = process.env.SVA_PUBLIC_BASE_URL?.trim();
  if (!baseUrl) throw new Error('SVA_PUBLIC_BASE_URL fehlt.');
  const response = await fetch(new URL('/health/ready', baseUrl), { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  assertStandardProductionReadiness({ environment, mode, status: response.status });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error: unknown) => {
  const failure = redactPromoteFailure(error, { environment: process.argv[2] === 'prod' ? 'prod' : process.argv[2] === 'staging' ? 'staging' : 'dev', phase: 'static-preflight' });
  process.stderr.write(`${JSON.stringify(failure)}\n`);
  process.exitCode = 1;
});

