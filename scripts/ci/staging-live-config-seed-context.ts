import { buildPromoteFailure, PromoteContractError } from './promote-result.ts';

const digestPattern = /sha256:[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{64}$/u;
const shaPattern = /^[a-f0-9]{40}$/u;

export type StagingLiveConfigSeedRequest = Readonly<{
  eventName: string;
  environment: string;
  promoteMode: string;
  migrationMode: string;
  bootstrapMode: string;
  baseSha: string;
  headSha: string;
  targetDigest: string;
  configRevision: string;
  runId: string;
  runAttempt: string;
  configBuilderMode: string;
  mainE2EGateMode: string;
  candidateGateMode: string;
  backupCapabilityGateMode: string;
  backupExecutorMode: string;
  currentRunId: string;
  currentRunNumber: string;
  currentRunAttempt: string;
  currentWorkflowSha: string;
}>;

export type StagingLiveConfigPrepareRequest = Omit<
  StagingLiveConfigSeedRequest,
  | 'configRevision'
  | 'runId'
  | 'runAttempt'
  | 'currentRunId'
  | 'currentRunNumber'
  | 'currentRunAttempt'
  | 'currentWorkflowSha'
>;

const rejectSeedContext = (): never => {
  throw new PromoteContractError(
    buildPromoteFailure({
      code: 'PROMOTE_LIVE_CONFIG_SEED_REJECTED',
      environment: 'staging',
      phase: 'static-preflight',
    })
  );
};

export const validateSeedRequest = (input: StagingLiveConfigSeedRequest): void => {
  const checks = [
    input.eventName === 'workflow_dispatch',
    input.environment === 'staging',
    input.promoteMode === 'standard',
    input.migrationMode === 'assert-none',
    input.bootstrapMode === 'assert-none',
    shaPattern.test(input.baseSha ?? ''),
    input.baseSha === input.headSha,
    digestPattern.test(input.targetDigest ?? ''),
    revisionPattern.test(input.configRevision ?? ''),
    /^\d+$/u.test(input.runId ?? ''),
    /^[1-9]\d*$/u.test(input.runAttempt ?? ''),
    input.configBuilderMode === 'authoritative',
    input.mainE2EGateMode === 'enforce',
    input.candidateGateMode === 'enforce',
    input.backupCapabilityGateMode === 'enforce',
    input.backupExecutorMode === 'agent',
    /^\d+$/u.test(input.currentRunId ?? ''),
    /^[1-9]\d*$/u.test(input.currentRunNumber ?? ''),
    /^[1-9]\d*$/u.test(input.currentRunAttempt ?? ''),
    shaPattern.test(input.currentWorkflowSha ?? ''),
  ];
  if (checks.includes(false)) rejectSeedContext();
};

export const validatePrepareRequest = (input: StagingLiveConfigPrepareRequest): void => {
  const checks = [
    input.eventName === 'workflow_dispatch',
    input.environment === 'staging',
    input.promoteMode === 'standard',
    input.migrationMode === 'assert-none',
    input.bootstrapMode === 'assert-none',
    shaPattern.test(input.baseSha ?? ''),
    input.baseSha === input.headSha,
    digestPattern.test(input.targetDigest ?? ''),
    input.configBuilderMode === 'authoritative',
    input.mainE2EGateMode === 'enforce',
    input.candidateGateMode === 'enforce',
    input.backupCapabilityGateMode === 'enforce',
    input.backupExecutorMode === 'agent',
  ];
  if (checks.includes(false)) rejectSeedContext();
};
