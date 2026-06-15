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
  listInstances(input?: { search?: string; status?: InstanceStatus }): Promise<readonly InstanceRegistryRecord[]>;
  getInstanceById(instanceId: string): Promise<InstanceRegistryRecord | null>;
  listAssignedModules(instanceId: string): Promise<readonly string[]>;
  assignModule(instanceId: string, moduleId: string): Promise<boolean>;
  revokeModule(instanceId: string, moduleId: string): Promise<boolean>;
  syncAssignedModuleIam(input: {
    instanceId: string;
    managedModuleIds: readonly string[];
    contracts: readonly InstanceModuleIamContractRecord[];
  }): Promise<void>;
  syncProtectedSystemRolePermissions(input: {
    instanceId: string;
    role: ProtectedSystemRolePermissionBundleRecord;
  }): Promise<void>;
  countLocalSystemAdminAssignments(instanceId: string): Promise<number>;
  getAuthClientSecretCiphertext(instanceId: string): Promise<string | null>;
  getTenantAdminClientSecretCiphertext(instanceId: string): Promise<string | null>;
  resolveHostname(hostname: string): Promise<InstanceRegistryRecord | null>;
  resolvePrimaryHostname(hostname: string): Promise<InstanceRegistryRecord | null>;
  listProvisioningRuns(instanceId: string): Promise<readonly InstanceProvisioningRun[]>;
  listLatestProvisioningRuns(
    instanceIds: readonly string[]
  ): Promise<Readonly<Record<string, InstanceProvisioningRun | undefined>>>;
  listAuditEvents(instanceId: string): Promise<readonly InstanceAuditEvent[]>;
  getLatestTenantIamAccessProbe(instanceId: string): Promise<{
    checkedAt: string;
    status: 'ready' | 'degraded' | 'blocked' | 'unknown';
    summary: string;
    errorCode?: string;
    requestId?: string;
  } | null>;
  getRoleReconcileSummary(instanceId: string): Promise<{
    status: 'ready' | 'degraded' | 'blocked' | 'unknown';
    summary: string;
    checkedAt?: string;
    errorCode?: string;
    requestId?: string;
  } | null>;
  listKeycloakProvisioningRuns(instanceId: string): Promise<readonly InstanceKeycloakProvisioningRun[]>;
  getKeycloakProvisioningRun(instanceId: string, runId: string): Promise<InstanceKeycloakProvisioningRun | null>;
  claimNextKeycloakProvisioningRun(input?: {
    createdAtOrAfter?: string;
  }): Promise<InstanceKeycloakProvisioningRun | null>;
  createInstance(input: {
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
  }): Promise<InstanceRegistryRecord | null>;
  updateInstance(input: {
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
  }): Promise<InstanceRegistryRecord | null>;
  setInstanceStatus(input: {
    instanceId: string;
    status: InstanceStatus;
    actorId?: string;
    requestId?: string;
  }): Promise<InstanceRegistryRecord | null>;
  createProvisioningRun(input: {
    instanceId: string;
    operation: InstanceProvisioningOperation;
    status: InstanceStatus;
    idempotencyKey: string;
    stepKey?: string;
    actorId?: string;
    requestId?: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<InstanceProvisioningRun>;
  appendAuditEvent(input: {
    instanceId: string;
    eventType: InstanceAuditEvent['eventType'];
    actorId?: string;
    requestId?: string;
    details?: Readonly<Record<string, unknown>>;
  }): Promise<void>;
  createKeycloakProvisioningRun(input: {
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
  }): Promise<CreateKeycloakProvisioningRunResult>;
  updateKeycloakProvisioningRun(input: {
    runId: string;
    overallStatus: InstanceKeycloakProvisioningRun['overallStatus'];
    driftSummary?: string;
  }): Promise<InstanceKeycloakProvisioningRun | null>;
  appendKeycloakProvisioningStep(input: {
    runId: string;
    stepKey: string;
    title: string;
    status: InstanceKeycloakProvisioningRunStep['status'];
    startedAt?: string;
    finishedAt?: string;
    summary: string;
    details?: Readonly<Record<string, unknown>>;
    requestId?: string;
  }): Promise<InstanceKeycloakProvisioningRunStep>;
};
