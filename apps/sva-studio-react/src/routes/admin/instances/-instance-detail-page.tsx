import { zodResolver } from '@hookform/resolvers/zod';
import { createInstanceDetailActions } from './-instance-detail-actions';
import { InstanceDetailFeedback } from './-instance-detail-feedback';
import { InstanceDetailWorkspace } from './-instance-detail-workspace';
import { useForm, useWatch } from 'react-hook-form';
import type { DetailFormValues } from './-instances-shared-types';
import type { AccountInvitationTemplateSaveResult } from './-account-invitation-template-card';
import React from 'react';
import { useStudioSaveFeedback } from '@sva/studio-ui-react';

import { Card } from '../../../components/ui/card';
import { useInstances } from '../../../hooks/use-instances';
import { usePluginTenantReadiness } from '../../../hooks/use-plugin-tenant-readiness';
import { studioPluginSnapshot } from '../../../lib/plugins';
import { t } from '../../../i18n';
import {
  clearSensitiveDetailFields,
  readActionFeedbackClassName,
  readMissingWorkerEnvName,
  readOperationsModel,
  readTenantSecretUserInputRequired,
  readWorkerPendingProjection,
  readWorkerUnavailableWarning,
  type ActionFeedback,
} from './-instance-detail-page-helpers';
import {
  buildInstanceDoctorModel,
  buildInstanceDetailCockpitModel,
  buildHistoryWorkspaceModel,
  evaluateInstanceConfiguration,
} from './-instance-detail-models';
import {
  createDetailForm,
  createEmptyCreateForm,
  createInstanceSettingsSchema,
  buildInstanceSettingsPayload,
} from './-instance-form-models';
import {
  evaluateRequiredPluginReadiness,
  includeRequiredPluginReadiness,
} from './-instance-required-plugin-readiness';

type InstanceDetailPageProps = {
  readonly instanceId: string;
};

type WorkspaceTab = 'betrieb' | 'doctor' | 'einstellungen';

const DETAIL_AUTO_REFRESH_INTERVAL_MS = 5_000;
const WORKER_UNAVAILABLE_WARNING_THRESHOLD_MS = 15_000;
const ACTION_FEEDBACK_VISIBLE_MS = 15_000;
const ACTION_FEEDBACK_FADE_MS = 300;

export { readActionFeedbackClassName };

