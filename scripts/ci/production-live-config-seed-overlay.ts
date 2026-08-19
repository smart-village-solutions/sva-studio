import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import {
  buildPromoteFailure,
  PromoteContractError,
  writePromoteFailureRecord,
} from './promote-result.ts';

const label = 'sva.config.revision';
const revisionPattern = /^[a-f0-9]{64}$/u;
type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const reject = (): never => {
  throw new PromoteContractError(
    buildPromoteFailure({
      code: 'PROMOTE_LIVE_CONFIG_SEED_REJECTED',
      environment: 'prod',
      phase: 'static-preflight',
    })
  );
};

const labelsOf = (stack: unknown): JsonRecord => {
  if (!isRecord(stack)) reject();
  const root = stack as JsonRecord;
  if (!isRecord(root.services)) reject();
  const services = root.services as JsonRecord;
  const app = services.app;
  if (!isRecord(app)) reject();
  const appRecord = app as JsonRecord;
  if (!isRecord(appRecord.deploy)) reject();
  const deploy = appRecord.deploy as JsonRecord;
  if (!isRecord(deploy.labels)) reject();
  return deploy.labels as JsonRecord;
};

export const verifyProductionLiveConfigSeedOverlay = (
  baseStack: unknown,
  seededStack: unknown,
  revision: string
): Readonly<{ label: typeof label; revision: string }> => {
  if (!revisionPattern.test(revision)) reject();
  const baseLabels = labelsOf(baseStack);
  const seededLabels = labelsOf(seededStack);
  if (label in baseLabels || seededLabels[label] !== revision) reject();
  const normalized = structuredClone(seededStack);
  delete labelsOf(normalized)[label];
  if (!isDeepStrictEqual(baseStack, normalized)) reject();
  return { label, revision };
};

const option = (name: string): string => {
  const index = process.argv.indexOf(name);
  return (index >= 0 ? process.argv[index + 1] : undefined) || reject();
};

export const runProductionLiveConfigSeedOverlay = (
  stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr
): boolean => {
  try {
    verifyProductionLiveConfigSeedOverlay(
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
            environment: 'prod',
            phase: 'static-preflight',
          });
    writePromoteFailureRecord(failure, process.env.PROMOTE_FAILURE_PATH);
    stderr.write(`${failure.code}\n`);
    return false;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!runProductionLiveConfigSeedOverlay()) process.exitCode = 1;
}
