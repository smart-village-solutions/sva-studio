import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import type { DetailFormValues } from './-instances-shared-types';
import type { AccountInvitationTemplateSaveResult } from './-account-invitation-template-card';
import React from 'react';
import { StudioField, useStudioSaveFeedback } from '@sva/studio-ui-react';
import { Input } from '../../../components/ui/input';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Card } from '../../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { useInstances } from '../../../hooks/use-instances';
import { usePluginTenantReadiness } from '../../../hooks/use-plugin-tenant-readiness';
import { studioPluginSnapshot } from '../../../lib/plugins';
import { t } from '../../../i18n';
import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import {
  clearSensitiveDetailFields,
  formatDateTime,
  readActionFeedbackClassName,
  readMissingWorkerEnvName,
  readOperationsModel,
  readPreflightTimestamp,
  readTenantSecretUserInputRequired,
  readWorkerPendingProjection,
  readWorkerUnavailableWarning,
  type ActionFeedback,
} from './-instance-detail-page-helpers';
import { InstanceDetailBetriebSection } from './-instance-detail-betrieb-section';
import { InstanceDetailAuditSection } from './-instance-detail-audit-section';
import { InstanceDetailConfigurationSection } from './-instance-detail-configuration-section';
import { InstanceDetailCockpitSection } from './-instance-detail-cockpit-section';
import { InstanceDetailDoctorSection } from './-instance-detail-doctor-section';
import { InstanceDetailHeader } from './-instance-detail-header';
import {
  buildInstanceDoctorModel,
  buildInstanceDetailCockpitModel,
  buildHistoryWorkspaceModel,
  type DetailWorkflowAction,
  evaluateInstanceConfiguration,
} from './-instance-detail-models';
import { getErrorMessage } from './-instance-error-messages';
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

