import type { TenantModuleActivationRecord } from '../instances/module-activation.js';
import type {
  InstanceRealmMode,
  IamInstanceAuditEvent,
  IamInstanceKeycloakPlan,
  IamInstanceKeycloakPreflight,
  IamInstanceKeycloakProvisioningRun,
  IamInstanceKeycloakStatus,
  IamInstanceListItem,
  IamInstanceProvisioningRun,
} from './account-instance-contract.js';

export const iamTenantIamAxisStatuses = ['ready', 'degraded', 'blocked', 'unknown'] as const;

export type IamTenantIamAxisStatus = (typeof iamTenantIamAxisStatuses)[number];

export const iamTenantIamSources = [
  'registry',
  'keycloak_status_snapshot',
  'keycloak_provisioning_run',
  'role_reconcile',
  'access_probe',
] as const;

export type IamTenantIamSource = (typeof iamTenantIamSources)[number];

export const iamKeycloakServiceIdentities = [
  'sva-studio-provisioner',
  'sva-studio-tenant-iam',
] as const;

export type IamKeycloakServiceIdentity = (typeof iamKeycloakServiceIdentities)[number];

export const iamTenantIamEvidenceClassifications = [
  'ready',
  'missing',
  'forbidden',
  'unknown',
  'unavailable',
  'misconfigured',
] as const;

export type IamTenantIamEvidenceClassification =
  (typeof iamTenantIamEvidenceClassifications)[number];

export type IamTenantIamAxis = {
  readonly status: IamTenantIamAxisStatus;
  readonly summary: string;
  readonly source: IamTenantIamSource;
  readonly serviceIdentity?: IamKeycloakServiceIdentity;
  readonly classification?: IamTenantIamEvidenceClassification;
  readonly checkedAt?: string;
  readonly errorCode?: string;
  readonly requestId?: string;
};

export type IamTenantIamStatus = {
  readonly configuration: IamTenantIamAxis;
  readonly access: IamTenantIamAxis;
  readonly reconcile: IamTenantIamAxis;
  readonly overall: IamTenantIamAxis;
};

export type IamInstanceAssignedModule = {
  readonly moduleId: string;
  readonly permissionIds: readonly string[];
  readonly systemRoleNames: readonly string[];
};

export type IamInstanceModuleIamModuleStatus = {
  readonly moduleId: string;
  readonly status: IamTenantIamAxisStatus;
  readonly summary: string;
  readonly source: IamTenantIamSource;
  readonly permissionIds: readonly string[];
  readonly systemRoleNames: readonly string[];
};

export type IamInstanceModuleIamStatus = {
  readonly overall: IamTenantIamAxis;
  readonly modules: readonly IamInstanceModuleIamModuleStatus[];
};

export type IamInstanceProvisioningCapabilityKey =
  'worker' | 'queue' | 'callback' | 'provisioner' | 'ingress' | 'plugin';

export type IamInstanceProvisioningCapability = {
  readonly capability: IamInstanceProvisioningCapabilityKey;
  readonly status: 'ready' | 'waiting' | 'blocked' | 'unknown' | 'not_required';
  readonly reasonCode: string;
  readonly summary: string;
  readonly impact: 'provisioning' | 'activation';
  readonly remediation: string;
  readonly responsibility: 'studio_admin' | 'platform_operator';
  readonly nextCheck: 'draft_readiness' | 'instance_detail';
};

export type IamInstanceProvisioningReadiness = {
  readonly state:
    'provisioning_waiting' | 'provisioning_blocked' | 'awaiting_activation' | 'ready' | 'unknown';
  readonly capabilities: readonly IamInstanceProvisioningCapability[];
  readonly nextAction: Readonly<{
    action:
      | 'instance.readiness.refresh'
      | 'instance.keycloak.execute'
      | 'instance.secret.rotate'
      | 'instance.provisioning.retry'
      | 'instance.diagnose'
      | 'instance.tenant-iam.probe'
      | 'instance.tenant-iam.reconcile'
      | 'instance.status.activate';
    retryClass: 'never' | 'safe' | 'conditional';
    runId?: string;
  }> | null;
};

export type IamInstanceRealmCatalogEntry = Readonly<{
  realm: string;
  status: 'selectable' | 'disabled';
  reasonCode?: 'system_realm' | 'already_assigned';
  assignedInstanceId?: string;
}>;

export type IamInstanceRealmCatalog = Readonly<{
  data: readonly IamInstanceRealmCatalogEntry[];
  page: number;
  pageSize: number;
  total: number;
}>;

export type IamInstanceDraftReadiness = Readonly<{
  checkedAt: string;
  contractVersion: '1.0';
  draftFingerprint: string;
  normalizedDraft: Readonly<{
    instanceId: string;
    primaryHostname: string;
    realmMode: InstanceRealmMode;
    authRealm: string;
    authClientId: string;
    authClientSecretConfigured: boolean;
  }>;
  createBlockers: readonly IamInstanceKeycloakPreflight['checks'][number][];
  provisioningBlockers: readonly IamInstanceKeycloakPreflight['checks'][number][];
  activationBlockers: readonly IamInstanceKeycloakPreflight['checks'][number][];
  backgroundCapabilities: readonly IamInstanceProvisioningCapability[];
  preflight: IamInstanceKeycloakPreflight;
  realmSuitability?: Readonly<{
    classification: 'ready' | 'auto_completable' | 'manual_resolution_required';
    reasonCode: string;
    impact: 'create' | 'provisioning' | 'activation';
    remediation: string;
    responsibility: 'studio_admin' | 'platform_operator';
    nextCheck: 'draft_readiness';
    plan: IamInstanceKeycloakPlan;
  }>;
}>;

export type IamInstanceDetail = IamInstanceListItem & {
  readonly effectiveAccountInvitationTemplate: import('../instances/account-invitation-template.js').AccountInvitationTemplate;
  readonly accountInvitationTemplateSource: import('../instances/account-invitation-template.js').AccountInvitationTemplateSource;
  readonly serverAccountInvitationTemplateRevision: number;
  readonly hostnames: readonly {
    readonly hostname: string;
    readonly isPrimary: boolean;
    readonly createdAt: string;
  }[];
  readonly provisioningRuns: readonly IamInstanceProvisioningRun[];
  readonly auditEvents: readonly IamInstanceAuditEvent[];
  readonly keycloakStatus?: IamInstanceKeycloakStatus;
  readonly keycloakPreflight?: IamInstanceKeycloakPreflight;
  readonly keycloakPlan?: IamInstanceKeycloakPlan;
  readonly latestKeycloakProvisioningRun?: IamInstanceKeycloakProvisioningRun;
  readonly keycloakProvisioningRuns: readonly IamInstanceKeycloakProvisioningRun[];
  readonly tenantIamStatus?: IamTenantIamStatus;
  readonly moduleIamStatus?: IamInstanceModuleIamStatus;
  readonly provisioningReadiness?: IamInstanceProvisioningReadiness;
  readonly moduleActivations: readonly TenantModuleActivationRecord[];
};
