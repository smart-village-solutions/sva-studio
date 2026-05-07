import type {
  IamInstanceDetail,
  IamTenantIamAxisStatus,
} from '@sva/core';

import type { useInstances } from '../../../hooks/use-instances';

export const INSTANCE_STATUS_LABELS = {
  requested: 'admin.instances.status.requested',
  validated: 'admin.instances.status.validated',
  provisioning: 'admin.instances.status.provisioning',
  active: 'admin.instances.status.active',
  failed: 'admin.instances.status.failed',
  suspended: 'admin.instances.status.suspended',
  archived: 'admin.instances.status.archived',
} as const;

export type CreateWizardStepKey = 'basics' | 'auth' | 'tenantAdmin' | 'review';
export type InstanceFieldHelpKey =
  | 'realmMode'
  | 'instanceId'
  | 'displayName'
  | 'parentDomain'
  | 'authRealm'
  | 'authClientId'
  | 'authIssuerUrl'
  | 'authClientSecret'
  | 'tenantAdminClientId'
  | 'tenantAdminClientSecret'
  | 'tenantAdminUsername'
  | 'tenantAdminEmail'
  | 'tenantAdminFirstName'
  | 'tenantAdminLastName';

export type WorkflowStepState = 'done' | 'current' | 'blocked' | 'pending';
export type InstanceConfigurationOverallStatus = 'complete' | 'degraded' | 'incomplete' | 'unknown';

export type SetupWorkflowStep = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly status: WorkflowStepState;
  readonly actionLabel?: string;
  readonly action?:
    | 'check_preflight'
    | 'check_keycloak_status'
    | 'plan_provisioning'
    | 'execute_provisioning'
    | 'provision_admin_client'
    | 'rotate_client_secret'
    | 'reset_tenant_admin'
    | 'activate_instance';
};

export type DetailWorkflowAction =
  | NonNullable<SetupWorkflowStep['action']>
  | 'rotate_client_secret'
  | 'probeTenantIamAccess'
  | 'reconcileKeycloak';

export type PrimaryDetailAction = {
  readonly action: DetailWorkflowAction;
  readonly label: string;
};

export type CockpitAnomalyItem = {
  readonly key: string;
  readonly title: string;
  readonly summary: string;
  readonly status: IamTenantIamAxisStatus;
  readonly sourceLabel: string;
  readonly checkedAt?: string;
  readonly requestId?: string;
};

export type InstanceDetailCockpitModel = {
  readonly overallStatus: IamTenantIamAxisStatus;
  readonly overallTitle: string;
  readonly overallSummary: string;
  readonly dominantEvidence: {
    readonly label: string;
    readonly source: string;
    readonly sourceLabel: string;
    readonly checkedAt?: string;
    readonly requestId?: string;
  };
  readonly anomalyQueue: readonly CockpitAnomalyItem[];
  readonly primaryAction: PrimaryDetailAction;
  readonly secondaryActions: readonly PrimaryDetailAction[];
};

export type InstanceConfigurationIssue = {
  readonly key: string;
  readonly label: string;
  readonly severity: 'blocking' | 'warning';
};

export type InstanceConfigurationAssessment = {
  readonly overallStatus: InstanceConfigurationOverallStatus;
  readonly title: string;
  readonly body: string;
  readonly statusLabel: string;
  readonly satisfiedRequirements: number;
  readonly totalRequirements: number;
  readonly blockingIssues: readonly InstanceConfigurationIssue[];
  readonly warningIssues: readonly InstanceConfigurationIssue[];
};

export type RealmOperationsMode = 'new' | 'existing';
export type OperationStepStatus = 'offen' | 'bereit' | 'läuft' | 'erfolgreich' | 'fehlgeschlagen';
export type EvidenceSource =
  | 'registry_contract'
  | 'worker_preflight'
  | 'worker_plan'
  | 'keycloak_run'
  | 'final_validation'
  | 'history';
export type NextActionReason =
  | 'missing_contract'
  | 'mode_conflict'
  | 'preflight_blocked'
  | 'run_retry'
  | 'secret_sync'
  | 'final_validation'
  | 'follow_up';
export type DetailNavigationAction = 'focus_configuration';
export type OperationsDetailAction = DetailWorkflowAction | DetailNavigationAction;
export type OperationsStepKey =
  | 'registry_contract'
  | 'worker_preflight'
  | 'worker_plan'
  | 'realm'
  | 'login_client'
  | 'tenant_admin_client'
  | 'realm_roles'
  | 'tenant_admin'
  | 'secret_sync'
  | 'final_validation'
  | 'realm_bootstrap_complete'
  | 'live_status'
  | 'drift_analysis'
  | 'contract_repair'
  | 'reconcile'
  | 'result_validation';
export type OperationsStepModel = {
  readonly key: OperationsStepKey;
  readonly title: string;
  readonly status: OperationStepStatus;
  readonly summary: string;
  readonly evidenceSource: EvidenceSource;
  readonly checkedAt?: string;
  readonly requestId?: string;
  readonly action?: OperationsDetailAction;
};
export type OperationsPrimaryAction = {
  readonly action: OperationsDetailAction;
  readonly label: string;
  readonly reason: NextActionReason;
};
export type RealmOperationsModel = {
  readonly mode: RealmOperationsMode;
  readonly status: IamTenantIamAxisStatus;
  readonly summary: string;
  readonly steps: readonly OperationsStepModel[];
  readonly followUpActions: readonly OperationsDetailAction[];
  readonly signals: {
    readonly modeConflict: boolean;
    readonly hasDrift: boolean;
  };
};
export type HistoryWorkspaceModel = {
  readonly currentRun?: NonNullable<IamInstanceDetail['latestKeycloakProvisioningRun']>;
  readonly historicalRuns: readonly NonNullable<IamInstanceDetail['keycloakProvisioningRuns']>[number][];
  readonly hasHistoricalMismatchHint: boolean;
};

export type SelectedInstance = NonNullable<ReturnType<typeof useInstances>['selectedInstance']>;
export type CreateFormValues = {
  instanceId: string;
  displayName: string;
  parentDomain: string;
  realmMode: 'new' | 'existing';
  authRealm: string;
  authClientId: string;
  authIssuerUrl: string;
  authClientSecret: string;
  tenantAdminClient: {
    clientId: string;
    secret: string;
  };
  tenantAdminBootstrap: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

export type DetailFormValues = {
  displayName: string;
  parentDomain: string;
  realmMode: IamInstanceDetail['realmMode'];
  authRealm: string;
  authClientId: string;
  authIssuerUrl: string;
  authClientSecret: string;
  tenantAdminClient: {
    clientId: string;
    secret: string;
  };
  tenantAdminBootstrap: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  tenantAdminTemporaryPassword: string;
};

export type PostCreateGuidanceInput = {
  readonly instanceId: string;
  readonly status: IamInstanceDetail['status'];
  readonly primaryHostname: string;
  readonly authRealm: string;
};
