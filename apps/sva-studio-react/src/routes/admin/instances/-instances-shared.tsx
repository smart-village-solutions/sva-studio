import {
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  isInstanceKeycloakRequirementSatisfied,
  type IamInstanceDetail,
  type IamInstanceKeycloakPreflight,
  type IamTenantIamStatus,
  type IamTenantIamAxisStatus,
} from '@sva/core';

import { Badge } from '../../../components/ui/badge';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
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

export type CreateFormValues = ReturnType<typeof createEmptyCreateForm>;

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

type IamInstanceKeycloakStatus = NonNullable<IamInstanceDetail['keycloakStatus']>;
type InstanceKeycloakRequirement = (typeof INSTANCE_KEYCLOAK_REQUIREMENTS)[number];
type InstanceKeycloakStatusField = InstanceKeycloakRequirement['statusField'];

const CONFIGURATION_STATUS_LABELS = {
  complete: 'admin.instances.configuration.overall.complete',
  degraded: 'admin.instances.configuration.overall.degraded',
  incomplete: 'admin.instances.configuration.overall.incomplete',
  unknown: 'admin.instances.configuration.overall.unknown',
} as const satisfies Record<InstanceConfigurationOverallStatus, string>;

const COCKPIT_STATUS_PRECEDENCE = ['blocked', 'degraded', 'unknown', 'ready'] as const satisfies readonly IamTenantIamAxisStatus[];
const TENANT_IAM_STATUS_PRECEDENCE = ['blocked', 'degraded', 'unknown', 'ready'] as const satisfies readonly IamTenantIamAxisStatus[];

const TENANT_IAM_AXIS_LABELS = {
  configuration: 'admin.instances.cockpit.anomalies.configuration',
  access: 'admin.instances.cockpit.anomalies.access',
  reconcile: 'admin.instances.cockpit.anomalies.reconcile',
} as const;

const KEYCLOAK_STATUS_LABELS = {
  realmExists: 'admin.instances.keycloakStatus.realmExists',
  clientExists: 'admin.instances.keycloakStatus.clientExists',
  tenantAdminClientExists: 'admin.instances.keycloakStatus.tenantAdminClientExists',
  instanceIdMapperExists: 'admin.instances.keycloakStatus.instanceIdMapperExists',
  tenantAdminExists: 'admin.instances.keycloakStatus.tenantAdminExists',
  tenantAdminHasSystemAdmin: 'admin.instances.keycloakStatus.tenantAdminHasSystemAdmin',
  tenantAdminHasInstanceRegistryAdmin: 'admin.instances.keycloakStatus.tenantAdminHasInstanceRegistryAdmin',
  tenantAdminInstanceIdMatches: 'admin.instances.keycloakStatus.tenantAdminInstanceIdMatches',
  redirectUrisMatch: 'admin.instances.keycloakStatus.redirectUrisMatch',
  logoutUrisMatch: 'admin.instances.keycloakStatus.logoutUrisMatch',
  webOriginsMatch: 'admin.instances.keycloakStatus.webOriginsMatch',
  clientSecretConfigured: 'admin.instances.keycloakStatus.clientSecretConfigured',
  tenantClientSecretReadable: 'admin.instances.keycloakStatus.tenantClientSecretReadable',
  clientSecretAligned: 'admin.instances.keycloakStatus.clientSecretAligned',
  tenantAdminClientSecretConfigured: 'admin.instances.keycloakStatus.tenantAdminClientSecretConfigured',
  tenantAdminClientSecretReadable: 'admin.instances.keycloakStatus.tenantAdminClientSecretReadable',
  tenantAdminClientSecretAligned: 'admin.instances.keycloakStatus.tenantAdminClientSecretAligned',
} as const satisfies Record<InstanceKeycloakStatusField, string>;

export const isTenantSecretUserInputRequired = (realmMode: 'new' | 'existing') => realmMode === 'existing';

export const readSuggestedParentDomain = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return new URL(window.location.href).hostname;
  } catch {
    return '';
  }
};

export const getErrorMessage = (error: IamHttpError | null) => {
  if (!error) {
    return t('admin.instances.messages.error');
  }

  if (error.diagnosticStatus === 'recovery_laeuft') {
    return t('admin.instances.errors.recoveryRunning');
  }

  switch (error.classification) {
    case 'registry_or_provisioning_drift':
      return t('admin.instances.errors.registryOrProvisioningDrift');
    case 'keycloak_reconcile':
      return t('admin.instances.errors.keycloakReconcile');
    case 'database_or_schema_drift':
      return t('admin.instances.errors.databaseOrSchemaDrift');
    default:
      break;
  }

  switch (error.code) {
    case 'unauthorized':
      return t('admin.instances.errors.unauthorized');
    case 'forbidden':
      return t('admin.instances.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.instances.errors.csrfValidationFailed');
    case 'reauth_required':
      return t('admin.instances.errors.reauthRequired');
    case 'conflict':
      return t('admin.instances.errors.conflict');
    case 'database_unavailable':
      return t('admin.instances.errors.databaseUnavailable');
    case 'tenant_auth_client_secret_missing':
      return t('admin.instances.errors.tenantAuthClientSecretMissing');
    case 'tenant_admin_client_not_configured':
      return t('admin.instances.errors.tenantAdminClientNotConfigured');
    case 'tenant_admin_client_secret_missing':
      return t('admin.instances.errors.tenantAdminClientSecretMissing');
    case 'keycloak_unavailable':
      return t('admin.instances.errors.keycloakUnavailable');
    case 'encryption_not_configured':
      return t('admin.instances.errors.encryptionNotConfigured');
    default:
      return t('admin.instances.messages.error');
  }
};

export const createEmptyTenantAdminBootstrap = () => ({
  username: '',
  email: '',
  firstName: '',
  lastName: '',
});

