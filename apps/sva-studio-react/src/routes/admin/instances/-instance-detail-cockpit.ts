import type { IamHttpError } from '../../../lib/iam-api';
import type { DetailWorkflowAction, InstanceDetailCockpitModel } from './-instances-shared-types';

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
  'instance.readiness.refresh': 'check_preflight',
  'instance.keycloak.execute': 'execute_provisioning',
  'instance.secret.rotate': 'rotate_client_secret',
  'instance.provisioning.retry': 'retry_tenant_provisioning',
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
