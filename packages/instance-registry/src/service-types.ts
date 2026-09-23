import type {
  InstanceAuditRun,
  InstanceRealmMode,
  InstanceStatus,
  IamInstanceDetail,
  IamInstanceListItem,
  IamTenantIamAxis,
  IamTenantIamStatus,
  WasteManagementDataSourceRecord,
  TenantModuleActivationPolicySnapshot,
  ServerAccountInvitationTemplateView,
} from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type {
  AssignInstanceModuleInput,
  BootstrapAdminStructureInput,
  ChangeInstanceStatusInput,
  ChangeInstanceStatusResult,
  CreateInstanceProvisioningInput,
  CreateInstanceProvisioningResult,
  ExecuteInstanceKeycloakProvisioningInput,
  InstanceModuleMutationResult,
  ReconcileInstanceKeycloakInput,
  RetryTenantProvisioningInput,
  RevokeInstanceModuleInput,
  SeedInstanceIamBaselineInput,
  UpdateInstanceInput,
} from './mutation-types.js';
import type {
  KeycloakTenantPlan,
  KeycloakTenantPreflight,
  KeycloakTenantProvisioningRun,
  KeycloakTenantStatus,
  ResolveRuntimeInstanceResult,
} from './keycloak-types.js';
import type {
  KeycloakProvisioningInput,
  KeycloakReadState,
  TenantAdminBootstrap,
} from './provisioning-auth-types.js';
import type {
  ConsumeInstanceConfirmationChallengeInput,
  InstanceConfirmationChallenge,
  PrepareInstanceConfirmationChallengeInput,
} from './confirmation-challenges.js';
import type { InstanceDraftReadiness } from './service-draft-readiness.js';
import type { RealmCatalog } from './service-realm-catalog.js';
type ModuleActivationPolicyReconcileResult = Awaited<
  ReturnType<InstanceRegistryRepository['reconcileModuleActivationPolicies']>
>;
export type InstanceModuleIamRegistryEntry = {
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
  readonly systemAdminPermissionExclusions?: readonly string[];
};
export type ProvisioningPluginTenantLifecycleContract = Readonly<{
  pluginId: string;
  contractVersion: 1;
  contractRevision: string;
  operations: readonly Readonly<{
    operation: 'provision' | 'reconcile' | 'suspend' | 'reactivate' | 'readiness';
    jobTypeId: string;
    supportsCancellation?: boolean;
  }>[];
  readinessChecks: readonly Readonly<{
    checkId: string;
    titleKey: string;
    required: boolean;
    repairOperation?: 'provision' | 'reconcile' | 'suspend' | 'reactivate';
  }>[];
}>;
type KeycloakProvisioningContext = {
  instanceId: string;
  primaryHostname: string;
  realmMode: InstanceRealmMode;
  authRealm: string;
  authClientId: string;
  authIssuerUrl?: string;
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
  tenantAdminClient?: {
    clientId: string;
    secretConfigured?: boolean;
  };
  tenantAdminClientSecret?: string;
  tenantAdminBootstrap?: TenantAdminBootstrap;
  pluginOidcClients?: KeycloakProvisioningInput['pluginOidcClients'];
};

