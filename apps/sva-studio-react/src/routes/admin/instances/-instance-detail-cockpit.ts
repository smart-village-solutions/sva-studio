import type { IamHttpError } from '../../../lib/iam-api';
import { t } from '../../../i18n';
import type {
  DetailWorkflowAction,
  InstanceDetailCockpitModel,
  InstanceSetupStep,
  InstanceTechnicalProgressItem,
} from './-instances-shared-types';

import { evaluateInstanceConfiguration } from './-instance-detail-configuration';
import { buildCockpitState, getDetailActionLabel } from './-instance-detail-cockpit-helpers';
import { getSetupWorkflowSteps } from './-instance-detail-workflow';
import type { IamInstanceDetail } from './-instance-detail-shared';
import type { InstanceConfigurationAssessment } from './-instances-shared-types';
import type { RequiredPluginReadinessAssessment } from './-instance-required-plugin-readiness';

const ORDERED_SECONDARY_ACTIONS: readonly DetailWorkflowAction[] = [
  'probeTenantIamAccess',
  'check_preflight',
  'check_keycloak_status',
  'plan_provisioning',
];

const SERVER_ACTIONS: Readonly<
  Record<
    NonNullable<IamInstanceDetail['provisioningReadiness']>['nextAction'] extends infer T
      ? T extends { action: infer A extends string }
        ? A
        : never
      : never,
    DetailWorkflowAction
  >
> = {
  'instance.readiness.refresh': 'refresh_readiness',
  'instance.keycloak.execute': 'execute_provisioning',
  'instance.secret.rotate': 'rotate_client_secret',
  'instance.provisioning.retry': 'retry_tenant_provisioning',
  'instance.diagnose': 'open_diagnostics',
  'instance.tenant-iam.probe': 'probeTenantIamAccess',
  'instance.tenant-iam.reconcile': 'reconcileTenantIamRoles',
  'instance.status.activate': 'activate_instance',
};

const selectPrimaryAction = (
  instance: IamInstanceDetail,
  workflowActions: readonly DetailWorkflowAction[]
): DetailWorkflowAction => {
  const serverAction = instance.provisioningReadiness?.nextAction?.action;
  if (serverAction) return SERVER_ACTIONS[serverAction];

  return (
    workflowActions.find((action) => ORDERED_SECONDARY_ACTIONS.includes(action)) ??
    'check_preflight'
  );
};

const getProvisionSetupStepStatus = ({
  confirmationDone,
  technicalBlocked,
  technicalDone,
}: {
  confirmationDone: boolean;
  technicalBlocked: boolean;
  technicalDone: boolean;
}): InstanceSetupStep['status'] => {
  if (technicalDone) return 'done';
  if (technicalBlocked) return 'blocked';
  return confirmationDone ? 'current' : 'pending';
};

const getVerifySetupStepStatus = ({
  readinessBlocked,
  readinessDone,
  technicalDone,
}: {
  readinessBlocked: boolean;
  readinessDone: boolean;
  technicalDone: boolean;
}): InstanceSetupStep['status'] => {
  if (readinessDone) return 'done';
  if (readinessBlocked) return 'blocked';
  return technicalDone ? 'current' : 'pending';
};

const getActivateSetupStepStatus = ({
  isActive,
  nextAction,
  readinessBlocked,
}: {
  isActive: boolean;
  nextAction: string | undefined;
  readinessBlocked: boolean;
}): InstanceSetupStep['status'] => {
  if (isActive) return 'done';
  if (nextAction === 'instance.status.activate') return 'current';
  return readinessBlocked ? 'blocked' : 'pending';
};

