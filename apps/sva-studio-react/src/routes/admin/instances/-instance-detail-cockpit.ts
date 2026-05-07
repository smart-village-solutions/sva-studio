import type { IamHttpError } from '../../../lib/iam-api';
import type { DetailWorkflowAction, InstanceDetailCockpitModel } from './-instances-shared-types';

import { evaluateInstanceConfiguration } from './-instance-detail-configuration';
import {
  buildCockpitState,
  getDetailActionLabel,
} from './-instance-detail-cockpit-helpers';
import { getEffectiveTenantIamStatus } from './-instance-detail-tenant-iam';
import { getSetupWorkflowSteps } from './-instance-detail-workflow';
import type { IamInstanceDetail } from './-instance-detail-shared';

const ORDERED_SECONDARY_ACTIONS: readonly DetailWorkflowAction[] = [
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

const selectPrimaryAction = (
  instance: IamInstanceDetail,
  workflowActions: readonly DetailWorkflowAction[]
): DetailWorkflowAction => {
  const latestRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];
  const tenantIamStatus = getEffectiveTenantIamStatus(instance);
  if (latestRun?.overallStatus === 'succeeded' && instance.status !== 'active') {
    return 'activate_instance';
  }

  if (tenantIamStatus?.access.status !== 'ready') {
    return 'probeTenantIamAccess';
  }

  if (tenantIamStatus && ['blocked', 'degraded'].includes(tenantIamStatus.reconcile.status)) {
    return 'reconcileKeycloak';
  }

  return workflowActions.find((action) => action !== 'check_preflight') ?? workflowActions[0] ?? 'check_preflight';
};

export const buildInstanceDetailCockpitModel = (
  instance: IamInstanceDetail,
  mutationError: IamHttpError | null
): InstanceDetailCockpitModel => {
  const configurationAssessment = evaluateInstanceConfiguration(instance, mutationError);
  const workflowSteps = getSetupWorkflowSteps(instance, mutationError);
  const workflowActions = workflowSteps.flatMap((step) => (step.action ? [step.action] : []));
  const primaryActionKey = selectPrimaryAction(instance, workflowActions);
  const cockpitState = buildCockpitState(instance, configurationAssessment, mutationError);

  return {
    ...cockpitState,
    primaryAction: {
      action: primaryActionKey,
      label: getDetailActionLabel(primaryActionKey),
    },
    secondaryActions: ORDERED_SECONDARY_ACTIONS.filter((action) => action !== primaryActionKey).map((action) => ({
      action,
      label: getDetailActionLabel(action),
    })),
  };
};