type KeycloakPlanContext = KeycloakProvisioningContext & {
  realmBaselineApplicable?: boolean;
};
export type InstanceRegistryService = {
  prepareConfirmationChallenge(
    input: PrepareInstanceConfirmationChallengeInput
  ): Promise<InstanceConfirmationChallenge>;
  consumeConfirmationChallenge(input: ConsumeInstanceConfirmationChallengeInput): Promise<boolean>;
  recordConfirmationAttempt(input: {
    instanceId: string;
    actorId: string;
    actionId: string;
    moduleId?: string;
    outcome: 'accepted' | 'rejected';
    reason?: 'confirmation_required' | 'invalid_confirmation';
    requestId?: string;
  }): Promise<void>;
  listInstances(input?: {
    search?: string;
    status?: InstanceStatus;
  }): Promise<readonly IamInstanceListItem[]>;
  getServerAccountInvitationTemplate(): Promise<ServerAccountInvitationTemplateView>;
  updateServerAccountInvitationTemplate(input: {
    expectedRevision: number;
    template: Omit<import('@sva/core').AccountInvitationTemplate, 'revision'> | null;
    actorId?: string;
    requestId?: string;
  }): Promise<ServerAccountInvitationTemplateView>;
  getInstanceDetail(instanceId: string): Promise<IamInstanceDetail | null>;
  createProvisioningRequest(
    input: CreateInstanceProvisioningInput
  ): Promise<CreateInstanceProvisioningResult>;
  getDraftReadiness(input: CreateInstanceProvisioningInput): Promise<InstanceDraftReadiness>;
  listRealmCatalog(input?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<RealmCatalog>;
  retryTenantProvisioning(input: RetryTenantProvisioningInput): Promise<IamInstanceListItem | null>;
  updateInstance(input: UpdateInstanceInput): Promise<IamInstanceDetail | null>;
  changeStatus(input: ChangeInstanceStatusInput): Promise<ChangeInstanceStatusResult>;
  getKeycloakStatus(instanceId: string): Promise<KeycloakTenantStatus | null>;
  getKeycloakPreflight(instanceId: string): Promise<KeycloakTenantPreflight | null>;
  planKeycloakProvisioning(
    instanceId: string,
    options?: { readonly forceLive?: boolean }
  ): Promise<KeycloakTenantPlan | null>;
  executeKeycloakProvisioning(
    input: ExecuteInstanceKeycloakProvisioningInput
  ): Promise<KeycloakTenantProvisioningRun | null>;
  assignModule(input: AssignInstanceModuleInput): Promise<InstanceModuleMutationResult>;
  bootstrapAdminStructure(
    input: BootstrapAdminStructureInput
  ): Promise<InstanceModuleMutationResult>;
  revokeModule(input: RevokeInstanceModuleInput): Promise<InstanceModuleMutationResult>;
  reconcileModuleActivationPolicies(input: {
    instanceId: string;
    actorId?: string;
    requestId?: string;
  }): Promise<{
    changedModuleIds: readonly string[];
    conflictModuleIds: readonly string[];
    unchangedModuleIds: readonly string[];
  }>;
  seedIamBaseline(input: SeedInstanceIamBaselineInput): Promise<InstanceModuleMutationResult>;
  probeTenantIamAccess(input: {
    instanceId: string;
    idempotencyKey: string;
    actorId?: string;
    requestId?: string;
  }): Promise<IamTenantIamStatus | null>;
  getKeycloakProvisioningRun(
    instanceId: string,
    runId: string
  ): Promise<KeycloakTenantProvisioningRun | null>;
  hasKeycloakProvisioningRun(input: {
    instanceId: string;
    mutation: 'executeKeycloakProvisioning';
    intent: 'rotate_client_secret';
    idempotencyKey: string;
  }): Promise<boolean>;
  reconcileKeycloak(input: ReconcileInstanceKeycloakInput): Promise<KeycloakTenantStatus | null>;
  runInstanceAudit(input?: {
    instanceIds?: readonly string[];
    includeOnlyActive?: boolean;
    actorId?: string;
    requestId?: string;
  }): Promise<InstanceAuditRun>;
  resolveRuntimeInstance(host: string): Promise<ResolveRuntimeInstanceResult>;
  isTrafficAllowed(status: InstanceStatus): boolean;
};

export type InstanceRegistryServiceDeps = {
  readonly repository: InstanceRegistryRepository;
  readonly invalidateHost: (hostname: string) => void;
  readonly resolveProvisioningAuthIssuerUrl?: (input: {
    readonly parentDomain: string;
    readonly authRealm: string;
    readonly authIssuerUrl?: string;
  }) => string | undefined;
  readonly isAutomatedTenantProvisioningEnabled?: (input: {
    readonly parentDomain: string;
  }) => boolean;
  readonly publishTenantIngress?: (input: {
    readonly instanceId: string;
    readonly primaryHostname: string;
  }) => Promise<Readonly<{ routerName: string; configHash: string }>>;
  readonly probeTenantEndpoint?: (input: {
    readonly kind: 'ingress' | 'login';
    readonly primaryHostname: string;
    readonly authIssuerUrl: string;
    readonly authClientId: string;
    readonly expectedRouterName: string;
    readonly expectedConfigHash: string;
  }) => Promise<Readonly<Record<string, unknown>>>;
  readonly readProvisioningModuleReadiness?: (input: {
    readonly instanceId: string;
    readonly lifecycles: readonly ProvisioningPluginTenantLifecycleContract[];
  }) => Promise<
    Readonly<{
      status: 'ready' | 'pending' | 'blocked';
      evidence: Readonly<Record<string, unknown>>;
      errorCode?: string;
    }>
  >;
  readonly reservedHostnames?: readonly string[] | (() => readonly string[]);
  readonly reservedOidcClientIds?: readonly string[] | (() => readonly string[]);
  readonly invalidatePermissionSnapshots?: (input: {
    instanceId: string;
    trigger: string;
  }) => Promise<void>;
  readonly syncTenantAdminBootstrapAccount?: (input: {
    instanceId: string;
    tenantAdminBootstrap?: TenantAdminBootstrap;
    tenantAdminClientSecret?: string;
    requestId?: string;
    actorId?: string;
  }) => Promise<void>;
  readonly protectSecret?: (value: string | undefined, aad: string) => string | null;
  readonly revealSecret?: (value: string | null | undefined, aad: string) => string | undefined;
  readonly waitForProvisionedSecretRead?: (delayMs: number) => Promise<void>;
  readonly readKeycloakStateViaProvisioner?: (
    input: KeycloakProvisioningInput
  ) => Promise<KeycloakReadState>;
  readonly listKeycloakRealms?: () => Promise<readonly { readonly realm: string }[]>;
  readonly readKeycloakRealmCreateCapability?: () => Promise<boolean>;
  readonly readPluginOidcClientRequirements?: () => KeycloakProvisioningInput['pluginOidcClients'];
  readonly readRoleCatalogFingerprint?: (instanceId: string) => Promise<string>;
  readonly readKeycloakClientSecretsViaProvisioner?: (
    input: KeycloakProvisioningInput
  ) => Promise<Pick<KeycloakReadState, 'keycloakClientSecret' | 'tenantAdminClientSecret'>>;
  readonly provisionInstanceAuth?: (input: {
    instanceId: string;
    primaryHostname: string;
    realmMode: InstanceRealmMode;
    authRealm: string;
    authClientId: string;
    authIssuerUrl?: string;
    authClientSecret?: string;
    tenantAdminClient?: {
      clientId: string;
      secretConfigured?: boolean;
      secret?: string;
    };
    tenantAdminBootstrap?: TenantAdminBootstrap;
    tenantAdminTemporaryPassword?: string;
    pluginOidcClients?: KeycloakProvisioningInput['pluginOidcClients'];
    rotateClientSecret?: boolean;
    reconcileAuthClient?: boolean;
    reconcileTenantAdminClient?: boolean;
  }) => Promise<void>;
  readonly deleteProvisionedRealm?: (authRealm: string) => Promise<void>;
  readonly getKeycloakPreflight?: (
    input: KeycloakProvisioningContext
  ) => Promise<KeycloakTenantPreflight>;
  readonly planKeycloakProvisioning?: (input: KeycloakPlanContext) => Promise<KeycloakTenantPlan>;
  readonly getKeycloakStatus?: (
    input: KeycloakProvisioningContext
  ) => Promise<KeycloakTenantStatus>;
  readonly withInstanceProvisioningLock?: <T>(
    instanceId: string,
    work: (lockedDeps: InstanceRegistryServiceDeps) => Promise<T>
  ) => Promise<T>;
  readonly listProvisioningRealmAssignments?: () => Promise<
    readonly { readonly instanceId: string; readonly authRealm: string }[]
  >;
  readonly loadWasteDataSourceRecord?: (
    instanceId: string
  ) => Promise<WasteManagementDataSourceRecord | null>;
  readonly saveWasteDataSourceRecord?: (record: WasteManagementDataSourceRecord) => Promise<void>;
  readonly moduleIamRegistry?: ReadonlyMap<string, InstanceModuleIamRegistryEntry>;
  readonly pluginTenantLifecycleRegistry?: ReadonlyMap<
    string,
    ProvisioningPluginTenantLifecycleContract
  >;
  readonly readModuleActivationPolicySnapshot?: () => TenantModuleActivationPolicySnapshot;
  readonly captureModuleActivationPolicyReconcileResult?: (
    result: ModuleActivationPolicyReconcileResult
  ) => void;
  readonly probeTenantIamAccess?: (input: {
    instanceId: string;
    authClientId?: string;
    actorId?: string;
    requestId?: string;
  }) => Promise<IamTenantIamAxis>;
  readonly reconcileTenantIamRoles?: (input: {
    instanceId: string;
    actorId?: string;
    requestId?: string;
    expectedRoleCatalogFingerprint?: string;
  }) => Promise<{
    readonly outcome: 'success' | 'partial_failure' | 'failed';
    readonly checkedCount: number;
    readonly correctedCount: number;
    readonly failedCount: number;
    readonly requiresManualActionCount: number;
  }>;
};
