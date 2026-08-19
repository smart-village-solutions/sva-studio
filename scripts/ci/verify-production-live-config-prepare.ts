#!/usr/bin/env node

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { assertSeedableProductionLiveSnapshot } from './production-live-config-seed-contract.ts';
import {
  validateProductionPrepareRequest,
  type ProductionLiveConfigPrepareRequest,
} from './production-live-config-seed-context.ts';
import {
  createProductionLiveReader,
  requireProductionSeedValue,
} from './production-live-config-seed-io.ts';
import {
  buildPromoteFailure,
  PromoteContractError,
  writePromoteFailureRecord,
} from './promote-result.ts';

export const productionSeedPreparationContract = 'production-live-config-label-prepare-v1' as const;

export type ProductionLiveConfigSeedPreparation = Readonly<{
  contract: typeof productionSeedPreparationContract;
  sourceSha: string;
  imageDigest: string;
  configRevision: string;
  liveConfigRevisionState: 'missing';
  backupExecutor: 'agent';
  shadowEquivalent: true;
}>;

export const verifyProductionLiveConfigPrepare = (
  input: ProductionLiveConfigPrepareRequest,
  snapshot: Readonly<{ image?: string; labels?: Readonly<Record<string, string>> }>
): ProductionLiveConfigSeedPreparation => {
  validateProductionPrepareRequest(input);
  assertSeedableProductionLiveSnapshot(snapshot, input.targetDigest);
  return {
    contract: productionSeedPreparationContract,
    sourceSha: input.headSha,
    imageDigest: input.targetDigest,
    configRevision: input.configRevision,
    liveConfigRevisionState: 'missing',
    backupExecutor: 'agent',
    shadowEquivalent: true,
  };
};

const fromEnvironment = (env: NodeJS.ProcessEnv): ProductionLiveConfigPrepareRequest => ({
  eventName: requireProductionSeedValue(env.GITHUB_EVENT_NAME),
  environment: requireProductionSeedValue(env.PROMOTE_ENVIRONMENT),
  promoteMode: requireProductionSeedValue(env.PROMOTE_MODE),
  migrationMode: requireProductionSeedValue(env.MIGRATION_MODE),
  bootstrapMode: requireProductionSeedValue(env.BOOTSTRAP_MODE),
  baseSha: requireProductionSeedValue(env.BASE_SHA),
  headSha: requireProductionSeedValue(env.HEAD_SHA),
  targetDigest: requireProductionSeedValue(env.TARGET_DIGEST),
  configRevision: requireProductionSeedValue(env.CONFIG_REVISION),
  configBuilderMode: requireProductionSeedValue(env.CONFIG_BUILDER_MODE),
  shadowEquivalent: requireProductionSeedValue(env.CONFIG_SHADOW_EQUIVALENT),
  mainE2EGateMode: requireProductionSeedValue(env.MAIN_E2E_GATE_MODE),
  candidateGateMode: requireProductionSeedValue(env.CANDIDATE_GATE_MODE),
  backupCapabilityGateMode: requireProductionSeedValue(env.BACKUP_CAPABILITY_GATE_MODE),
  backupExecutorMode: requireProductionSeedValue(env.BACKUP_EXECUTOR_MODE),
});

export const runProductionLiveConfigPrepare = async (
  env: NodeJS.ProcessEnv = process.env,
  stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr,
  readLiveSnapshot?: () => Promise<Readonly<{ image?: string; labels?: Record<string, string> }>>
): Promise<ProductionLiveConfigSeedPreparation | null> => {
  try {
    const reader =
      readLiveSnapshot ??
      createProductionLiveReader(requireProductionSeedValue(env.QUANTUM_ENDPOINT));
    const preparation = verifyProductionLiveConfigPrepare(fromEnvironment(env), await reader());
    if (env.GITHUB_OUTPUT)
      appendFileSync(env.GITHUB_OUTPUT, `seed_preparation=${JSON.stringify(preparation)}\n`);
    return preparation;
  } catch (error) {
    const failure =
      error instanceof PromoteContractError
        ? error.failure
        : buildPromoteFailure({
            code: 'PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED',
            environment: 'prod',
            phase: 'static-preflight',
          });
    writePromoteFailureRecord(failure, env.PROMOTE_FAILURE_PATH);
    stderr.write(`${failure.code}\n`);
    return null;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductionLiveConfigPrepare().then((result) => {
    if (!result) process.exitCode = 1;
  });
}