export const createEmptyCreateForm = (parentDomain = '') => ({
  instanceId: '',
  displayName: '',
  parentDomain,
  realmMode: 'existing' as 'new' | 'existing',
  authRealm: '',
  authClientId: 'sva-studio',
  authIssuerUrl: '',
  authClientSecret: '',
  tenantAdminBootstrap: createEmptyTenantAdminBootstrap(),
});

export const createDetailForm = (instance: NonNullable<ReturnType<typeof useInstances>['selectedInstance']>) => ({
  displayName: instance.displayName,
  parentDomain: instance.parentDomain,
  realmMode: instance.realmMode,
  authRealm: instance.authRealm,
  authClientId: instance.authClientId,
  authIssuerUrl: instance.authIssuerUrl ?? '',
  authClientSecret: '',
  tenantAdminClient: {
    clientId: instance.tenantAdminClient?.clientId ?? '',
    secret: '',
  },
  tenantAdminBootstrap: {
    username: instance.tenantAdminBootstrap?.username ?? '',
    email: instance.tenantAdminBootstrap?.email ?? '',
    firstName: instance.tenantAdminBootstrap?.firstName ?? '',
    lastName: instance.tenantAdminBootstrap?.lastName ?? '',
  },
  tenantAdminTemporaryPassword: '',
});

export const CREATE_WIZARD_STEPS: readonly { key: CreateWizardStepKey; title: string; description: string }[] = [
  {
    key: 'basics',
    title: t('admin.instances.wizard.steps.basics.title'),
    description: t('admin.instances.wizard.steps.basics.description'),
  },
  {
    key: 'auth',
    title: t('admin.instances.wizard.steps.auth.title'),
    description: t('admin.instances.wizard.steps.auth.description'),
  },
  {
    key: 'tenantAdmin',
    title: t('admin.instances.wizard.steps.tenantAdmin.title'),
    description: t('admin.instances.wizard.steps.tenantAdmin.description'),
  },
  {
    key: 'review',
    title: t('admin.instances.wizard.steps.review.title'),
    description: t('admin.instances.wizard.steps.review.description'),
  },
] as const;

export const INSTANCE_FIELD_HELP: Record<
  InstanceFieldHelpKey,
  {
    readonly title: string;
    readonly what: string;
    readonly value: string;
    readonly source: string;
    readonly impact: string;
    readonly defaultHint?: string;
  }
> = {
  realmMode: {
    title: t('admin.instances.help.realmMode.title'),
    what: t('admin.instances.help.realmMode.what'),
    value: t('admin.instances.help.realmMode.value'),
    source: t('admin.instances.help.realmMode.source'),
    impact: t('admin.instances.help.realmMode.impact'),
    defaultHint: t('admin.instances.help.realmMode.defaultHint'),
  },
  instanceId: {
    title: t('admin.instances.help.instanceId.title'),
    what: t('admin.instances.help.instanceId.what'),
    value: t('admin.instances.help.instanceId.value'),
    source: t('admin.instances.help.instanceId.source'),
    impact: t('admin.instances.help.instanceId.impact'),
  },
  displayName: {
    title: t('admin.instances.help.displayName.title'),
    what: t('admin.instances.help.displayName.what'),
    value: t('admin.instances.help.displayName.value'),
    source: t('admin.instances.help.displayName.source'),
    impact: t('admin.instances.help.displayName.impact'),
  },
  parentDomain: {
    title: t('admin.instances.help.parentDomain.title'),
    what: t('admin.instances.help.parentDomain.what'),
    value: t('admin.instances.help.parentDomain.value'),
    source: t('admin.instances.help.parentDomain.source'),
    impact: t('admin.instances.help.parentDomain.impact'),
    defaultHint: t('admin.instances.help.parentDomain.defaultHint'),
  },
  authRealm: {
    title: t('admin.instances.help.authRealm.title'),
    what: t('admin.instances.help.authRealm.what'),
    value: t('admin.instances.help.authRealm.value'),
    source: t('admin.instances.help.authRealm.source'),
    impact: t('admin.instances.help.authRealm.impact'),
  },
  authClientId: {
    title: t('admin.instances.help.authClientId.title'),
    what: t('admin.instances.help.authClientId.what'),
    value: t('admin.instances.help.authClientId.value'),
    source: t('admin.instances.help.authClientId.source'),
    impact: t('admin.instances.help.authClientId.impact'),
    defaultHint: t('admin.instances.help.authClientId.defaultHint'),
  },
  authIssuerUrl: {
    title: t('admin.instances.help.authIssuerUrl.title'),
    what: t('admin.instances.help.authIssuerUrl.what'),
    value: t('admin.instances.help.authIssuerUrl.value'),
    source: t('admin.instances.help.authIssuerUrl.source'),
    impact: t('admin.instances.help.authIssuerUrl.impact'),
    defaultHint: t('admin.instances.help.authIssuerUrl.defaultHint'),
  },
  authClientSecret: {
    title: t('admin.instances.help.authClientSecret.title'),
    what: t('admin.instances.help.authClientSecret.what'),
    value: t('admin.instances.help.authClientSecret.value'),
    source: t('admin.instances.help.authClientSecret.source'),
    impact: t('admin.instances.help.authClientSecret.impact'),
  },
  tenantAdminClientId: {
    title: t('admin.instances.help.tenantAdminClientId.title'),
    what: t('admin.instances.help.tenantAdminClientId.what'),
    value: t('admin.instances.help.tenantAdminClientId.value'),
    source: t('admin.instances.help.tenantAdminClientId.source'),
    impact: t('admin.instances.help.tenantAdminClientId.impact'),
    defaultHint: t('admin.instances.help.tenantAdminClientId.defaultHint'),
  },
  tenantAdminClientSecret: {
    title: t('admin.instances.help.tenantAdminClientSecret.title'),
    what: t('admin.instances.help.tenantAdminClientSecret.what'),
    value: t('admin.instances.help.tenantAdminClientSecret.value'),
    source: t('admin.instances.help.tenantAdminClientSecret.source'),
    impact: t('admin.instances.help.tenantAdminClientSecret.impact'),
  },
  tenantAdminUsername: {
    title: t('admin.instances.help.tenantAdminUsername.title'),
    what: t('admin.instances.help.tenantAdminUsername.what'),
    value: t('admin.instances.help.tenantAdminUsername.value'),
    source: t('admin.instances.help.tenantAdminUsername.source'),
    impact: t('admin.instances.help.tenantAdminUsername.impact'),
  },
  tenantAdminEmail: {
    title: t('admin.instances.help.tenantAdminEmail.title'),
    what: t('admin.instances.help.tenantAdminEmail.what'),
    value: t('admin.instances.help.tenantAdminEmail.value'),
    source: t('admin.instances.help.tenantAdminEmail.source'),
    impact: t('admin.instances.help.tenantAdminEmail.impact'),
  },
  tenantAdminFirstName: {
    title: t('admin.instances.help.tenantAdminFirstName.title'),
    what: t('admin.instances.help.tenantAdminFirstName.what'),
    value: t('admin.instances.help.tenantAdminFirstName.value'),
    source: t('admin.instances.help.tenantAdminFirstName.source'),
    impact: t('admin.instances.help.tenantAdminFirstName.impact'),
  },
  tenantAdminLastName: {
    title: t('admin.instances.help.tenantAdminLastName.title'),
    what: t('admin.instances.help.tenantAdminLastName.what'),
    value: t('admin.instances.help.tenantAdminLastName.value'),
    source: t('admin.instances.help.tenantAdminLastName.source'),
    impact: t('admin.instances.help.tenantAdminLastName.impact'),
  },
};

