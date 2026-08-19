import { buildPromoteFailure, PromoteContractError } from './promote-result.ts';

const digestPattern = /sha256:[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{64}$/u;
const shaPattern = /^[a-f0-9]{40}$/u;

type BaseRequest = Readonly<{
  eventName: string;
  environment: string;
  promoteMode: string;
  migrationMode: string;
  bootstrapMode: string;
  baseSha: string;
  headSha: string;
  targetDigest: string;
  configRevision: string;
  configBuilderMode: string;
  mainE2EGateMode: string;
  candidateGateMode: string;
  backupCapabilityGateMode: string;
  backupExecutorMode: string;
}>;

export type ProductionLiveConfigPrepareRequest = BaseRequest &
  Readonly<{ shadowEquivalent: string }>;

export type ProductionLiveConfigSeedRequest = BaseRequest &
  Readonly<{
    runId: string;
    runAttempt: string;
    currentRunId: string;
    currentRunNumber: string;
    currentRunAttempt: string;
    currentWorkflowSha: string;
  }>;

const reject = (): never => {
  throw new PromoteContractError(
    buildPromoteFailure({
      code: 'PROMOTE_LIVE_CONFIG_SEED_REJECTED',
      environment: 'prod',
      phase: 'static-preflight',
    })
  );
};

const validateBase = (input: BaseRequest): void => {
  const valid =
    input.eventName === 'workflow_dispatch' &&
    input.environment === 'prod' &&
    input.promoteMode === 'standard' &&
    input.migrationMode === 'assert-none' &&
    input.bootstrapMode === 'assert-none' &&
    shaPattern.test(input.baseSha) &&
    input.baseSha === input.headSha &&
    digestPattern.test(input.targetDigest) &&
    revisionPattern.test(input.configRevision) &&
    input.backupExecutorMode === 'agent';
  if (!valid) reject();
};

export const validateProductionPrepareRequest = (
  input: ProductionLiveConfigPrepareRequest
): void => {
  validateBase(input);
  if (
    input.configBuilderMode !== 'shadow' ||
    input.shadowEquivalent !== 'true' ||
    input.mainE2EGateMode !== 'shadow' ||
    input.candidateGateMode !== 'shadow' ||
    input.backupCapabilityGateMode !== 'shadow'
  )
    reject();
};

export const validateProductionSeedRequest = (input: ProductionLiveConfigSeedRequest): void => {
  validateBase(input);
  const valid =
    input.configBuilderMode === 'authoritative' &&
    input.mainE2EGateMode === 'enforce' &&
    input.candidateGateMode === 'enforce' &&
    input.backupCapabilityGateMode === 'enforce' &&
    /^\d+$/u.test(input.runId) &&
    /^[1-9]\d*$/u.test(input.runAttempt) &&
    /^\d+$/u.test(input.currentRunId) &&
    /^[1-9]\d*$/u.test(input.currentRunNumber) &&
    /^[1-9]\d*$/u.test(input.currentRunAttempt) &&
    shaPattern.test(input.currentWorkflowSha);
  if (!valid) reject();
};