export const buildInstanceSetupSteps = (
  instance: IamInstanceDetail
): readonly InstanceSetupStep[] => {
  const latestRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];
  const nextAction = instance.provisioningReadiness?.nextAction?.action;
  const readinessState = instance.provisioningReadiness?.state ?? 'unknown';
  const isActive = instance.status === 'active';
  const planReady = instance.keycloakPlan?.overallStatus === 'ready';
  const planHasMutations =
    instance.keycloakPlan?.steps.some(
      (step) => step.action === 'create' || step.action === 'update'
    ) ?? false;
  const runStarted = Boolean(latestRun);
  const parentProvisioningBlocked =
    nextAction === 'instance.provisioning.retry' || nextAction === 'instance.diagnose';
  const preparationBlocked = readinessState === 'provisioning_blocked' && !planReady;
  const confirmationDone = planReady && (!planHasMutations || runStarted);
  const noTechnicalChangesRequired = planReady && !planHasMutations && !latestRun;
  const technicalDone =
    isActive ||
    (!parentProvisioningBlocked &&
      (latestRun?.overallStatus === 'succeeded' || noTechnicalChangesRequired));
  const technicalBlocked = latestRun?.overallStatus === 'failed' || parentProvisioningBlocked;
  const readinessDone = isActive || nextAction === 'instance.status.activate';
  const readinessBlocked = technicalDone && readinessState === 'provisioning_blocked';

  return [
    {
      key: 'prepare',
      title: t('admin.instances.cockpit.setup.steps.prepare.title'),
      description: t('admin.instances.cockpit.setup.steps.prepare.description'),
      status: isActive || planReady ? 'done' : preparationBlocked ? 'blocked' : 'current',
    },
    {
      key: 'confirm',
      title: t('admin.instances.cockpit.setup.steps.confirm.title'),
      description: t('admin.instances.cockpit.setup.steps.confirm.description'),
      status: isActive || confirmationDone ? 'done' : planReady ? 'current' : 'pending',
    },
    {
      key: 'provision',
      title: t('admin.instances.cockpit.setup.steps.provision.title'),
      description: t('admin.instances.cockpit.setup.steps.provision.description'),
      status: getProvisionSetupStepStatus({
        confirmationDone,
        technicalBlocked,
        technicalDone,
      }),
    },
    {
      key: 'verify',
      title: t('admin.instances.cockpit.setup.steps.verify.title'),
      description: t('admin.instances.cockpit.setup.steps.verify.description'),
      status: getVerifySetupStepStatus({ readinessBlocked, readinessDone, technicalDone }),
    },
    {
      key: 'activate',
      title: t('admin.instances.cockpit.setup.steps.activate.title'),
      description: t('admin.instances.cockpit.setup.steps.activate.description'),
      status: getActivateSetupStepStatus({ isActive, nextAction, readinessBlocked }),
    },
  ];
};

export const buildInstanceTechnicalProgress = (
  instance: IamInstanceDetail
): readonly InstanceTechnicalProgressItem[] => {
  const latestRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];
  const keycloakReady = instance.status === 'active' || latestRun?.overallStatus === 'succeeded';
  const keycloakStatus = keycloakReady
    ? 'done'
    : latestRun?.overallStatus === 'failed'
      ? 'blocked'
      : latestRun?.overallStatus === 'planned' || latestRun?.overallStatus === 'running'
        ? 'current'
        : 'pending';
  const tenantAdminReady = Boolean(
    instance.keycloakStatus?.tenantAdminExists && instance.keycloakStatus.tenantAdminHasSystemAdmin
  );
  const tenantIamStatus = instance.tenantIamStatus?.overall.status;

  return [
    {
      key: 'keycloak',
      title: t('admin.instances.cockpit.setup.technical.keycloak'),
      status: keycloakStatus,
    },
    {
      key: 'tenantAdmin',
      title: t('admin.instances.cockpit.setup.technical.tenantAdmin'),
      status: tenantAdminReady
        ? 'done'
        : latestRun?.overallStatus === 'failed'
          ? 'blocked'
          : latestRun?.overallStatus === 'running'
            ? 'current'
            : 'pending',
    },
    {
      key: 'tenantIam',
      title: t('admin.instances.cockpit.setup.technical.tenantIam'),
      status:
        tenantIamStatus === 'ready'
          ? 'done'
          : tenantIamStatus === 'blocked'
            ? 'blocked'
            : tenantIamStatus === 'degraded'
              ? 'current'
              : 'pending',
    },
  ];
};

export const buildInstanceDetailCockpitModel = (
  instance: IamInstanceDetail,
  mutationError: IamHttpError | null,
  configurationAssessmentOverride?: InstanceConfigurationAssessment,
  requiredPluginReadiness: RequiredPluginReadinessAssessment | null = null
): InstanceDetailCockpitModel => {
  const configurationAssessment =
    configurationAssessmentOverride ?? evaluateInstanceConfiguration(instance, mutationError);
  const workflowSteps = getSetupWorkflowSteps(instance, mutationError);
  const workflowActions = workflowSteps.flatMap((step) => (step.action ? [step.action] : []));
  const primaryActionKey = selectPrimaryAction(instance, workflowActions);
  const cockpitState = buildCockpitState(
    instance,
    configurationAssessment,
    mutationError,
    requiredPluginReadiness
  );

  return {
    ...cockpitState,
    setupSteps: buildInstanceSetupSteps(instance),
    technicalProgress: buildInstanceTechnicalProgress(instance),
    primaryAction: {
      action: primaryActionKey,
      label: getDetailActionLabel(primaryActionKey),
    },
    secondaryActions: ORDERED_SECONDARY_ACTIONS.filter((action) => action !== primaryActionKey).map(
      (action) => ({
        action,
        label: getDetailActionLabel(action),
      })
    ),
  };
};