const trimValue = (value: string) => value.trim();

export const getCreateStepValidationMessages = (step: CreateWizardStepKey, formValues: CreateFormValues): string[] => {
  if (step === 'basics') {
    return [
      !trimValue(formValues.instanceId) ? t('admin.instances.wizard.validation.instanceId') : null,
      !trimValue(formValues.displayName) ? t('admin.instances.wizard.validation.displayName') : null,
      !trimValue(formValues.parentDomain) ? t('admin.instances.wizard.validation.parentDomain') : null,
    ].filter((value): value is string => Boolean(value));
  }

  if (step === 'auth') {
    return [
      !trimValue(formValues.authRealm) ? t('admin.instances.wizard.validation.authRealm') : null,
      !trimValue(formValues.authClientId) ? t('admin.instances.wizard.validation.authClientId') : null,
    ].filter((value): value is string => Boolean(value));
  }

  return [];
};

export const getCreateReadinessChecks = (formValues: CreateFormValues) => [
  {
    key: 'secret',
    title: t('admin.instances.wizard.readiness.secretTitle'),
    ready: isTenantSecretUserInputRequired(formValues.realmMode) ? Boolean(trimValue(formValues.authClientSecret)) : true,
    summary: isTenantSecretUserInputRequired(formValues.realmMode)
      ? trimValue(formValues.authClientSecret)
        ? t('admin.instances.wizard.readiness.secretReady')
        : t('admin.instances.wizard.readiness.secretMissing')
      : t('admin.instances.wizard.readiness.secretGenerated'),
  },
  {
    key: 'tenantAdmin',
    title: t('admin.instances.wizard.readiness.tenantAdminTitle'),
    ready: Boolean(trimValue(formValues.tenantAdminBootstrap.username)),
    summary: trimValue(formValues.tenantAdminBootstrap.username)
      ? t('admin.instances.wizard.readiness.tenantAdminReady')
      : t('admin.instances.wizard.readiness.tenantAdminMissing'),
  },
  {
    key: 'followUp',
    title: t('admin.instances.wizard.readiness.followUpTitle'),
    ready: false,
    summary: t('admin.instances.wizard.readiness.followUpSummary'),
  },
];

export const getPostCreateGuidance = (instance: {
  instanceId: string;
  status: IamInstanceDetail['status'];
  primaryHostname: string;
  authRealm: string;
}) => ({
  title: t('admin.instances.success.title'),
  summary: t('admin.instances.success.summary', {
    instanceId: instance.instanceId,
    status: t(INSTANCE_STATUS_LABELS[instance.status]),
  }),
  nextSteps: [
    t('admin.instances.success.nextSteps.openDetail'),
    t('admin.instances.success.nextSteps.runProvisioning', { realm: instance.authRealm }),
    t('admin.instances.success.nextSteps.activate', { hostname: instance.primaryHostname }),
  ],
});

const findPreflightCheck = (preflight: IamInstanceKeycloakPreflight | undefined, checkKey: string) =>
  preflight?.checks.find((check) => check.checkKey === checkKey);

const readPreflightCheckedAt = (preflight: IamInstanceKeycloakPreflight | undefined) => preflight?.checkedAt;

const readProvisioningRunTimestamp = (run: IamInstanceDetail['latestKeycloakProvisioningRun']) =>
  run?.updatedAt ?? run?.createdAt;

const createWorkflowStep = (input: SetupWorkflowStep): SetupWorkflowStep => input;

const translateConfigurationStatus = (status: InstanceConfigurationOverallStatus) =>
  t(CONFIGURATION_STATUS_LABELS[status]);

