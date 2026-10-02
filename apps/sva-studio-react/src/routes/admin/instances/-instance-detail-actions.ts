import type React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type {
  DetailFormValues,
  DetailWorkflowAction,
  SelectedInstance,
} from './-instances-shared-types';
import type { ActionFeedback } from './-instance-detail-page-helpers';
import type { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';

type WorkspaceTab = 'betrieb' | 'doctor' | 'einstellungen';

type DetailActionsInput = {
  selectedInstance: SelectedInstance | null;
  detailFormValues: DetailFormValues | null;
  detailForm: UseFormReturn<DetailFormValues>;
  instancesApi: ReturnType<typeof useInstances>;
  planNeedsRefresh: boolean;
  canRetryTenantProvisioning: boolean;
  setActionFeedback: React.Dispatch<React.SetStateAction<ActionFeedback | null>>;
  setStalePlan: React.Dispatch<
    React.SetStateAction<{ instanceId: string; fingerprint: string } | null>
  >;
  setActivationConfirmation: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveWorkspaceTab: React.Dispatch<React.SetStateAction<WorkspaceTab>>;
  actionBusyRef: React.RefObject<boolean>;
  setActionBusy: React.Dispatch<React.SetStateAction<boolean>>;
};

const createProvisioningActions = (input: DetailActionsInput) => {
  const {
    selectedInstance,
    detailFormValues,
    detailForm,
    instancesApi,
    planNeedsRefresh,
    setActionFeedback,
    setStalePlan,
    setActivationConfirmation,
  } = input;
  const executeProvisioning = async (
    intent: 'provision' | 'provision_admin_client' | 'reset_tenant_admin' | 'rotate_client_secret'
  ) => {
    if (!selectedInstance || !detailFormValues) {
      return;
    }
    const confirmedPlanFingerprint = selectedInstance.keycloakPlan?.fingerprint;
    if (!confirmedPlanFingerprint || planNeedsRefresh) return;

    setActionFeedback(null);
    const result = await instancesApi.executeKeycloakProvisioning(selectedInstance.instanceId, {
      intent,
      planFingerprint: confirmedPlanFingerprint,
      tenantAdminTemporaryPassword:
        detailFormValues.tenantAdminTemporaryPassword.trim() || undefined,
    });
    if (result) {
      setActionFeedback({
        tone: 'success',
        message: t('admin.instances.feedback.provisioningQueued'),
      });
    }
    if (result) detailForm.setValue('tenantAdminTemporaryPassword', '', { shouldDirty: false });
  };

  const triggerWorkflowAction = async (
    action:
      | 'check_preflight'
      | 'check_keycloak_status'
      | 'plan_provisioning'
      | 'execute_provisioning'
      | 'provision_admin_client'
      | 'reset_tenant_admin'
      | 'activate_instance'
  ) => {
    if (!selectedInstance) {
      return;
    }

    setActionFeedback(null);
    switch (action) {
      case 'check_preflight': {
        const result = await instancesApi.refreshKeycloakPreflight(selectedInstance.instanceId);
        if (result) {
          setActionFeedback({
            tone: 'success',
            message: t('admin.instances.feedback.preflightUpdated'),
          });
        }
        return;
      }
      case 'check_keycloak_status': {
        const result = await instancesApi.refreshKeycloakStatus(selectedInstance.instanceId);
        if (result) {
          setActionFeedback({
            tone: 'success',
            message: t('admin.instances.feedback.keycloakStatusUpdated'),
          });
        }
        return;
      }
      case 'plan_provisioning': {
        const result = await instancesApi.planKeycloakProvisioning(selectedInstance.instanceId);
        if (result) {
          setStalePlan(null);
          setActionFeedback({
            tone: 'success',
            message: t('admin.instances.feedback.provisioningPreviewUpdated'),
          });
        }
        return;
      }
      case 'execute_provisioning':
        await executeProvisioning('provision');
        return;
      case 'provision_admin_client':
        await executeProvisioning('provision_admin_client');
        return;
      case 'reset_tenant_admin':
        await executeProvisioning('reset_tenant_admin');
        return;
      case 'activate_instance':
        if (
          selectedInstance.provisioningReadiness?.nextAction?.action === 'instance.status.activate'
        ) {
          setActivationConfirmation(selectedInstance.updatedAt);
        }
    }
  };

  return { executeProvisioning, triggerWorkflowAction };
};

export const createInstanceDetailActions = (input: DetailActionsInput) => {
  const {
    selectedInstance,
    instancesApi,
    canRetryTenantProvisioning,
    setActionFeedback,
    setActiveWorkspaceTab,
    actionBusyRef,
    setActionBusy,
  } = input;
  const { executeProvisioning, triggerWorkflowAction } = createProvisioningActions(input);

  const probeTenantIamAccess = async () => {
    if (!selectedInstance) {
      return;
    }
    setActionFeedback(null);
    const result = await instancesApi.probeTenantIamAccess(selectedInstance.instanceId);
    if (result) {
      setActionFeedback({
        tone: 'success',
        message: t('admin.instances.feedback.tenantIamProbeUpdated'),
      });
    }
  };

  const retryTenantProvisioning = async () => {
    if (!selectedInstance || !canRetryTenantProvisioning) return;
    setActionFeedback(null);
    const result = await instancesApi.retryTenantProvisioning(selectedInstance.instanceId);
    if (result) {
      setActionFeedback({
        tone: 'success',
        message: t('admin.instances.feedback.provisioningRetryQueued'),
      });
    }
  };

  const performDetailAction = async (action: DetailWorkflowAction | 'focus_configuration') => {
    switch (action) {
      case 'refresh_readiness':
        if (!selectedInstance) return;
        setActionFeedback(null);
        if (await instancesApi.loadInstance(selectedInstance.instanceId)) {
          setActionFeedback({
            tone: 'success',
            message: t('admin.instances.feedback.readinessUpdated'),
          });
        }
        return;
      case 'open_diagnostics':
        if (!selectedInstance) return;
        await instancesApi.loadInstance(selectedInstance.instanceId);
        setActiveWorkspaceTab('doctor');

        return;
      case 'focus_configuration':
        setActiveWorkspaceTab('einstellungen');

        return;
      case 'probeTenantIamAccess':
        await probeTenantIamAccess();
        return;
      case 'reconcileKeycloak':
        if (!selectedInstance) {
          return;
        }
        if (!selectedInstance.keycloakPlan?.fingerprint) return;
        await instancesApi.reconcileKeycloak(selectedInstance.instanceId, {
          planFingerprint: selectedInstance.keycloakPlan.fingerprint,
        });
        return;
      case 'reconcileTenantIamRoles': {
        if (!selectedInstance) return;
        const latestRun =
          selectedInstance.latestKeycloakProvisioningRun ??
          selectedInstance.keycloakProvisioningRuns[0];
        const confirmedPlanFingerprint = latestRun?.steps.find(
          ({ stepKey }) => stepKey === 'queued'
        )?.details.confirmedPlanFingerprint;
        if (
          typeof confirmedPlanFingerprint !== 'string' ||
          !/^[a-f0-9]{64}$/u.test(confirmedPlanFingerprint)
        ) {
          return;
        }
        await instancesApi.reconcileTenantIamRoles(selectedInstance.instanceId, {
          planFingerprint: confirmedPlanFingerprint,
        });
        return;
      }
      case 'rotate_client_secret':
        await executeProvisioning('rotate_client_secret');
        return;
      case 'retry_tenant_provisioning':
        await retryTenantProvisioning();
        return;
      default:
        await triggerWorkflowAction(action);
    }
  };

  const runDetailAction = async (action: DetailWorkflowAction | 'focus_configuration') => {
    if (action === 'activate_instance') return performDetailAction(action);
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    setActionBusy(true);
    try {
      await performDetailAction(action);
    } finally {
      actionBusyRef.current = false;
      setActionBusy(false);
    }
  };
  return { runDetailAction };
};
