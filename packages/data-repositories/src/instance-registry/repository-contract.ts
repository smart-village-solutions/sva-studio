import type {
  InstanceAuditEvent,
  InstanceKeycloakProvisioningRun,
  InstanceKeycloakProvisioningRunStep,
  InstanceProvisioningOperation,
  InstanceProvisioningRun,
  InstanceRegistryRecord,
  InstanceRealmMode,
  InstanceStatus,
} from '@sva/core';

export type CreateKeycloakProvisioningRunResult = {
  readonly run: InstanceKeycloakProvisioningRun;
  readonly created: boolean;
};

export type InstanceConfirmationChallengeRecord = {
  readonly challengeId: string;
  readonly instanceId: string;
  readonly actorId: string;
  readonly actionId: string;
  readonly moduleId?: string;
  readonly stateFingerprint: string;
  readonly expiresAt: string;
  readonly requestId?: string;
  readonly createdAt: string;
};

export type PrepareInstanceConfirmationChallengeInput = Omit<
  InstanceConfirmationChallengeRecord,
  'challengeId' | 'createdAt'
> & { readonly phraseHash: string };

export type ConsumeInstanceConfirmationChallengeInput = {
  readonly challengeId: string;
  readonly instanceId: string;
  readonly actorId: string;
  readonly actionId: string;
  readonly moduleId?: string;
  readonly stateFingerprint: string;
  readonly phraseHash: string;
};

export type InstanceModuleIamContractRecord = {
  readonly moduleId: string;
  readonly permissionIds: readonly string[];
  readonly tenantBootstrapRoles?: readonly {
    readonly roleName: string;
    readonly permissionIds: readonly string[];
  }[];
  readonly rootSystemRoles?: readonly {
    readonly roleName: string;
    readonly permissionIds: readonly string[];
  }[];
  readonly systemRoles?: readonly {
    readonly roleName: string;
    readonly permissionIds: readonly string[];
  }[];
};

export type ProtectedSystemRolePermissionBundleRecord = {
  readonly roleKey: string;
  readonly displayName: string;
  readonly roleLevel: number;
  readonly permissionKeys: readonly string[];
};

export type InstanceRegistryRepository = {
  readonly prepareConfirmationChallenge: (
    input: PrepareInstanceConfirmationChallengeInput
  ) => Promise<InstanceConfirmationChallengeRecord>;
  readonly consumeConfirmationChallenge: (input: ConsumeInstanceConfirmationChallengeInput) => Promise<boolean>;
  readonly listInstances: (input?: {
    search?: string;
    status?: InstanceStatus;
  }) => Promise<readonly InstanceRegistryRecord[]>;
  readonly getInstanceById: (instanceId: string) => Promise<InstanceRegistryRecord | null>;
  readonly listAssignedModules: (instanceId: string) => Promise<readonly string[]>;
  readonly assignModule: (instanceId: string, moduleId: string) => Promise<boolean>;
  readonly revokeModule: (instanceId: string, moduleId: string) => Promise<boolean>;
  readonly syncAssignedModuleIam: (input: {
    instanceId: string;
    managedModuleIds: readonly string[];
    contracts: readonly InstanceModuleIamContractRecord[];
  }) => Promise<void>;
  readonly syncProtectedSystemRolePermissions: (input: {
    instanceId: string;
    role: ProtectedSystemRolePermissionBundleRecord;
  }) => Promise<void>;
  readonly countLocalSystemAdminAssignments: (instanceId: string) => Promise<number>;
  readonly getAuthClientSecretCiphertext: (instanceId: string) => Promise<string | null>;
  readonly getTenantAdminClientSecretCiphertext: (instanceId: string) => Promise<string | null>;
  readonly resolveHostname: (hostname: string) => Promise<InstanceRegistryRecord | null>;
  readonly resolvePrimaryHostname: (hostname: string) => Promise<InstanceRegistryRecord | null>;
  readonly listProvisioningRuns: (instanceId: string) => Promise<readonly InstanceProvisioningRun[]>;
  readonly listLatestProvisioningRuns: (
    instanceIds: readonly string[]
  ) => Promise<Readonly<Record<string, InstanceProvisioningRun | undefined>>>;
  readonly listAuditEvents: (instanceId: string) => Promise<readonly InstanceAuditEvent[]>;
  readonly getLatestTenantIamAccessProbe: (instanceId: string) => Promise<{
    checkedAt: string;
    status: 'ready' | 'degraded' | 'blocked' | 'unknown';
    summary: string;
    errorCode?: string;
    requestId?: string;
  } | null>;
  readonly getRoleReconcileSummary: (instanceId: string) => Promise<{
    status: 'ready' | 'degraded' | 'blocked' | 'unknown';
    summary: string;
    checkedAt?: string;
    errorCode?: string;
    requestId?: string;
  } | null>;
  readonly listKeycloakProvisioningRuns: (
    instanceId: string
  ) => Promise<readonly InstanceKeycloakProvisioningRun[]>;
  readonly getKeycloakProvisioningRun: (
    instanceId: string,
    runId: string
  ) => Promise<InstanceKeycloakProvisioningRun | null>;
  readonly hasKeycloakProvisioningRun: (input: {
    instanceId: string;
    mutation: NonNullable<InstanceKeycloakProvisioningRun['mutation']>;
    intent: InstanceKeycloakProvisioningRun['intent'];
    idempotencyKey: string;
  }) => Promise<boolean>;
  readonly claimNextKeycloakProvisioningRun: (input?: {
    createdAtOrAfter?: string;
  }) => Promise<InstanceKeycloakProvisioningRun | null>;
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
    stepKey?: string;
    actorId?: string;
    requestId?: string;
    errorCode?: string;
    errorMessage?: string;
  }) => Promise<InstanceProvisioningRun>;
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
