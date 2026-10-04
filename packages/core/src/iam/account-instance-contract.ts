export type InstanceStatus =
  'requested' | 'validated' | 'provisioning' | 'active' | 'failed' | 'suspended' | 'archived';

export type InstanceRealmMode = 'new' | 'existing';

export type IamInstanceProvisioningOperation = 'create' | 'activate' | 'suspend' | 'archive';

export type IamInstanceProvisioningRun = {
  readonly id: string;
  readonly instanceId: string;
  readonly operation: IamInstanceProvisioningOperation;
  readonly status: InstanceStatus;
  readonly stepKey?: string;
  readonly idempotencyKey: string;
  readonly snapshotVersion: string;
  readonly desiredSnapshot: Readonly<Record<string, unknown>>;
  readonly childKeycloakRunId?: string;
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

export type IamInstanceAuditEvent = {
  readonly id: string;
  readonly instanceId: string;
  readonly eventType: string;
  readonly actorId?: string;
  readonly requestId?: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
};

export type IamInstanceListItem = {
  readonly instanceId: string;
  readonly displayName: string;
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
  readonly accountInvitationTemplate?: import('../instances/account-invitation-template.js').AccountInvitationTemplate;
  readonly assignedModules: readonly string[];
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly mainserverConfigRef?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly latestProvisioningRun?: IamInstanceProvisioningRun;
};

export type IamInstanceKeycloakStatus = {
  readonly realmExists: boolean;
  readonly clientExists: boolean;
  readonly tenantAdminClientExists: boolean;
  readonly systemAdminRoleExists: boolean;
  readonly tenantAdminExists: boolean;
  readonly tenantAdminHasSystemAdmin: boolean;
  readonly redirectUrisMatch: boolean;
  readonly logoutUrisMatch: boolean;
  readonly webOriginsMatch: boolean;
  readonly pluginOidcClientsAligned: boolean;
  readonly clientSecretConfigured: boolean;
  readonly tenantClientSecretReadable: boolean;
  readonly clientSecretAligned: boolean;
  readonly tenantAdminClientSecretConfigured: boolean;
  readonly tenantAdminClientSecretReadable: boolean;
  readonly tenantAdminClientSecretAligned: boolean;
  readonly runtimeSecretSource: 'tenant' | 'global';
  readonly realmBaselineAligned?: boolean;
  readonly userProfileBaselineAligned?: boolean;
  readonly instanceIdMapperAligned?: boolean;
  readonly smtpPasswordConfigured?: boolean;
};

export const instanceAuditCheckStatuses = ['pass', 'fail', 'warn', 'skip'] as const;

export type InstanceAuditCheckStatus = (typeof instanceAuditCheckStatuses)[number];

export const instanceAuditCheckScopes = [
  'instance',
  'registry',
  'keycloak',
  'localIam',
  'run',
] as const;

export type InstanceAuditCheckScope = (typeof instanceAuditCheckScopes)[number];

export type InstanceAuditCheck = {
  readonly checkId: string;
  readonly title: string;
  readonly scope: InstanceAuditCheckScope;
  readonly status: InstanceAuditCheckStatus;
  readonly expected: string;
  readonly actual: string;
  readonly evidenceSource: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly remediationHint?: string;
};

export type InstanceAuditInstanceResult = {
  readonly instanceId: string;
  readonly displayName: string;
  readonly status: InstanceStatus;
  readonly primaryHostname: string;
  readonly overallStatus: InstanceAuditCheckStatus;
  readonly checks: readonly InstanceAuditCheck[];
};

export type InstanceAuditRun = {
  readonly generatedAt: string;
  readonly requestId?: string;
  readonly actorId?: string;
  readonly includeOnlyActive: boolean;
  readonly targetInstanceIds: readonly string[];
  readonly overallStatus: InstanceAuditCheckStatus;
  readonly summary: {
    readonly totalInstances: number;
    readonly passCount: number;
    readonly failCount: number;
    readonly warnCount: number;
    readonly skipCount: number;
  };
  readonly checks: readonly InstanceAuditCheck[];
  readonly instances: readonly InstanceAuditInstanceResult[];
};

export type IamInstanceKeycloakPreflight = {
  readonly overallStatus: 'ready' | 'warning' | 'blocked';
  readonly checkedAt: string;
  readonly checks: readonly {
    readonly checkKey: string;
    readonly title: string;
    readonly status: 'ready' | 'warning' | 'blocked';
    readonly summary: string;
    readonly details: Readonly<Record<string, unknown>>;
  }[];
};

export type IamInstanceKeycloakPlan = {
  readonly contractVersion: '1.0';
  readonly fingerprint: string;
  readonly mode: InstanceRealmMode;
  readonly overallStatus: 'ready' | 'blocked';
  readonly generatedAt: string;
  readonly driftSummary: string;
  readonly steps: readonly {
    readonly stepKey: string;
    readonly title: string;
    readonly action: 'create' | 'update' | 'verify' | 'skip';
    readonly status: 'ready' | 'blocked';
    readonly summary: string;
    readonly details: Readonly<Record<string, unknown>>;
  }[];
};

export type IamInstanceKeycloakProvisioningRun = {
  readonly id: string;
  readonly instanceId: string;
  readonly mode: InstanceRealmMode;
  readonly intent:
    'provision' | 'provision_admin_client' | 'reset_tenant_admin' | 'rotate_client_secret';
  readonly overallStatus: 'planned' | 'running' | 'succeeded' | 'failed';
  readonly driftSummary: string;
  readonly requestId?: string;
  readonly actorId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly steps: readonly {
    readonly stepKey: string;
    readonly title: string;
    readonly status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'unchanged';
    readonly startedAt?: string;
    readonly finishedAt?: string;
    readonly summary: string;
    readonly details: Readonly<Record<string, unknown>>;
    readonly requestId?: string;
  }[];
};
