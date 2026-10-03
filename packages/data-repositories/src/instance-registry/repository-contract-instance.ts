import type {
  InstanceAuditEvent,
  InstanceKeycloakProvisioningRun,
  InstanceProvisioningRun,
  InstanceRegistryRecord,
  InstanceStatus,
  TenantModuleActivationRecord,
  TenantModuleActivationPolicyDescriptor,
} from '@sva/core';
import type { WasteTenantProvisioningRecord } from '@sva/waste-management-contracts';

export type TenantModuleActivationPolicyInput = TenantModuleActivationPolicyDescriptor;

export type TenantModuleActivationReconcileResult = {
  readonly changedModuleIds: readonly string[];
  readonly conflictModuleIds: readonly string[];
  readonly unchangedModuleIds: readonly string[];
};

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
  readonly permissions: readonly {
    readonly key: string;
    readonly description: string;
    readonly resourceType: string;
  }[];
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
  readonly permissions: readonly {
    readonly key: string;
    readonly description: string;
    readonly resourceType: string;
  }[];
  readonly grantPermissionKeys: readonly string[];
};

export type PermissionCatalogReconcileResult = {
  readonly permissionsInserted: number;
  readonly permissionsUpdated: number;
  readonly permissionsUnchanged: number;
  readonly grantsInserted: number;
  readonly grantsUnchanged: number;
};

export type ModuleActivationRollbackState = {
  readonly activationOrigin: TenantModuleActivationRecord['activationOrigin'];
  readonly effectiveActive: boolean;
  readonly manualOverride: TenantModuleActivationRecord['manualOverride'] | null;
  readonly reconcileId: string | null;
  readonly reconciledAt: string | null;
  readonly stateRevision: number;
  readonly updatedBy: string | null;
};

export type InstanceRegistryInstanceRepository = {
  readonly requestWasteProvisioning: (instanceId: string) => Promise<WasteTenantProvisioningRecord>;
  readonly getWasteProvisioning: (
    instanceId: string
  ) => Promise<WasteTenantProvisioningRecord | null>;
  readonly disableWasteProvisioning: (
    instanceId: string
  ) => Promise<WasteTenantProvisioningRecord | null>;
  readonly claimWasteProvisioning: (input: {
    instanceId: string;
    jobId: string;
    desiredGeneration: number;
  }) => Promise<WasteTenantProvisioningRecord | null>;
  readonly completeWasteProvisioning: (input: {
    instanceId: string;
    jobId: string;
    desiredGeneration: number;
    databaseName: string;
    interfaceId: string;
  }) => Promise<WasteTenantProvisioningRecord | null>;
  readonly failWasteProvisioning: (input: {
    instanceId: string;
    jobId: string;
    desiredGeneration: number;
    errorCode: string;
    errorMessage: string;
  }) => Promise<WasteTenantProvisioningRecord | null>;
  readonly failWasteProvisioningRequest: (input: {
    instanceId: string;
    desiredGeneration: number;
    errorCode: string;
    errorMessage: string;
  }) => Promise<WasteTenantProvisioningRecord | null>;
  readonly prepareConfirmationChallenge: (
    input: PrepareInstanceConfirmationChallengeInput
  ) => Promise<InstanceConfirmationChallengeRecord>;
  readonly consumeConfirmationChallenge: (
    input: ConsumeInstanceConfirmationChallengeInput
  ) => Promise<boolean>;
  readonly listInstances: (input?: {
    search?: string;
    status?: InstanceStatus;
  }) => Promise<readonly InstanceRegistryRecord[]>;
  readonly getInstanceById: (instanceId: string) => Promise<InstanceRegistryRecord | null>;
  readonly listAssignedModules: (instanceId: string) => Promise<readonly string[]>;
  readonly listModuleActivations: (
    instanceId: string
  ) => Promise<readonly TenantModuleActivationRecord[]>;
  readonly getModuleActivationPolicy: (
    instanceId: string,
    moduleId: string
  ) => Promise<{
    activationPolicy: TenantModuleActivationPolicyDescriptor['activationPolicy'];
    activationOrigin: TenantModuleActivationRecord['activationOrigin'];
    effectiveActive: boolean;
    manualOverride: TenantModuleActivationRecord['manualOverride'] | null;
    reconcileId: string | null;
    reconciledAt: string | null;
    stateRevision: number;
    updatedBy: string | null;
  } | null>;
  readonly assignModule: (
    instanceId: string,
    moduleId: string,
    lifecycleContractRevision?: string
  ) => Promise<boolean>;
  readonly restoreModuleActivation: (
    instanceId: string,
    moduleId: string,
    previous: ModuleActivationRollbackState | null
  ) => Promise<boolean>;
  readonly revokeModule: (instanceId: string, moduleId: string) => Promise<boolean>;
  readonly reconcileModuleActivationPolicies: (input: {
    instanceId: string;
    policies: readonly TenantModuleActivationPolicyInput[];
    preservedModuleIds: readonly string[];
    reconcileId: string;
    actorId?: string;
  }) => Promise<TenantModuleActivationReconcileResult>;
  readonly bumpPermissionCacheInstanceRevision?: (instanceId: string) => Promise<number>;
  readonly syncAssignedModuleIam: (input: {
    instanceId: string;
    managedModuleIds: readonly string[];
    managedContracts?: readonly InstanceModuleIamContractRecord[];
    contracts: readonly InstanceModuleIamContractRecord[];
  }) => Promise<PermissionCatalogReconcileResult | void>;
  readonly persistPluginTenantLifecycleReconcileIntents: (input: {
    instanceId: string;
    lifecycles: readonly Readonly<{ pluginId: string; contractRevision: string }>[];
    forcePluginIds: readonly string[];
  }) => Promise<readonly string[]>;
  readonly syncProtectedSystemRolePermissions: (input: {
    instanceId: string;
    role: ProtectedSystemRolePermissionBundleRecord;
  }) => Promise<PermissionCatalogReconcileResult | void>;
  readonly countLocalSystemAdminAssignments: (instanceId: string) => Promise<number>;
  readonly getAuthClientSecretCiphertext: (instanceId: string) => Promise<string | null>;
  readonly getTenantAdminClientSecretCiphertext: (instanceId: string) => Promise<string | null>;
  readonly resolveHostname: (hostname: string) => Promise<InstanceRegistryRecord | null>;
  readonly resolvePrimaryHostname: (hostname: string) => Promise<InstanceRegistryRecord | null>;
  readonly listProvisioningRuns: (
    instanceId: string
  ) => Promise<readonly InstanceProvisioningRun[]>;
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
};
