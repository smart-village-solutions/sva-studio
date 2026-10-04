export {
  buildPrimaryHostname,
  classifyHost,
  isReservedTenantHostname,
  isValidHostname,
  isValidInstanceId,
  isValidParentDomain,
  normalizeHost,
} from './host.js';
export type { HostClassification } from './host.js';

export const instanceStatuses = [
  'requested',
  'validated',
  'provisioning',
  'active',
  'failed',
  'suspended',
  'archived',
] as const;

export const trafficEnabledInstanceStatuses = ['active'] as const;

export type InstanceStatus = (typeof instanceStatuses)[number];
export type TrafficEnabledInstanceStatus = (typeof trafficEnabledInstanceStatuses)[number];

export type InstanceRegistryRecord = {
  readonly instanceId: string;
  readonly displayName: string;
  readonly timeZone: string;
  readonly status: InstanceStatus;
  readonly parentDomain: string;
  readonly primaryHostname: string;
  readonly realmMode: InstanceRealmMode;
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecretConfigured: boolean;
  readonly tenantAdminClient?: {
    readonly clientId: string;
    readonly secretConfigured: boolean;
  };
  readonly tenantAdminBootstrap?: {
    readonly username: string;
    readonly email?: string;
    readonly firstName?: string;
    readonly lastName?: string;
  };
  readonly themeKey?: string;
  readonly accountInvitationTemplate?: import('./account-invitation-template.js').AccountInvitationTemplate;
  readonly assignedModules: readonly string[];
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly mainserverConfigRef?: string;
  readonly createdAt: string;
  readonly createdBy?: string;
  readonly updatedAt: string;
  readonly updatedBy?: string;
};

export type InstanceRealmMode = 'new' | 'existing';
export type InstanceProvisioningOperation = 'create' | 'activate' | 'suspend' | 'archive';

export type InstanceProvisioningRun = {
  readonly id: string;
  readonly instanceId: string;
  readonly operation: InstanceProvisioningOperation;
  readonly status: InstanceStatus;
  readonly stepKey?: string;
  readonly idempotencyKey: string;
  readonly payloadFingerprint?: string;
  readonly snapshotVersion: string;
  readonly desiredSnapshot: Readonly<Record<string, unknown>>;
  readonly childKeycloakRunId?: string;
  readonly leaseOwner?: string;
  readonly leaseExpiresAt?: string;
  readonly attemptCount: number;
  readonly nextAttemptAt: string;
  readonly deadlineAt: string;
  readonly terminalEvidence: Readonly<Record<string, unknown>>;
  readonly completedAt?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly requestId?: string;
  readonly actorId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type InstanceAuditEvent = {
  readonly id: string;
  readonly instanceId: string;
  readonly eventType:
    | 'instance_requested'
    | 'instance_activated'
    | 'instance_suspended'
    | 'instance_archived'
    | 'instance_reconfigured'
    | 'tenant_iam_access_probed'
    | 'instance_module_assigned'
    | 'instance_module_revoked'
    | 'instance_module_policy_reconciled'
    | 'instance_module_iam_seeded'
    | 'instance_admin_bootstrapped'
    | 'instance_confirmation_accepted'
    | 'instance_confirmation_rejected';
  readonly actorId?: string;
  readonly requestId?: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
};

export type InstanceKeycloakProvisioningIntent =
  'provision' | 'provision_admin_client' | 'reset_tenant_admin' | 'rotate_client_secret';

export type InstanceKeycloakProvisioningRunStatus = 'planned' | 'running' | 'succeeded' | 'failed';

export type InstanceKeycloakProvisioningStepStatus =
  'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'unchanged';

export type InstanceKeycloakCheckStatus = 'ready' | 'warning' | 'blocked';

export type InstanceKeycloakPreflightCheck = {
  readonly checkKey: string;
  readonly title: string;
  readonly status: InstanceKeycloakCheckStatus;
  readonly summary: string;
  readonly details: Readonly<Record<string, unknown>>;
};

export type InstanceKeycloakProvisioningPlanStep = {
  readonly stepKey: string;
  readonly title: string;
  readonly action: 'create' | 'update' | 'verify' | 'skip';
  readonly status: 'ready' | 'blocked';
  readonly summary: string;
  readonly details: Readonly<Record<string, unknown>>;
};

export type InstanceKeycloakProvisioningRunStep = {
  readonly stepKey: string;
  readonly title: string;
  readonly status: InstanceKeycloakProvisioningStepStatus;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly summary: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly requestId?: string;
};

export type InstanceKeycloakProvisioningRun = {
  readonly id: string;
  readonly instanceId: string;
  readonly mutation?: 'executeKeycloakProvisioning' | 'reconcileKeycloak';
  readonly idempotencyKey?: string;
  readonly payloadFingerprint?: string;
  readonly mode: InstanceRealmMode;
  readonly intent: InstanceKeycloakProvisioningIntent;
  readonly overallStatus: InstanceKeycloakProvisioningRunStatus;
  readonly driftSummary: string;
  readonly requestId?: string;
  readonly actorId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly steps: readonly InstanceKeycloakProvisioningRunStep[];
};

export const isInstanceStatus = (value: string): value is InstanceStatus =>
  (instanceStatuses as readonly string[]).includes(value);

export const isTrafficEnabledInstanceStatus = (
  value: InstanceStatus
): value is TrafficEnabledInstanceStatus =>
  (trafficEnabledInstanceStatuses as readonly string[]).includes(value);

const allowedTransitions: Readonly<Record<InstanceStatus, readonly InstanceStatus[]>> = {
  requested: ['validated', 'failed', 'archived'],
  validated: ['provisioning', 'active', 'failed', 'archived'],
  provisioning: ['active', 'failed', 'archived'],
  active: ['suspended', 'archived'],
  failed: ['validated', 'provisioning', 'archived'],
  suspended: ['active', 'archived'],
  archived: [],
};

export const canTransitionInstanceStatus = (from: InstanceStatus, to: InstanceStatus): boolean =>
  from === to || allowedTransitions[from].includes(to);
