import type { PromoteEnvironment, PromoteFailure, PromotePhase } from './promote-result.ts';

export type PromoteGateStatus = 'passed' | 'failed' | 'cancelled' | 'skipped';
export type PromoteEvidenceStatus = 'passed' | 'failed' | 'cancelled';
export type PromoteGateName =
  | 'workspace-setup'
  | 'input-validation'
  | 'permission-snapshot-secret'
  | 'worker-database-secret'
  | 'source-preparation'
  | 'source-contract'
  | 'deployment-base'
  | 'registry-login'
  | 'image-contract'
  | 'main-e2e-evidence'
  | 'legacy-config-seed-preparation'
  | 'legacy-config-seed'
  | 'legacy-config-seed-recheck'
  | 'production-config-seed-preparation'
  | 'production-config-seed'
  | 'production-config-seed-prepare-stop'
  | 'production-config-seed-recheck'
  | 'recovery-contract'
  | 'config-build'
  | 'config-revision-contract'
  | 'worker-database-secret-injection'
  | 'change-policy-evaluation'
  | 'migration-bootstrap-policy'
  | 'deployment-tooling'
  | 'target-resolution'
  | 'readiness'
  | 'candidate-preflight'
  | 'staging-parity'
  | 'previous-live-capture'
  | 'backup-capabilities'
  | 'studio-backup-request'
  | 'waste-backup-request'
  | 'temporary-backup'
  | 'studio-backup-verification'
  | 'waste-backup-verification'
  | 'migration'
  | 'bootstrap'
  | 'postconditions'
  | 'deploy'
  | 'swarm-convergence'
  | 'runtime-smoke'
  | 'digest-verification'
  | 'staging-parity-evidence'
  | 'staging-parity-upload'
  | 'one-shot-evidence-upload'
  | 'config-cleanup';

export type PromoteGateEvidence = Readonly<{
  gate: PromoteGateName;
  phase: PromotePhase;
  status: PromoteGateStatus;
  blocking: boolean;
  failure?: PromoteFailure;
}>;

export type PromoteBackupAgentEvidence = Readonly<{
  agentRevision: string;
  protocolVersions: readonly number[];
  databaseTargets: readonly string[];
  resultFields: readonly string[];
  wasteInventory: boolean;
}>;

export type PromoteMainE2EReference = Readonly<{
  run: Readonly<{ id: string; attempt: number }>;
  headSha: string;
  result: 'success';
  testOutcome: 'success';
  evidenceClass: 'canonical-main';
}>;

export type PromoteRecoveryEvidence = Readonly<{
  mode: 'recovery';
  reasonRecorded: true;
  previousDigest: string;
  previousConfigRevision: string;
  sameDigestRetry: Readonly<{
    authorization: 'documented-cause';
    previousFailureCode: null;
  }> | null;
}>;

export type PromoteSeedAuthorization = Readonly<{
  authorization: 'staging-legacy-config-label-v1' | 'production-legacy-config-label-v1';
  evidenceRun: Readonly<{ id: string; attempt: number }>;
  sourceSha: string;
  imageDigest: string;
  configRevision: string;
}>;

export type PromoteSeedPreparation = Readonly<{
  contract: 'staging-live-config-label-prepare-v1' | 'production-live-config-label-prepare-v1';
  sourceSha: string;
  imageDigest: string;
  configRevision: string;
  liveConfigRevisionState: 'missing';
  backupExecutor: 'agent';
  shadowEquivalent?: true;
}>;

export type PromoteEvidence = Readonly<{
  schemaVersion: 2;
  run: Readonly<{ id: string; attempt: number }>;
  environment: PromoteEnvironment;
  status: PromoteEvidenceStatus;
  mode: 'standard' | 'recovery' | 'invalid';
  recoveryReasonProvided: boolean;
  git: Readonly<{
    baseRef: string;
    headRef: string;
    baseSha: string | null;
    headSha: string | null;
  }>;
  image: Readonly<{
    previousDigest: string | null;
    targetDigest: string | null;
    revision: string | null;
  }>;
  config: Readonly<{
    previousRevision: string | null;
    revision: string | null;
    externalSecretReferences: readonly string[];
  }>;
  backupAgent: PromoteBackupAgentEvidence | null;
  mainE2E: PromoteMainE2EReference | null;
  rollback: Readonly<{
    imageDigest: string;
    configRevision: string;
  }> | null;
  recovery: PromoteRecoveryEvidence | null;
  seedPreparation: PromoteSeedPreparation | null;
  seedAuthorization: PromoteSeedAuthorization | null;
  gates: readonly PromoteGateEvidence[];
  terminalFailure: PromoteFailure | null;
}>;

export type BuildPromoteEvidenceInput = Readonly<{
  runId: string;
  runAttempt: number;
  environment: PromoteEnvironment;
  status: PromoteEvidenceStatus;
  promoteMode?: string | null;
  recoveryReasonProvided?: boolean | string | null;
  baseRef: string;
  headRef: string;
  baseSha?: string | null;
  headSha?: string | null;
  previousImage?: string | null;
  targetImage?: string | null;
  imageRevision?: string | null;
  configRevision?: string | null;
  previousConfigRevision?: string | null;
  externalSecretReferences?: readonly string[];
  backupAgent?: PromoteBackupAgentEvidence | null;
  mainE2EReference?: unknown;
  recoveryContract?: unknown;
  seedPreparation?: unknown;
  seedAuthorization?: unknown;
  gates: readonly Readonly<{
    gate: PromoteGateName;
    phase: PromotePhase;
    status: PromoteGateStatus;
    blocking?: boolean;
  }>[];
  recordedFailure?: PromoteFailure | null;
}>;
