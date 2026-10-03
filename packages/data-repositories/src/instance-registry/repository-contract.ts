import type {
  InstanceAuditEvent,
  AccountInvitationTemplate,
  ServerAccountInvitationTemplateState,
  InstanceKeycloakProvisioningRun,
  InstanceKeycloakProvisioningRunStep,
  InstanceProvisioningOperation,
  InstanceProvisioningRun,
  InstanceRegistryRecord,
  InstanceRealmMode,
  InstanceStatus,
} from '@sva/core';
import type {
  CreateKeycloakProvisioningRunResult,
  InstanceRegistryInstanceRepository,
} from './repository-contract-instance.js';

export type {
  TenantModuleActivationPolicyInput,
  TenantModuleActivationReconcileResult,
  CreateKeycloakProvisioningRunResult,
  InstanceConfirmationChallengeRecord,
  PrepareInstanceConfirmationChallengeInput,
  ConsumeInstanceConfirmationChallengeInput,
  InstanceModuleIamContractRecord,
  ProtectedSystemRolePermissionBundleRecord,
  PermissionCatalogReconcileResult,
  ModuleActivationRollbackState,
} from './repository-contract-instance.js';

export type InstanceRegistryRepository = InstanceRegistryInstanceRepository & {
  readonly createInstance: (input: {
    instanceId: string;
    displayName: string;
    status: InstanceStatus;
    parentDomain: string;
    primaryHostname: string;
    realmMode: InstanceRealmMode;
    authRealm: string;
    authClientId: string;
    authIssuerUrl?: string;
    authClientSecretCiphertext?: string;
    tenantAdminClient?: {
      clientId: string;
      secretCiphertext?: string;
    };
    tenantAdminBootstrap?: {
      username: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    actorId?: string;
    requestId?: string;
    themeKey?: string;
    featureFlags?: Readonly<Record<string, boolean>>;
    mainserverConfigRef?: string;
  }) => Promise<InstanceRegistryRecord | null>;
  readonly updateInstance: (input: {
    instanceId: string;
    displayName: string;
    parentDomain: string;
    primaryHostname: string;
    realmMode: InstanceRealmMode;
    authRealm: string;
    authClientId: string;
    authIssuerUrl?: string;
    authClientSecretCiphertext?: string;
    keepExistingAuthClientSecret?: boolean;
    tenantAdminClient?: {
      clientId: string;
      secretCiphertext?: string;
    };
    keepExistingTenantAdminClientSecret?: boolean;
    tenantAdminBootstrap?: {
      username: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    actorId?: string;
    requestId?: string;
    themeKey?: string;
    featureFlags?: Readonly<Record<string, boolean>>;
    mainserverConfigRef?: string;
  }) => Promise<InstanceRegistryRecord | null>;
  readonly updateAccountInvitationTemplate: (input: {
    instanceId: string;
    expectedRevision: number;
    template: AccountInvitationTemplate | null;
    actorId?: string;
  }) => Promise<InstanceRegistryRecord | null>;
  readonly getServerAccountInvitationTemplate: () => Promise<ServerAccountInvitationTemplateState>;
  readonly updateServerAccountInvitationTemplate: (input: {
    expectedRevision: number;
    template: AccountInvitationTemplate | null;
    actorId?: string;
  }) => Promise<ServerAccountInvitationTemplateState>;
  readonly updateInstanceKeycloakSecrets: (input: {
    instanceId: string;
    authClientSecretCiphertext?: string;
    keepExistingAuthClientSecret?: boolean;
    tenantAdminClientSecretCiphertext?: string;
    keepExistingTenantAdminClientSecret?: boolean;
    actorId?: string;
    requestId?: string;
  }) => Promise<InstanceRegistryRecord | null>;
  readonly setInstanceStatus: (input: {
    instanceId: string;
    status: InstanceStatus;
    actorId?: string;
    requestId?: string;
  }) => Promise<InstanceRegistryRecord | null>;
  readonly setInstanceRealmMode: (input: {
    instanceId: string;
    realmMode: InstanceRealmMode;
    actorId?: string;
    requestId?: string;
  }) => Promise<InstanceRegistryRecord | null>;
  readonly createProvisioningRun: (input: {
    instanceId: string;
    operation: InstanceProvisioningOperation;
    status: InstanceStatus;
    idempotencyKey: string;
    payloadFingerprint?: string;
    snapshotVersion?: string;
    desiredSnapshot?: Readonly<Record<string, unknown>>;
    deadlineAt?: string;
    stepKey?: string;
    actorId?: string;
    requestId?: string;
    errorCode?: string;
    errorMessage?: string;
  }) => Promise<InstanceProvisioningRun>;
  readonly claimNextProvisioningRun: (input: {
    workerId: string;
    leaseExpiresAt: string;
    parentDomain: string;
  }) => Promise<InstanceProvisioningRun | null>;
  readonly renewProvisioningRunLease: (input: {
    runId: string;
    leaseOwner: string;
    leaseExpiresAt: string;
  }) => Promise<InstanceProvisioningRun | null>;
  readonly updateProvisioningRun: (input: {
    runId: string;
    leaseOwner: string;
    status: InstanceStatus;
    stepKey: string;
    childKeycloakRunId?: string;
    clearChildKeycloakRunId?: boolean;
    nextAttemptAt?: string;
    errorCode?: string;
    errorMessage?: string;
    terminalEvidence?: Readonly<Record<string, unknown>>;
    completedAt?: string;
  }) => Promise<InstanceProvisioningRun | null>;
  readonly confirmProvisioningPlan: (input: {
    runId: string;
    instanceId: string;
    expectedPlanFingerprint: string;
    planFingerprint: string;
    childKeycloakRunId: string;
    actorId?: string;
    requestId?: string;
  }) => Promise<InstanceProvisioningRun | null>;
  readonly bindProvisioningRemediation: (input: {
    runId: string;
    instanceId: string;
    expectedPlanFingerprint: string;
    planFingerprint: string;
    childKeycloakRunId: string;
    actorId?: string;
    requestId?: string;
  }) => Promise<InstanceProvisioningRun | null>;
  readonly completeProvisioningRemediation: (input: {
    instanceId: string;
    childKeycloakRunId: string;
    succeeded: boolean;
  }) => Promise<InstanceProvisioningRun | null>;
  readonly recordProvisioningWakeupFailure: (input: {
    instanceId: string;
    errorCode: string;
    errorMessage: string;
    occurredAt: string;
  }) => Promise<InstanceProvisioningRun | null>;
  readonly reserveProvisioningRetryRun: (input: {
    instanceId: string;
    idempotencyKey: string;
    leaseOwner: string;
    leaseExpiresAt: string;
  }) => Promise<InstanceProvisioningRun | null>;
  readonly renewProvisioningRetryReservation: (input: {
    instanceId: string;
    idempotencyKey: string;
    leaseOwner: string;
    leaseExpiresAt: string;
  }) => Promise<InstanceProvisioningRun | null>;
  readonly releaseProvisioningRetryReservation: (input: {
    instanceId: string;
    idempotencyKey: string;
    leaseOwner: string;
  }) => Promise<InstanceProvisioningRun | null>;
  readonly retryProvisioningRun: (input: {
    instanceId: string;
    idempotencyKey: string;
    leaseOwner: string;
    actorId?: string;
    requestId?: string;
    deadlineAt: string;
    desiredSnapshot: Readonly<Record<string, unknown>>;
    keycloakReconcileRequired: boolean;
  }) => Promise<InstanceProvisioningRun | null>;
  readonly appendAuditEvent: (input: {
    instanceId: string;
    eventType: InstanceAuditEvent['eventType'];
    actorId?: string;
    requestId?: string;
    details?: Readonly<Record<string, unknown>>;
  }) => Promise<void>;
  readonly createKeycloakProvisioningRun: (input: {
    instanceId: string;
    mutation: NonNullable<InstanceKeycloakProvisioningRun['mutation']>;
    idempotencyKey: string;
    payloadFingerprint: string;
    mode: InstanceRealmMode;
    intent: InstanceKeycloakProvisioningRun['intent'];
    overallStatus: InstanceKeycloakProvisioningRun['overallStatus'];
    driftSummary: string;
    actorId?: string;
    requestId?: string;
  }) => Promise<CreateKeycloakProvisioningRunResult>;
  readonly updateKeycloakProvisioningRun: (input: {
    runId: string;
    overallStatus: InstanceKeycloakProvisioningRun['overallStatus'];
    driftSummary?: string;
  }) => Promise<InstanceKeycloakProvisioningRun | null>;
  readonly appendKeycloakProvisioningStep: (input: {
    runId: string;
    stepKey: string;
    title: string;
    status: InstanceKeycloakProvisioningRunStep['status'];
    startedAt?: string;
    finishedAt?: string;
    summary: string;
    details?: Readonly<Record<string, unknown>>;
    requestId?: string;
  }) => Promise<InstanceKeycloakProvisioningRunStep>;
};