const readRequirementGroupSatisfied = (
  keycloakStatus: IamInstanceKeycloakStatus | undefined,
  uiStepKey: string
) =>
  Boolean(
    keycloakStatus &&
      INSTANCE_KEYCLOAK_REQUIREMENTS.filter((requirement) => requirement.uiStepKey === uiStepKey).every((requirement) =>
        isInstanceKeycloakRequirementSatisfied(keycloakStatus, requirement)
      )
  );

export const evaluateInstanceConfiguration = (
  instance: IamInstanceDetail,
  mutationError: IamHttpError | null
): InstanceConfigurationAssessment => {
  const keycloakStatus = instance.keycloakStatus;
  const keycloakUnavailable = mutationError?.code === 'keycloak_unavailable';
  const failingRequirements = keycloakStatus
    ? INSTANCE_KEYCLOAK_REQUIREMENTS.filter((requirement) => !isInstanceKeycloakRequirementSatisfied(keycloakStatus, requirement))
    : [];
  const warningIssues: InstanceConfigurationIssue[] =
    keycloakStatus && keycloakStatus.runtimeSecretSource !== 'tenant'
      ? [
          {
            key: 'runtime_secret_source',
            label: t('admin.instances.keycloakStatus.runtimeSecretSourceTenant'),
            severity: 'warning',
          },
        ]
      : [];
  const blockingIssues: InstanceConfigurationIssue[] = failingRequirements.map((requirement) => ({
    key: requirement.key,
    label: t(KEYCLOAK_STATUS_LABELS[requirement.statusField]),
    severity: 'blocking',
  }));

  if (keycloakUnavailable || !keycloakStatus) {
    return {
      overallStatus: 'unknown',
      title: t('admin.instances.configuration.summary.unknown.title'),
      body: keycloakUnavailable
        ? t('admin.instances.configuration.summary.unknown.keycloakUnavailable')
        : t('admin.instances.configuration.summary.unknown.body'),
      statusLabel: translateConfigurationStatus('unknown'),
      satisfiedRequirements: keycloakStatus ? INSTANCE_KEYCLOAK_REQUIREMENTS.length - failingRequirements.length : 0,
      totalRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
      blockingIssues,
      warningIssues,
    };
  }

  if (blockingIssues.length > 0) {
    return {
      overallStatus: 'incomplete',
      title: t('admin.instances.configuration.summary.incomplete.title'),
      body: t('admin.instances.configuration.summary.incomplete.body', {
        count: blockingIssues.length,
      }),
      statusLabel: translateConfigurationStatus('incomplete'),
      satisfiedRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length - blockingIssues.length,
      totalRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
      blockingIssues,
      warningIssues,
    };
  }

  if (warningIssues.length > 0) {
    return {
      overallStatus: 'degraded',
      title: t('admin.instances.configuration.summary.degraded.title'),
      body: t('admin.instances.configuration.summary.degraded.body'),
      statusLabel: translateConfigurationStatus('degraded'),
      satisfiedRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
      totalRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
      blockingIssues,
      warningIssues,
    };
  }

  return {
    overallStatus: 'complete',
    title: t('admin.instances.configuration.summary.complete.title'),
    body: t('admin.instances.configuration.summary.complete.body'),
    statusLabel: translateConfigurationStatus('complete'),
    satisfiedRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
    totalRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
    blockingIssues,
    warningIssues,
  };
};

