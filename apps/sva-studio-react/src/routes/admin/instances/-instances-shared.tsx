import {
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  isInstanceKeycloakRequirementSatisfied,
  type IamInstanceDetail,
  type IamInstanceKeycloakPreflight,
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
  | 'tenantAdminUsername'
  | 'tenantAdminEmail'
  | 'tenantAdminFirstName'
  | 'tenantAdminLastName';

export type CreateFormValues = ReturnType<typeof createEmptyCreateForm>;

export type WorkflowStepState = 'done' | 'current' | 'blocked' | 'pending';

export type SetupWorkflowStep = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly status: WorkflowStepState;
  readonly actionLabel?: string;
  readonly action?: 'check_preflight' | 'check_keycloak_status' | 'plan_provisioning' | 'execute_provisioning' | 'activate_instance';
};

type IamInstanceKeycloakStatus = NonNullable<IamInstanceDetail['keycloakStatus']>;

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

const createWorkflowStep = (input: SetupWorkflowStep): SetupWorkflowStep => input;

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
      action: 'execute_provisioning',
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
      `admin.instances.keycloakStatus.${requirement.statusField}`,
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