const InstanceRuntimeEvidence = ({
  classification,
  instance,
}: {
  classification?: string;
  instance: ReturnType<typeof useInstances>['selectedInstance'];
}) => {
  if (!instance) {
    return null;
  }

  if (
    classification !== 'registry_or_provisioning_drift' &&
    classification !== 'keycloak_reconcile'
  ) {
    return null;
  }

  const preflightTimestamp = readPreflightTimestamp(instance);
  const latestRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];

  if (!instance.keycloakPreflight && !instance.keycloakPlan && !latestRun) {
    return null;
  }

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {instance.keycloakPreflight ? (
        <p>
          {t('admin.instances.diagnostics.preflightEvidence', {
            status: instance.keycloakPreflight.overallStatus,
            checkedAt: formatDateTime(preflightTimestamp),
          })}
        </p>
      ) : null}
      {instance.keycloakPlan ? (
        <p>
          {t('admin.instances.diagnostics.planEvidence', {
            summary: instance.keycloakPlan.driftSummary,
          })}
        </p>
      ) : null}
      {latestRun ? (
        <p>
          {t('admin.instances.diagnostics.latestRunEvidence', {
            requestId: latestRun.requestId ?? t('shell.runtimeHealth.notAvailable'),
            status: latestRun.overallStatus,
          })}
        </p>
      ) : null}
    </div>
  );
};

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

  React.useEffect(() => {
    void loadInstance(instanceId);
  }, [instanceId, loadInstance]);

  const selectedInstance =
    instancesApi.selectedInstance?.instanceId === instanceId ? instancesApi.selectedInstance : null;
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
          requiredPluginReadiness
        )
      : null;
  const doctorModel =
    selectedInstance && configurationAssessment && operationsModel
      ? buildInstanceDoctorModel({
          instance: selectedInstance,
          configurationAssessment,
          mutationError: instancesApi.mutationError,
          requiredPluginReadiness,
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

  const executeProvisioning = async (
    intent: 'provision' | 'provision_admin_client' | 'reset_tenant_admin' | 'rotate_client_secret'
  ) => {
    if (!selectedInstance || !detailFormValues) {
      return;
    }
    const planFingerprint = selectedInstance.keycloakPlan?.fingerprint;
    if (!planFingerprint) return;

    setActionFeedback(null);
    const result = await instancesApi.executeKeycloakProvisioning(selectedInstance.instanceId, {
      intent,
      planFingerprint,
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
  const openActivation = () => {
    setActiveWorkspaceTab('betrieb');
    globalThis.setTimeout(() => document.getElementById('instance-current-task')?.focus(), 0);
  };

  const tenantAdminPasswordInput = cockpitModel?.secondaryActions.some(
    ({ action }) => action === 'reset_tenant_admin'
  ) ? (
    <StudioField
      id="tenant-admin-password"
      label={t('admin.instances.keycloakPanel.temporaryPassword')}
      description={t('admin.instances.keycloakPanel.passwordHint')}
    >
      <Input
        id="tenant-admin-password"
        type="password"
        autoComplete="new-password"
        aria-describedby="tenant-admin-password-description"
        disabled={statusLoading || actionBusy}
        value={detailFormValues?.tenantAdminTemporaryPassword ?? ''}
        onChange={(event) =>
          detailForm.setValue('tenantAdminTemporaryPassword', event.target.value, {
            shouldDirty: true,
          })
        }
      />
    </StudioField>
  ) : null;

  return (
    <section
      className="min-w-0 space-y-5 break-words"
      aria-busy={instancesApi.isLoading || instancesApi.detailLoading}
    >
      {actionFeedback ? (
        <Alert className={readActionFeedbackClassName(actionFeedback, actionFeedbackFading)}>
          <AlertDescription>{actionFeedback.message}</AlertDescription>
        </Alert>
      ) : null}

      {missingWorkerEnvName ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>
            {t('admin.instances.feedback.workerEnvMissing', {
              envName: missingWorkerEnvName,
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      {workerPendingProjection && !missingWorkerEnvName ? (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertDescription>{t('admin.instances.feedback.workerProjectionHint')}</AlertDescription>
        </Alert>
      ) : null}

      {workerUnavailableWarning && !missingWorkerEnvName ? (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertDescription>{t('admin.instances.feedback.workerUnavailable')}</AlertDescription>
        </Alert>
      ) : null}

      {instancesApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{getErrorMessage(instancesApi.mutationError)}</span>
            <IamRuntimeDiagnosticDetails error={instancesApi.mutationError} />
            <InstanceRuntimeEvidence
              classification={instancesApi.mutationError.classification}
              instance={selectedInstance}
            />
          </AlertDescription>
        </Alert>
      ) : null}

      {selectedInstance && detailFormValues && operationsModel && cockpitModel ? (
        <div className="space-y-5">
          <InstanceDetailHeader
            selectedInstance={selectedInstance}
            operationalTitle={cockpitModel.overallTitle}
            operationalSummary={operationsModel.summary}
            onOpenDoctor={() => {
              setActiveWorkspaceTab('doctor');
            }}
            doctorWarning={doctorModel?.warning}
          />

          {!['active', 'suspended', 'archived'].includes(selectedInstance.status) &&
          activeWorkspaceTab === 'betrieb' ? (
            <InstanceDetailCockpitSection
              selectedInstance={selectedInstance}
              configurationAssessment={configurationAssessment}
              cockpitModel={cockpitModel}
              tenantAdminPasswordInput={tenantAdminPasswordInput}
              mutationError={instancesApi.mutationError}
              onRunDetailAction={runDetailAction}
              statusLoading={instancesApi.statusLoading || actionBusy}
            />
          ) : null}

          <Tabs
            value={activeWorkspaceTab}
            onValueChange={(value) => setActiveWorkspaceTab(value as WorkspaceTab)}
            className="space-y-4"
          >
            <TabsList
              aria-label={t('admin.instances.cockpit.tabsAriaLabel')}
              className="h-auto flex-wrap justify-start"
            >
              <TabsTrigger value="betrieb">{t('admin.instances.detail.tabs.betrieb')}</TabsTrigger>
              <TabsTrigger value="doctor">{t('admin.instances.detail.tabs.doctor')}</TabsTrigger>
              <TabsTrigger value="einstellungen">
                {t('admin.instances.detail.tabs.einstellungen')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="betrieb" className="space-y-5">
              <InstanceDetailBetriebSection
                selectedInstance={selectedInstance}
                statusLoading={instancesApi.statusLoading}
                mutationError={instancesApi.mutationError}
                pluginReadiness={pluginReadiness}
                onAssignModule={assignModuleAndRefreshReadiness}
                onRevokeModule={revokeModuleAndRefreshReadiness}
                onSeedIamBaseline={instancesApi.seedIamBaseline}
                onBootstrapAdminStructure={instancesApi.bootstrapAdminStructure}
              />
            </TabsContent>

            <TabsContent value="doctor" className="space-y-5">
              {doctorModel && historyModel ? (
                <InstanceDetailDoctorSection
                  doctorModel={doctorModel}
                  tenantAdminPasswordInput={tenantAdminPasswordInput}
                  secondaryActions={cockpitModel.secondaryActions}
                  onRunDetailAction={runDetailAction}
                  onOpenActivation={openActivation}
                  statusLoading={statusLoading || actionBusy}
                  auditContent={
                    <InstanceDetailAuditSection
                      auditRun={instancesApi.instanceAuditRun}
                      auditLoading={instancesApi.auditLoading}
                      onRefresh={async () =>
                        instancesApi.refreshInstanceAudit(selectedInstance.instanceId)
                      }
                    />
                  }
                  historyModel={historyModel}
                  selectedInstance={selectedInstance}
                  onLoadProvisioningRun={(runId) =>
                    instancesApi.loadKeycloakProvisioningRun(selectedInstance.instanceId, runId)
                  }
                />
              ) : null}
            </TabsContent>

            <TabsContent
              value="einstellungen"
              forceMount
              hidden={activeWorkspaceTab !== 'einstellungen'}
              className="space-y-5"
            >
              <InstanceDetailConfigurationSection
                selectedInstance={selectedInstance}
                form={detailForm}
                saving={settingsSaving}
                detailFormValues={detailFormValues}
                statusLoading={statusLoading}
                configurationAssessment={configurationAssessment}
                tenantSecretUserInputRequired={tenantSecretUserInputRequired}
                setDetailFormValues={(value) => {
                  saveFeedback.markDirty();
                  setDetailFormValues(value);
                }}
                onUpdateSubmit={onUpdateSubmit}
                onSaveAccountInvitationTemplate={onSaveAccountInvitationTemplate}
                saveStatus={saveFeedback.status}
              />
            </TabsContent>
          </Tabs>

          <ConfirmDialog
            open={activationConfirmation !== null}
            title={t('admin.instances.actions.activate')}
            description={t('admin.instances.detail.confirmActivation')}
            confirmLabel={t('admin.instances.actions.activate')}
            cancelLabel={t('account.actions.cancel')}
            onCancel={() => setActivationConfirmation(null)}
            onConfirm={() => {
              const stillCurrent =
                activationConfirmation === selectedInstance.updatedAt &&
                selectedInstance.provisioningReadiness?.nextAction?.action ===
                  'instance.status.activate';
              setActivationConfirmation(null);
              if (stillCurrent && !actionBusyRef.current) {
                actionBusyRef.current = true;
                setActionBusy(true);
                void instancesApi.activateInstance(selectedInstance.instanceId).finally(() => {
                  actionBusyRef.current = false;
                  setActionBusy(false);
                });
              }
            }}
          />
        </div>
      ) : (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{t('content.messages.loading')}</p>
        </Card>
      )}
    </section>
  );
};