export const getSetupWorkflowSteps = (
  instance: IamInstanceDetail,
  mutationError: IamHttpError | null
): readonly SetupWorkflowStep[] => {
  const keycloakUnavailable = mutationError?.code === 'keycloak_unavailable';
  const keycloakAccessCheck = findPreflightCheck(instance.keycloakPreflight, 'keycloak_admin_access');
  const realmModeCheck = findPreflightCheck(instance.keycloakPreflight, 'realm_mode');
  const latestKeycloakRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];
  const provisioningQueued = latestKeycloakRun?.overallStatus === 'planned';
  const provisioningSucceeded = latestKeycloakRun?.overallStatus === 'succeeded';
  const provisioningFailed = latestKeycloakRun?.overallStatus === 'failed';
  const provisioningRunning = latestKeycloakRun?.overallStatus === 'running';
  const tenantAdminConfigured = Boolean(instance.tenantAdminBootstrap?.username);
  const tenantAdminClientConfigured = Boolean(instance.tenantAdminClient?.clientId);
  const tenantAdminClientSecretConfigured = instance.tenantAdminClient?.secretConfigured === true;
  const tenantAdminClientReady =
    instance.keycloakStatus !== undefined && readRequirementGroupSatisfied(instance.keycloakStatus, 'tenantAdminClient');

  return [
    createWorkflowStep({
      key: 'registry',
      title: t('admin.instances.workflow.registry.title'),
      description: t('admin.instances.workflow.registry.description', {
        status: t(INSTANCE_STATUS_LABELS[instance.status]),
      }),
      status: 'done',
    }),
    createWorkflowStep({
      key: 'keycloakAccess',
      title: t('admin.instances.workflow.keycloakAccess.title'),
      description: keycloakUnavailable
        ? t('admin.instances.workflow.keycloakAccess.blocked')
        : keycloakAccessCheck?.status === 'ready'
          ? t('admin.instances.workflow.keycloakAccess.ready')
          : provisioningQueued || provisioningRunning
            ? t('admin.instances.workflow.provisioning.running')
          : t('admin.instances.workflow.keycloakAccess.pending'),
      status:
        keycloakUnavailable ? 'blocked' : keycloakAccessCheck?.status === 'ready' ? 'done' : 'current',
      actionLabel: t('admin.instances.actions.checkPreflight'),
      action: 'check_preflight',
    }),
    createWorkflowStep({
      key: 'realm',
      title: t('admin.instances.workflow.realm.title'),
      description:
        instance.realmMode === 'new'
          ? t('admin.instances.workflow.realm.newRealm')
          : readRequirementGroupSatisfied(instance.keycloakStatus, 'realm')
            ? t('admin.instances.workflow.realm.ready')
            : realmModeCheck?.status === 'blocked'
              ? t('admin.instances.workflow.realm.blocked')
              : t('admin.instances.workflow.realm.pending'),
      status:
        instance.realmMode === 'new'
          ? provisioningSucceeded
            ? 'done'
            : 'current'
          : readRequirementGroupSatisfied(instance.keycloakStatus, 'realm')
            ? 'done'
            : keycloakUnavailable || realmModeCheck?.status === 'blocked'
              ? 'blocked'
              : 'pending',
      actionLabel: t('admin.instances.actions.checkKeycloakStatus'),
      action: 'check_keycloak_status',
    }),
    createWorkflowStep({
      key: 'client',
      title: t('admin.instances.workflow.client.title'),
      description: readRequirementGroupSatisfied(instance.keycloakStatus, 'client')
        ? t('admin.instances.workflow.client.ready')
        : keycloakUnavailable
          ? t('admin.instances.workflow.client.blocked')
          : t('admin.instances.workflow.client.pending'),
      status: readRequirementGroupSatisfied(instance.keycloakStatus, 'client')
        ? 'done'
        : keycloakUnavailable
          ? 'blocked'
          : 'pending',
      actionLabel: t('admin.instances.actions.planProvisioning'),
      action: 'plan_provisioning',
    }),
    createWorkflowStep({
      key: 'tenantAdminClient',
      title: t('admin.instances.workflow.tenantAdminClient.title'),
      description: !tenantAdminClientConfigured
        ? t('admin.instances.workflow.tenantAdminClient.notConfigured')
        : tenantAdminClientReady
          ? t('admin.instances.workflow.tenantAdminClient.ready')
          : !tenantAdminClientSecretConfigured
            ? t('admin.instances.workflow.tenantAdminClient.secretMissing')
            : keycloakUnavailable
              ? t('admin.instances.workflow.tenantAdminClient.blocked')
              : t('admin.instances.workflow.tenantAdminClient.pending'),
      status: !tenantAdminClientConfigured
        ? 'blocked'
        : tenantAdminClientReady
          ? 'done'
          : !tenantAdminClientSecretConfigured
            ? 'blocked'
            : keycloakUnavailable
              ? 'blocked'
              : 'current',
      actionLabel: t('admin.instances.actions.provisionAdminClient'),
      action: 'provision_admin_client',
    }),
    createWorkflowStep({
      key: 'mapper',
      title: t('admin.instances.workflow.mapper.title'),
      description: readRequirementGroupSatisfied(instance.keycloakStatus, 'mapper')
        ? t('admin.instances.workflow.mapper.ready')
        : keycloakUnavailable
          ? t('admin.instances.workflow.mapper.blocked')
          : t('admin.instances.workflow.mapper.pending'),
      status: readRequirementGroupSatisfied(instance.keycloakStatus, 'mapper')
        ? 'done'
        : keycloakUnavailable
          ? 'blocked'
          : 'pending',
    }),
    createWorkflowStep({
      key: 'tenantSecret',
      title: t('admin.instances.workflow.tenantSecret.title'),
      description: !instance.authClientSecretConfigured
        ? instance.realmMode === 'new'
          ? t('admin.instances.workflow.tenantSecret.generatedDuringProvisioning')
          : t('admin.instances.workflow.tenantSecret.missing')
        : readRequirementGroupSatisfied(instance.keycloakStatus, 'tenantSecret')
          ? t('admin.instances.workflow.tenantSecret.ready')
          : keycloakUnavailable
            ? t('admin.instances.workflow.tenantSecret.blocked')
            : t('admin.instances.workflow.tenantSecret.pending'),
      status: !instance.authClientSecretConfigured
        ? instance.realmMode === 'new'
          ? 'pending'
          : 'blocked'
        : readRequirementGroupSatisfied(instance.keycloakStatus, 'tenantSecret')
          ? 'done'
          : keycloakUnavailable
            ? 'blocked'
            : 'current',
    }),
    createWorkflowStep({
      key: 'tenantAdmin',
      title: t('admin.instances.workflow.tenantAdmin.title'),
      description: !tenantAdminConfigured
        ? t('admin.instances.workflow.tenantAdmin.missing')
        : readRequirementGroupSatisfied(instance.keycloakStatus, 'tenantAdmin')
          ? t('admin.instances.workflow.tenantAdmin.ready')
          : keycloakUnavailable
            ? t('admin.instances.workflow.tenantAdmin.blocked')
            : t('admin.instances.workflow.tenantAdmin.pending'),
      status: !tenantAdminConfigured
        ? 'blocked'
        : readRequirementGroupSatisfied(instance.keycloakStatus, 'tenantAdmin')
          ? 'done'
          : keycloakUnavailable
            ? 'blocked'
            : 'current',
      actionLabel: t('admin.instances.actions.resetTenantAdmin'),
      action: 'reset_tenant_admin',
    }),
    createWorkflowStep({
      key: 'provisioning',
      title: t('admin.instances.workflow.provisioning.title'),
      description: provisioningSucceeded
        ? t('admin.instances.workflow.provisioning.ready')
        : provisioningQueued || provisioningRunning
          ? t('admin.instances.workflow.provisioning.running')
          : provisioningFailed
            ? t('admin.instances.workflow.provisioning.failed')
            : t('admin.instances.workflow.provisioning.pending'),
      status:
        provisioningSucceeded ? 'done' : provisioningQueued || provisioningRunning ? 'current' : provisioningFailed ? 'blocked' : 'current',
      actionLabel: t('admin.instances.actions.executeProvisioning'),
      action: 'execute_provisioning',
    }),
    createWorkflowStep({
      key: 'activation',
      title: t('admin.instances.workflow.activation.title'),
      description:
        instance.status === 'active'
          ? t('admin.instances.workflow.activation.ready')
          : provisioningSucceeded
            ? t('admin.instances.workflow.activation.current')
            : t('admin.instances.workflow.activation.pending'),
      status: instance.status === 'active' ? 'done' : provisioningSucceeded ? 'current' : 'pending',
      actionLabel: provisioningSucceeded ? t('admin.instances.actions.activate') : undefined,
      action: provisioningSucceeded ? 'activate_instance' : undefined,
    }),
  ];
};