export const InstanceDetailPage = ({ instanceId }: InstanceDetailPageProps) => {
  const instancesApi = useInstances();
  const pluginReadiness = usePluginTenantReadiness(instanceId);
  const { loadInstance, isLoading, detailLoading, statusLoading } = instancesApi;
  const detailForm = useForm<DetailFormValues>({
    resolver: zodResolver(createInstanceSettingsSchema()),
    defaultValues: { ...createEmptyCreateForm(), tenantAdminTemporaryPassword: '' },
    shouldUnregister: false,
  });
  const detailFormValues = useWatch({ control: detailForm.control }) as DetailFormValues;
  const setDetailFormValues: React.Dispatch<React.SetStateAction<DetailFormValues | null>> = (
    update
  ) => {
    const next = typeof update === 'function' ? update(detailForm.getValues()) : update;
    if (!next) return;
    for (const key of Object.keys(next) as (keyof DetailFormValues)[])
      detailForm.setValue(key, next[key], { shouldDirty: true });
  };
  const [settingsSaving, setSettingsSaving] = React.useState(false);
  const settingsSavingRef = React.useRef(false);
  const saveFeedback = useStudioSaveFeedback();
  const [actionFeedback, setActionFeedback] = React.useState<ActionFeedback | null>(null);
  const [actionFeedbackFading, setActionFeedbackFading] = React.useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<WorkspaceTab>('betrieb');
  const [activationConfirmation, setActivationConfirmation] = React.useState<string | null>(null);
  const [actionBusy, setActionBusy] = React.useState(false);
  const actionBusyRef = React.useRef(false);
  const previousSelectedInstanceIdRef = React.useRef<string | null>(null);
  const [stalePlan, setStalePlan] = React.useState<{
    instanceId: string;
    fingerprint: string;
  } | null>(null);

  React.useEffect(() => {
    void loadInstance(instanceId);
  }, [instanceId, loadInstance]);

  const selectedInstance =
    instancesApi.selectedInstance?.instanceId === instanceId ? instancesApi.selectedInstance : null;
  const planFingerprint = selectedInstance?.keycloakPlan?.fingerprint;
  const planNeedsRefresh =
    instancesApi.mutationError?.code === 'keycloak_plan_fingerprint_stale' ||
    (Boolean(planFingerprint) &&
      stalePlan?.instanceId === instanceId &&
      stalePlan.fingerprint === planFingerprint);
  React.useEffect(() => {
    if (instancesApi.mutationError?.code === 'keycloak_plan_fingerprint_stale' && planFingerprint)
      setStalePlan({ instanceId, fingerprint: planFingerprint });
  }, [instanceId, instancesApi.mutationError?.code, planFingerprint]);
  const tenantSecretUserInputRequired = readTenantSecretUserInputRequired(
    detailFormValues,
    selectedInstance
  );
  const requiredPluginReadiness = evaluateRequiredPluginReadiness(pluginReadiness.items, {
    isLoading: pluginReadiness.isLoading,
    hasError: Boolean(pluginReadiness.error),
    requiredPluginIds: studioPluginSnapshot.registry.tenantLifecycles.flatMap((lifecycle) =>
      studioPluginSnapshot.tenantActivationPolicySnapshot.modules.some(
        (module) => module.moduleId === lifecycle.pluginId && module.activationPolicy === 'required'
      )
        ? [lifecycle.pluginId]
        : []
    ),
  });
  const configurationAssessment = selectedInstance
    ? includeRequiredPluginReadiness(
        evaluateInstanceConfiguration(selectedInstance, instancesApi.mutationError),
        requiredPluginReadiness
      )
    : null;
  const operationsModel = readOperationsModel(selectedInstance, instancesApi.mutationError);
  const historyModel =
    selectedInstance && operationsModel
      ? buildHistoryWorkspaceModel(selectedInstance, operationsModel)
      : null;
  const cockpitModel =
    selectedInstance && configurationAssessment
      ? buildInstanceDetailCockpitModel(
          selectedInstance,
          instancesApi.mutationError,
          configurationAssessment,
          requiredPluginReadiness,
          planNeedsRefresh
        )
      : null;
  const doctorModel =
    selectedInstance && configurationAssessment && operationsModel
      ? buildInstanceDoctorModel({
          instance: selectedInstance,
          configurationAssessment,
          mutationError: instancesApi.mutationError,
          requiredPluginReadiness,
          planNeedsRefresh,
        })
      : null;
  const missingWorkerEnvName = readMissingWorkerEnvName(selectedInstance);
  const workerPendingProjection = readWorkerPendingProjection(selectedInstance);
  const workerUnavailableWarning = readWorkerUnavailableWarning(
    selectedInstance,
    WORKER_UNAVAILABLE_WARNING_THRESHOLD_MS
  );
  const failedAutomatedCreateRun = selectedInstance?.provisioningRuns.find(
    (run) =>
      run.operation === 'create' &&
      run.status === 'failed' &&
      (run.snapshotVersion === '2.0' || run.snapshotVersion === '3.0') &&
      run.desiredSnapshot.automationMode === 'kassel-traefik-file'
  );
  const canRetryTenantProvisioning =
    selectedInstance?.provisioningReadiness?.nextAction?.action === 'instance.provisioning.retry' &&
    selectedInstance.provisioningReadiness.nextAction.retryClass === 'safe' &&
    Boolean(failedAutomatedCreateRun);
  const hasRunningOperations = Boolean(
    operationsModel?.steps.some((step) => step.status === 'läuft')
  );
  const assignModuleAndRefreshReadiness = React.useCallback(
    async (targetInstanceId: string, moduleId: string) => {
      const success = await instancesApi.assignModule(targetInstanceId, moduleId);
      if (success) await pluginReadiness.refresh();
      return success;
    },
    [instancesApi.assignModule, pluginReadiness.refresh]
  );
  const revokeModuleAndRefreshReadiness = React.useCallback(
    async (targetInstanceId: string, moduleId: string) => {
      const success = await instancesApi.revokeModule(targetInstanceId, moduleId);
      if (success) await pluginReadiness.refresh();
      return success;
    },
    [instancesApi.revokeModule, pluginReadiness.refresh]
  );

  React.useEffect(() => {
    if (selectedInstance) {
      const instanceChanged = previousSelectedInstanceIdRef.current !== selectedInstance.instanceId;

      if (instanceChanged) {
        setActionFeedback(null);
        detailForm.reset(createDetailForm(selectedInstance));
        saveFeedback.reset();
        setActiveWorkspaceTab('betrieb');
        setActivationConfirmation(null);
      }

      previousSelectedInstanceIdRef.current = selectedInstance.instanceId;
    } else {
      previousSelectedInstanceIdRef.current = null;
      setActionFeedback(null);
      setActionFeedbackFading(false);
    }
  }, [selectedInstance, detailForm.reset, saveFeedback.reset]);

  React.useEffect(() => {
    if (!actionFeedback) {
      setActionFeedbackFading(false);
      return undefined;
    }

    setActionFeedbackFading(false);

    const fadeTimeoutId = window.setTimeout(() => {
      setActionFeedbackFading(true);
    }, ACTION_FEEDBACK_VISIBLE_MS);
    const clearTimeoutId = window.setTimeout(() => {
      setActionFeedback(null);
      setActionFeedbackFading(false);
    }, ACTION_FEEDBACK_VISIBLE_MS + ACTION_FEEDBACK_FADE_MS);

    return () => {
      window.clearTimeout(fadeTimeoutId);
      window.clearTimeout(clearTimeoutId);
    };
  }, [actionFeedback]);

  React.useEffect(() => {
    if (!selectedInstance || !hasRunningOperations) {
      return undefined;
    }
    if (isLoading || detailLoading || statusLoading) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadInstance(selectedInstance.instanceId);
    }, DETAIL_AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    detailLoading,
    hasRunningOperations,
    isLoading,
    loadInstance,
    selectedInstance,
    statusLoading,
  ]);

  React.useEffect(() => {
    const selectedInstanceId = selectedInstance?.instanceId;
    if (!selectedInstanceId) {
      return;
    }

    void instancesApi.refreshInstanceAudit(selectedInstanceId);
  }, [instancesApi.refreshInstanceAudit, selectedInstance?.instanceId]);

  const onUpdateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedInstance || settingsSavingRef.current) return;
    settingsSavingRef.current = true;
    if (!(await detailForm.trigger())) {
      settingsSavingRef.current = false;
      setActiveWorkspaceTab('einstellungen');
      globalThis.setTimeout(() => document.getElementById('instance-settings-errors')?.focus(), 0);
      return;
    }
    settingsSavingRef.current = true;
    setSettingsSaving(true);
    const operationId = saveFeedback.beginSaving();
    try {
      const updated = await instancesApi.updateInstance(
        selectedInstance.instanceId,
        buildInstanceSettingsPayload(detailForm.getValues())
      );
      if (updated) {
        const cleared = clearSensitiveDetailFields(detailForm.getValues());
        if (cleared) detailForm.reset(cleared);
        saveFeedback.markSaved(operationId);
      } else saveFeedback.markFailed(operationId);
    } finally {
      settingsSavingRef.current = false;
      setSettingsSaving(false);
    }
  };

  const onSaveAccountInvitationTemplate = async (
    template: Omit<
      NonNullable<NonNullable<typeof selectedInstance>['accountInvitationTemplate']>,
      'revision'
    > | null
  ): Promise<AccountInvitationTemplateSaveResult> => {
    if (!selectedInstance || settingsSavingRef.current) return false;
    settingsSavingRef.current = true;
    setSettingsSaving(true);
    const failure = { conflict: false };
    try {
      const updated = await instancesApi.updateInstance(
        selectedInstance.instanceId,
        {
          ...buildInstanceSettingsPayload(createDetailForm(selectedInstance)),
          accountInvitationTemplate: template,
          accountInvitationTemplateRevision:
            selectedInstance.accountInvitationTemplate?.revision ?? 0,
        },
        (error) => {
          failure.conflict = error.code === 'conflict';
        }
      );
      if (failure.conflict) await instancesApi.loadInstance(selectedInstance.instanceId);
      return updated ? true : failure.conflict ? 'conflict' : false;
    } finally {
      settingsSavingRef.current = false;
      setSettingsSaving(false);
    }
  };

  const { runDetailAction } = createInstanceDetailActions({
    selectedInstance,
    detailFormValues,
    detailForm,
    instancesApi,
    planNeedsRefresh,
    canRetryTenantProvisioning,
    setActionFeedback,
    setStalePlan,
    setActivationConfirmation,
    setActiveWorkspaceTab,
    actionBusyRef,
    setActionBusy,
  });
  const openActivation = () => {
    setActiveWorkspaceTab('betrieb');
    globalThis.setTimeout(() => document.getElementById('instance-current-task')?.focus(), 0);
  };

  return (
    <section
      className="min-w-0 space-y-5 break-words"
      aria-busy={instancesApi.isLoading || instancesApi.detailLoading}
    >
      <InstanceDetailFeedback
        actionFeedback={actionFeedback}
        actionFeedbackFading={actionFeedbackFading}
        missingWorkerEnvName={missingWorkerEnvName}
        workerPendingProjection={workerPendingProjection}
        workerUnavailableWarning={workerUnavailableWarning}
        mutationError={instancesApi.mutationError}
        selectedInstance={selectedInstance}
      />

      {selectedInstance && detailFormValues && operationsModel && cockpitModel ? (
        <InstanceDetailWorkspace
          selectedInstance={selectedInstance}
          detailFormValues={detailFormValues}
          operationsModel={operationsModel}
          cockpitModel={cockpitModel}
          doctorModel={doctorModel}
          historyModel={historyModel}
          configurationAssessment={configurationAssessment}
          pluginReadiness={pluginReadiness}
          instancesApi={instancesApi}
          activeWorkspaceTab={activeWorkspaceTab}
          setActiveWorkspaceTab={setActiveWorkspaceTab}
          runDetailAction={runDetailAction}
          statusLoading={statusLoading}
          actionBusy={actionBusy}
          assignModuleAndRefreshReadiness={assignModuleAndRefreshReadiness}
          revokeModuleAndRefreshReadiness={revokeModuleAndRefreshReadiness}
          openActivation={openActivation}
          detailForm={detailForm}
          settingsSaving={settingsSaving}
          tenantSecretUserInputRequired={tenantSecretUserInputRequired}
          setDetailFormValues={setDetailFormValues}
          onUpdateSubmit={onUpdateSubmit}
          onSaveAccountInvitationTemplate={onSaveAccountInvitationTemplate}
          saveStatus={saveFeedback.status}
          markDirty={saveFeedback.markDirty}
          activationConfirmation={activationConfirmation}
          setActivationConfirmation={setActivationConfirmation}
          actionBusyRef={actionBusyRef}
          setActionBusy={setActionBusy}
        />
      ) : (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{t('content.messages.loading')}</p>
        </Card>
      )}
    </section>
  );
};
