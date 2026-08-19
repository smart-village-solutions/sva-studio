#!/usr/bin/env node

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  assertSeedableLiveSnapshot,
  validatePrepareRequest,
  type LiveServiceSnapshot,
  type StagingLiveConfigPrepareRequest,
} from './staging-live-config-seed-contract.ts';
import {
  createStagingLiveConfigSeedLiveReader,
  requireSeedCliValue,
} from './staging-live-config-seed-io.ts';
import {
  buildPromoteFailure,
  PromoteContractError,
  writePromoteFailureRecord,
} from './promote-result.ts';

export const seedPreparationContract = 'staging-live-config-label-prepare-v1' as const;

export type StagingLiveConfigSeedPreparation = Readonly<{
  contract: typeof seedPreparationContract;
  sourceSha: string;
  imageDigest: string;
  configRevision: string;
  liveConfigRevisionState: 'missing';
  backupExecutor: 'agent';
}>;

export const verifyStagingLiveConfigPrepare = (
  input: StagingLiveConfigPrepareRequest & Readonly<{ configRevision: string }>,
  snapshot: LiveServiceSnapshot
): StagingLiveConfigSeedPreparation => {
  validatePrepareRequest(input);
  assertSeedableLiveSnapshot(snapshot, input.targetDigest);
  if (!/^[a-f0-9]{64}$/u.test(input.configRevision)) {
    throw new PromoteContractError(
      buildPromoteFailure({
        code: 'PROMOTE_LIVE_CONFIG_SEED_REJECTED',
        environment: 'staging',
        phase: 'static-preflight',
      })
    );
  }
  return {
    contract: seedPreparationContract,
    sourceSha: input.headSha,
    imageDigest: input.targetDigest,
    configRevision: input.configRevision,
    liveConfigRevisionState: 'missing',
    backupExecutor: 'agent',
  };
};

const fromEnvironment = (env: NodeJS.ProcessEnv) => ({
  eventName: requireSeedCliValue(env.GITHUB_EVENT_NAME),
  environment: requireSeedCliValue(env.PROMOTE_ENVIRONMENT),
  promoteMode: requireSeedCliValue(env.PROMOTE_MODE),
  migrationMode: requireSeedCliValue(env.MIGRATION_MODE),
  bootstrapMode: requireSeedCliValue(env.BOOTSTRAP_MODE),
  baseSha: requireSeedCliValue(env.BASE_SHA),
  headSha: requireSeedCliValue(env.HEAD_SHA),
  targetDigest: requireSeedCliValue(env.TARGET_DIGEST),
  configRevision: requireSeedCliValue(env.CONFIG_REVISION),
  configBuilderMode: requireSeedCliValue(env.CONFIG_BUILDER_MODE),
  mainE2EGateMode: requireSeedCliValue(env.MAIN_E2E_GATE_MODE),
  candidateGateMode: requireSeedCliValue(env.CANDIDATE_GATE_MODE),
  backupCapabilityGateMode: requireSeedCliValue(env.BACKUP_CAPABILITY_GATE_MODE),
  backupExecutorMode: requireSeedCliValue(env.BACKUP_EXECUTOR_MODE),
});

export const runStagingLiveConfigPrepare = async (
  env: NodeJS.ProcessEnv = process.env,
  stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr,
  readLiveSnapshot?: () => Promise<LiveServiceSnapshot>
): Promise<StagingLiveConfigSeedPreparation | null> => {
  try {
    const liveSnapshotReader =
      readLiveSnapshot ??
      createStagingLiveConfigSeedLiveReader(requireSeedCliValue(env.QUANTUM_ENDPOINT));
    const preparation = verifyStagingLiveConfigPrepare(
      fromEnvironment(env),
      await liveSnapshotReader()
    );
    if (env.GITHUB_OUTPUT) {
      appendFileSync(env.GITHUB_OUTPUT, `seed_preparation=${JSON.stringify(preparation)}\n`);
    }
    return preparation;
  } catch (error) {
    const failure =
      error instanceof PromoteContractError
        ? error.failure
        : buildPromoteFailure({
            code: 'PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED',
            environment: 'staging',
            phase: 'static-preflight',
          });
    writePromoteFailureRecord(failure, env.PROMOTE_FAILURE_PATH);
    stderr.write(`${failure.code}\n`);
    return null;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runStagingLiveConfigPrepare().then((result) => {
    if (!result) process.exitCode = 1;
  });
}