const mapConfigurationStatusToCockpitStatus = (
  status: InstanceConfigurationAssessment['overallStatus']
): IamTenantIamAxisStatus => {
  switch (status) {
    case 'complete':
      return 'ready';
    case 'degraded':
      return 'degraded';
    case 'incomplete':
      return 'blocked';
    case 'unknown':
      return 'unknown';
  }
};

const getDetailActionLabel = (action: DetailWorkflowAction) => {
  switch (action) {
    case 'check_preflight':
      return t('admin.instances.actions.checkPreflight');
    case 'check_keycloak_status':
      return t('admin.instances.actions.checkKeycloakStatus');
    case 'plan_provisioning':
      return t('admin.instances.actions.planProvisioning');
    case 'execute_provisioning':
      return t('admin.instances.actions.executeProvisioning');
    case 'provision_admin_client':
      return t('admin.instances.actions.provisionAdminClient');
    case 'reset_tenant_admin':
      return t('admin.instances.actions.resetTenantAdmin');
    case 'activate_instance':
      return t('admin.instances.actions.activate');
    case 'rotate_client_secret':
      return t('admin.instances.actions.rotateClientSecret');
    case 'probeTenantIamAccess':
      return t('admin.instances.actions.probeTenantIamAccess');
    case 'reconcileKeycloak':
      return t('admin.instances.actions.reconcileKeycloak');
  }
};

const getCockpitSourceLabel = (source: string) => {
  switch (source) {
    case 'access_probe':
      return t('admin.instances.cockpit.sources.accessProbe');
    case 'role_reconcile':
      return t('admin.instances.cockpit.sources.reconcile');
    case 'keycloak_status_snapshot':
      return t('admin.instances.cockpit.sources.keycloakStatus');
    case 'keycloak_provisioning_run':
      return t('admin.instances.cockpit.sources.provisioningRun');
    case 'registry':
      return t('admin.instances.cockpit.sources.registry');
    default:
      return source;
  }
};

const mapProvisioningRunStatusToCockpitStatus = (
  run: IamInstanceDetail['latestKeycloakProvisioningRun']
): IamTenantIamAxisStatus => {
  if (!run) {
    return 'unknown';
  }

  switch (run.overallStatus) {
    case 'succeeded':
      return 'ready';
    case 'failed':
      return 'blocked';
    case 'running':
    case 'planned':
      return 'degraded';
    default:
      return 'unknown';
  }
};

const mapInstanceStatusToCockpitStatus = (status: IamInstanceDetail['status']): IamTenantIamAxisStatus => {
  switch (status) {
    case 'active':
      return 'ready';
    case 'failed':
    case 'archived':
      return 'blocked';
    case 'suspended':
    case 'provisioning':
    case 'validated':
      return 'degraded';
    case 'requested':
      return 'unknown';
  }
};

const buildMutationAnomaly = (mutationError: IamHttpError | null): CockpitAnomalyItem | null => {
  if (!mutationError) {
    return null;
  }

  const status: IamTenantIamAxisStatus =
    mutationError.code === 'keycloak_unavailable' || mutationError.code === 'database_unavailable' ? 'degraded' : 'blocked';

  return {
    key: 'mutation_error',
    title: t('admin.instances.cockpit.anomalies.diagnostics'),
    summary: getErrorMessage(mutationError),
    status,
    sourceLabel: t('admin.instances.cockpit.sources.diagnostics'),
    ...(mutationError.requestId ? { requestId: mutationError.requestId } : {}),
  };
};

const buildTenantIamAxis = (
  status: IamTenantIamAxisStatus,
  summary: string,
  source: IamTenantIamStatus['overall']['source'],
  current?: Partial<IamTenantIamStatus['overall']>
): IamTenantIamStatus['overall'] => ({
  status,
  summary,
  source,
  ...(current?.checkedAt ? { checkedAt: current.checkedAt } : {}),
  ...(current?.errorCode ? { errorCode: current.errorCode } : {}),
  ...(current?.requestId ? { requestId: current.requestId } : {}),
});

export const getEffectiveTenantIamStatus = (instance: IamInstanceDetail): IamTenantIamStatus | undefined => {
  const current = instance.tenantIamStatus;
  if (!current) {
    return undefined;
  }

  const configurationStatus = instance.keycloakStatus
    ? INSTANCE_KEYCLOAK_REQUIREMENTS.every((requirement) =>
        isInstanceKeycloakRequirementSatisfied(instance.keycloakStatus!, requirement)
      )
      ? 'ready'
      : 'degraded'
    : current.configuration.status;

  const configuration = instance.keycloakStatus
    ? buildTenantIamAxis(
        configurationStatus,
        configurationStatus === 'ready'
          ? t('admin.instances.tenantIam.summaries.configurationReady')
          : t('admin.instances.tenantIam.summaries.configurationDegraded'),
        'keycloak_status_snapshot',
        current.configuration
      )
    : current.configuration;

  const access = current.access;
  const reconcile = current.reconcile;
  const overallStatus =
    TENANT_IAM_STATUS_PRECEDENCE.find((candidate) =>
      [configuration.status, access.status, reconcile.status].includes(candidate)
    ) ?? 'unknown';
  const dominantAxis =
    overallStatus === configuration.status
      ? configuration
      : overallStatus === access.status
        ? access
        : overallStatus === reconcile.status
          ? reconcile
          : configuration;
  const overallSummary =
    overallStatus === 'ready'
      ? t('admin.instances.tenantIam.summaries.overallReady')
      : overallStatus === 'blocked'
        ? t('admin.instances.tenantIam.summaries.overallBlocked')
        : overallStatus === 'degraded'
          ? t('admin.instances.tenantIam.summaries.overallDegraded')
          : t('admin.instances.tenantIam.summaries.overallUnknown');

  return {
    configuration,
    access,
    reconcile,
    overall: buildTenantIamAxis(overallStatus, overallSummary, dominantAxis.source, dominantAxis),
  };
};

