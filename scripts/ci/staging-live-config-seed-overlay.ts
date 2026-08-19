import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  buildPromoteFailure,
  PromoteContractError,
  writePromoteFailureRecord,
} from './promote-result.ts';

const configRevisionLabel = 'sva.config.revision';
const configRevisionPattern = /^[a-f0-9]{64}$/;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const rejectOverlay = (): never => {
  throw new PromoteContractError(
    buildPromoteFailure({
      code: 'PROMOTE_LIVE_CONFIG_SEED_REJECTED',
      environment: 'staging',
      phase: 'static-preflight',
    })
  );
};

const readLabels = (stack: unknown): JsonRecord => {
  if (!isRecord(stack)) return rejectOverlay();
  if (!isRecord(stack.services)) return rejectOverlay();
  const app = stack.services.app;
  if (!isRecord(app) || !isRecord(app.deploy) || !isRecord(app.deploy.labels)) {
    return rejectOverlay();
  }
  return app.deploy.labels;
};

export const verifyStagingLiveConfigSeedOverlay = (
  baseStack: unknown,
  seededStack: unknown,
  revision: string
): { label: typeof configRevisionLabel; revision: string } => {
  if (!configRevisionPattern.test(revision)) rejectOverlay();

  const baseLabels = readLabels(baseStack);
  const seededLabels = readLabels(seededStack);
  if (configRevisionLabel in baseLabels || seededLabels[configRevisionLabel] !== revision) {
    rejectOverlay();
  }

  const normalizedSeeded = structuredClone(seededStack);
  const normalizedLabels = readLabels(normalizedSeeded);
  delete normalizedLabels[configRevisionLabel];
  if (!isDeepStrictEqual(baseStack, normalizedSeeded)) rejectOverlay();

  return { label: configRevisionLabel, revision };
};

const option = (name: string): string => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value || rejectOverlay();
};

export const runStagingLiveConfigSeedOverlay = (
  stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr
): boolean => {
  try {
    verifyStagingLiveConfigSeedOverlay(
      JSON.parse(readFileSync(option('--base'), 'utf8')) as unknown,
      JSON.parse(readFileSync(option('--seeded'), 'utf8')) as unknown,
      option('--revision')
    );
    return true;
  } catch (error) {
    const failure =
      error instanceof PromoteContractError
        ? error.failure
        : buildPromoteFailure({
            code: 'PROMOTE_INTERNAL_ERROR',
            environment: 'staging',
            phase: 'static-preflight',
          });
    writePromoteFailureRecord(failure, process.env.PROMOTE_FAILURE_PATH);
    stderr.write(`${failure.code}\n`);
    return false;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!runStagingLiveConfigSeedOverlay()) process.exitCode = 1;
}