export const buildInstanceDetailCockpitModel = (
  instance: IamInstanceDetail,
  mutationError: IamHttpError | null
): InstanceDetailCockpitModel => {
  const configurationAssessment = evaluateInstanceConfiguration(instance, mutationError);
  const workflowSteps = getSetupWorkflowSteps(instance, mutationError);
  const latestRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];
  const tenantIamStatus = getEffectiveTenantIamStatus(instance);

  const anomalyCandidates: CockpitAnomalyItem[] = [];

  if (tenantIamStatus && tenantIamStatus.access.status !== 'ready') {
    anomalyCandidates.push({
      key: 'tenant-iam-access',
      title: t(TENANT_IAM_AXIS_LABELS.access),
      summary: tenantIamStatus.access.summary,
      status: tenantIamStatus.access.status,
      sourceLabel: getCockpitSourceLabel(tenantIamStatus.access.source),
      ...(tenantIamStatus.access.checkedAt ? { checkedAt: tenantIamStatus.access.checkedAt } : {}),
      ...(tenantIamStatus.access.requestId ? { requestId: tenantIamStatus.access.requestId } : {}),
    });
  }

  if (tenantIamStatus && tenantIamStatus.reconcile.status !== 'ready') {
    anomalyCandidates.push({
      key: 'tenant-iam-reconcile',
      title: t(TENANT_IAM_AXIS_LABELS.reconcile),
      summary: tenantIamStatus.reconcile.summary,
      status: tenantIamStatus.reconcile.status,
      sourceLabel: getCockpitSourceLabel(tenantIamStatus.reconcile.source),
      ...(tenantIamStatus.reconcile.checkedAt ? { checkedAt: tenantIamStatus.reconcile.checkedAt } : {}),
      ...(tenantIamStatus.reconcile.requestId ? { requestId: tenantIamStatus.reconcile.requestId } : {}),
    });
  }

  if (configurationAssessment.overallStatus === 'degraded' || configurationAssessment.overallStatus === 'incomplete') {
    anomalyCandidates.push({
      key: 'configuration',
      title: t(TENANT_IAM_AXIS_LABELS.configuration),
      summary: configurationAssessment.body,
      status: mapConfigurationStatusToCockpitStatus(configurationAssessment.overallStatus),
      sourceLabel: getCockpitSourceLabel(instance.keycloakStatus ? 'keycloak_status_snapshot' : 'registry'),
    });
  }

  if (latestRun && latestRun.overallStatus !== 'succeeded') {
    anomalyCandidates.push({
      key: 'latest-run',
      title: t('admin.instances.cockpit.anomalies.provisioning'),
      summary: latestRun.driftSummary,
      status: mapProvisioningRunStatusToCockpitStatus(latestRun),
      sourceLabel: getCockpitSourceLabel('keycloak_provisioning_run'),
      ...(readProvisioningRunTimestamp(latestRun) ? { checkedAt: readProvisioningRunTimestamp(latestRun) } : {}),
      ...(latestRun.requestId ? { requestId: latestRun.requestId } : {}),
    });
  }

  const mutationAnomaly = buildMutationAnomaly(mutationError);
  if (mutationAnomaly) {
    anomalyCandidates.push(mutationAnomaly);
  }

  const anomalyQueue = anomalyCandidates.slice(0, 3);
  const currentSignals: IamTenantIamAxisStatus[] = [
    tenantIamStatus?.overall.status ?? 'unknown',
    mapConfigurationStatusToCockpitStatus(configurationAssessment.overallStatus),
    mapProvisioningRunStatusToCockpitStatus(latestRun),
    mapInstanceStatusToCockpitStatus(instance.status),
    mutationAnomaly?.status ?? 'ready',
  ];
  const overallStatus =
    COCKPIT_STATUS_PRECEDENCE.find((candidate) => currentSignals.includes(candidate)) ?? 'unknown';

  const overallTitle =
    overallStatus === 'ready'
      ? t('admin.instances.cockpit.overall.ready')
      : overallStatus === 'blocked'
        ? t('admin.instances.cockpit.overall.blocked')
        : overallStatus === 'degraded'
          ? t('admin.instances.cockpit.overall.degraded')
          : t('admin.instances.cockpit.overall.unknown');

  const overallSummary =
    anomalyQueue[0]?.summary ??
    tenantIamStatus?.overall.summary ??
    getStatusGuidance(instance).body;

  const dominantEvidence =
    tenantIamStatus?.overall.status !== 'ready'
      ? {
          label: t('admin.instances.cockpit.evidence.tenantIam'),
          source: tenantIamStatus?.overall.source ?? 'registry',
          sourceLabel: getCockpitSourceLabel(tenantIamStatus?.overall.source ?? 'registry'),
          checkedAt: tenantIamStatus?.overall.checkedAt,
          requestId: tenantIamStatus?.overall.requestId,
        }
      : instance.keycloakPreflight
        ? {
            label: t('admin.instances.cockpit.evidence.preflight'),
            source: 'keycloak_status_snapshot',
            sourceLabel: getCockpitSourceLabel('keycloak_status_snapshot'),
            checkedAt: readPreflightCheckedAt(instance.keycloakPreflight),
            requestId: undefined,
          }
        : latestRun
          ? {
              label: t('admin.instances.cockpit.evidence.provisioning'),
              source: 'keycloak_provisioning_run',
              sourceLabel: getCockpitSourceLabel('keycloak_provisioning_run'),
              checkedAt: readProvisioningRunTimestamp(latestRun),
              requestId: latestRun.requestId,
            }
          : {
              label: t('admin.instances.cockpit.evidence.registry'),
              source: 'registry',
              sourceLabel: getCockpitSourceLabel('registry'),
              checkedAt: undefined,
              requestId: undefined,
            };

  const primaryActionKey: DetailWorkflowAction =
    latestRun?.overallStatus === 'succeeded' && instance.status !== 'active'
      ? 'activate_instance'
      : tenantIamStatus && tenantIamStatus.access.status !== 'ready'
        ? 'probeTenantIamAccess'
        : tenantIamStatus &&
            (tenantIamStatus.reconcile.status === 'blocked' || tenantIamStatus.reconcile.status === 'degraded')
          ? 'reconcileKeycloak'
          : workflowSteps.find((step) => step.status === 'current' && step.action)?.action ??
            workflowSteps.find((step) => step.status === 'blocked' && step.action)?.action ??
            'check_preflight';

  const orderedSecondaryActions: readonly DetailWorkflowAction[] = [
    'probeTenantIamAccess',
    'reconcileKeycloak',
    'check_preflight',
    'check_keycloak_status',
    'plan_provisioning',
    'execute_provisioning',
    'provision_admin_client',
    'reset_tenant_admin',
    'rotate_client_secret',
  ];

  return {
    overallStatus,
    overallTitle,
    overallSummary,
    dominantEvidence,
    anomalyQueue,
    primaryAction: {
      action: primaryActionKey,
      label: getDetailActionLabel(primaryActionKey),
    },
    secondaryActions: orderedSecondaryActions
      .filter((action) => action !== primaryActionKey)
      .map((action) => ({
        action,
        label: getDetailActionLabel(action),
      })),
  };
};

export const getStatusGuidance = (instance: IamInstanceDetail) => {
  switch (instance.status) {
    case 'requested':
      return {
        title: t('admin.instances.guidance.requested.title'),
        body: t('admin.instances.guidance.requested.body'),
      };
    case 'validated':
      return {
        title: t('admin.instances.guidance.validated.title'),
        body: t('admin.instances.guidance.validated.body'),
      };
    case 'provisioning':
      return {
        title: t('admin.instances.guidance.provisioning.title'),
        body: t('admin.instances.guidance.provisioning.body'),
      };
    case 'active':
      return {
        title: t('admin.instances.guidance.active.title'),
        body: t('admin.instances.guidance.active.body'),
      };
    case 'failed':
      return {
        title: t('admin.instances.guidance.failed.title'),
        body: t('admin.instances.guidance.failed.body'),
      };
    case 'suspended':
      return {
        title: t('admin.instances.guidance.suspended.title'),
        body: t('admin.instances.guidance.suspended.body'),
      };
    case 'archived':
      return {
        title: t('admin.instances.guidance.archived.title'),
        body: t('admin.instances.guidance.archived.body'),
      };
  }
};

export const getKeycloakStatusEntries = (selectedInstance: NonNullable<ReturnType<typeof useInstances>['selectedInstance']>) => {
  const status = selectedInstance.keycloakStatus;
  if (!status) {
    return [];
  }

  return [
    ...INSTANCE_KEYCLOAK_REQUIREMENTS.map((requirement) => [
      KEYCLOAK_STATUS_LABELS[requirement.statusField],
      isInstanceKeycloakRequirementSatisfied(status, requirement),
    ] as const),
    ['admin.instances.keycloakStatus.clientSecretConfigured', status.clientSecretConfigured],
    ['admin.instances.keycloakStatus.tenantClientSecretReadable', status.tenantClientSecretReadable],
    ['admin.instances.keycloakStatus.tenantAdminClientSecretConfigured', status.tenantAdminClientSecretConfigured],
    ['admin.instances.keycloakStatus.tenantAdminClientSecretReadable', status.tenantAdminClientSecretReadable],
    ['admin.instances.keycloakStatus.runtimeSecretSourceTenant', status.runtimeSecretSource === 'tenant'],
  ] as const;
};

export const KeycloakStatusBadge = ({ ready }: { ready: boolean }) => (
  <Badge variant={ready ? 'secondary' : 'outline'}>
    {ready ? t('admin.instances.keycloakStatus.ok') : t('admin.instances.keycloakStatus.missing')}
  </Badge>
);

export const ConfigurationStatusBadge = ({ status }: { status: InstanceConfigurationOverallStatus }) => {
  const variant = status === 'complete' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{translateConfigurationStatus(status)}</Badge>;
};

export const WorkflowStatusBadge = ({ status }: { status: WorkflowStepState }) => {
  const labelMap: Record<WorkflowStepState, string> = {
    done: t('admin.instances.workflow.badges.done'),
    current: t('admin.instances.workflow.badges.current'),
    blocked: t('admin.instances.workflow.badges.blocked'),
    pending: t('admin.instances.workflow.badges.pending'),
  };
  return <Badge variant={status === 'done' ? 'secondary' : 'outline'}>{labelMap[status]}</Badge>;
};

export const ProvisioningStepBadge = ({
  status,
}: {
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'unchanged';
}) => {
  const ready = status === 'done' || status === 'skipped' || status === 'unchanged';
  return <Badge variant={ready ? 'secondary' : 'outline'}>{status}</Badge>;
};
