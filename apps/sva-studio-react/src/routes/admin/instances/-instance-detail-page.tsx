import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { formatEditorDateTime } from '../../../lib/editor-date-time';
import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import { InstanceDetailBetriebSection } from './-instance-detail-betrieb-section';
import { InstanceDetailAuditSection } from './-instance-detail-audit-section';
import { InstanceDetailConfigurationSection } from './-instance-detail-configuration-section';
import { InstanceDetailDoctorSection } from './-instance-detail-doctor-section';
import { InstanceDetailHeader } from './-instance-detail-header';
import {
  buildInstanceDoctorModel,
  buildExistingRealmOperationsModel,
  buildHistoryWorkspaceModel,
  buildNewRealmOperationsModel,
  buildOperationsPrimaryAction,
  type DetailWorkflowAction,
  evaluateInstanceConfiguration,
  getStatusGuidance,
} from './-instance-detail-models';
import { getErrorMessage } from './-instance-error-messages';
import {
  createDetailForm,
  isTenantSecretUserInputRequired,
} from './-instance-form-models';

type InstanceDetailPageProps = {
  readonly instanceId: string;
};

type ActionFeedback = {
  readonly tone: 'success' | 'warning';
  readonly message: string;
};

type WorkspaceTab = 'betrieb' | 'doctor' | 'einstellungen';

const DETAIL_AUTO_REFRESH_INTERVAL_MS = 5_000;
const WORKER_UNAVAILABLE_WARNING_THRESHOLD_MS = 15_000;
const ACTION_FEEDBACK_VISIBLE_MS = 15_000;
const ACTION_FEEDBACK_FADE_MS = 300;

const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }
  return formatEditorDateTime(value) ?? value;
};

const readActualLatestKeycloakRun = (instance: ReturnType<typeof useInstances>['selectedInstance']) =>
  instance?.keycloakProvisioningRuns[0] ?? instance?.latestKeycloakProvisioningRun;

const readPreflightTimestamp = (instance: ReturnType<typeof useInstances>['selectedInstance']) => {
  if (!instance?.keycloakPreflight || typeof instance.keycloakPreflight !== 'object') {
    return undefined;
  }

  if ('checkedAt' in instance.keycloakPreflight && typeof instance.keycloakPreflight.checkedAt === 'string') {
    return instance.keycloakPreflight.checkedAt;
  }

  if (
    'generatedAt' in instance.keycloakPreflight &&
    typeof (instance.keycloakPreflight as { generatedAt?: string }).generatedAt === 'string'
  ) {
    return (instance.keycloakPreflight as { generatedAt?: string }).generatedAt;
  }

  return undefined;
};

const readWorkerPendingProjection = (instance: ReturnType<typeof useInstances>['selectedInstance']) =>
  Boolean(
    instance?.keycloakPreflight?.checks.some((check) => {
      const details = check.details as Record<string, unknown> | undefined;
      return details?.source === 'worker_pending';
    })
  );

const readMissingWorkerEnvName = (instance: ReturnType<typeof useInstances>['selectedInstance']) => {
  const preflightStep = readActualLatestKeycloakRun(instance)?.steps.find(
    (step) => step.stepKey === 'worker_preflight_snapshot'
  );
  const details = preflightStep?.details as
    | {
        preflight?: {
          checks?: Array<{
            checkKey?: string;
            details?: {
              error?: string;
            };
          }>;
        };
      }
    | undefined;
  const keycloakAccessCheck = details?.preflight?.checks?.find((check) => check.checkKey === 'keycloak_admin_access');
  const error = keycloakAccessCheck?.details?.error;
  if (!error?.startsWith('Missing required env: ')) {
    return undefined;
  }
  return error.replace('Missing required env: ', '').trim() || undefined;
};

const readWorkerUnavailableWarning = (instance: ReturnType<typeof useInstances>['selectedInstance']) => {
  const latestRun = readActualLatestKeycloakRun(instance);
  if (!latestRun || latestRun.overallStatus !== 'planned') {
    return false;
  }

  const hasWorkerEvidence = latestRun.steps.some((step) =>
    step.stepKey === 'worker' || step.stepKey === 'execution' || step.stepKey.startsWith('worker_'),
  );
  if (hasWorkerEvidence) {
    return false;
  }

  const referenceTimestamp = Date.parse(latestRun.updatedAt || latestRun.createdAt);
  if (Number.isNaN(referenceTimestamp)) {
    return false;
  }

  return Date.now() - referenceTimestamp >= WORKER_UNAVAILABLE_WARNING_THRESHOLD_MS;
};

const readTenantSecretUserInputRequired = (
  detailFormValues: ReturnType<typeof createDetailForm> | null,
  selectedInstance: ReturnType<typeof useInstances>['selectedInstance']
) => {
  if (detailFormValues) {
    return isTenantSecretUserInputRequired(detailFormValues.realmMode);
  }

  if (selectedInstance) {
    return isTenantSecretUserInputRequired(selectedInstance.realmMode);
  }

  return true;
};

const readOperationsModel = (
  selectedInstance: ReturnType<typeof useInstances>['selectedInstance'],
  mutationError: ReturnType<typeof useInstances>['mutationError']
) => {
  if (!selectedInstance) {
    return null;
  }

  if (selectedInstance.realmMode === 'new') {
    return buildNewRealmOperationsModel(selectedInstance, mutationError);
  }

  return buildExistingRealmOperationsModel(selectedInstance, mutationError);
};

export const readActionFeedbackClassName = (actionFeedback: ActionFeedback, actionFeedbackFading: boolean) => {
  const opacityClassName = actionFeedbackFading ? 'opacity-0' : 'opacity-100';

  if (actionFeedback.tone === 'success') {
    return `border-emerald-500/40 bg-emerald-500/10 text-emerald-900 transition-opacity duration-300 ${opacityClassName}`;
  }

  return `border-amber-500/40 bg-amber-500/10 text-amber-950 transition-opacity duration-300 ${opacityClassName}`;
};

const clearSensitiveDetailFields = (current: ReturnType<typeof createDetailForm> | null) => {
  if (!current) {
    return current;
  }

  return {
    ...current,
    authClientSecret: '',
    tenantAdminClient: {
      ...current.tenantAdminClient,
      secret: '',
    },
  };
};

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

  if (classification !== 'registry_or_provisioning_drift' && classification !== 'keycloak_reconcile') {
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
        <p>{t('admin.instances.diagnostics.planEvidence', { summary: instance.keycloakPlan.driftSummary })}</p>
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
  const { loadInstance, isLoading, detailLoading, statusLoading } = instancesApi;
  const [detailFormValues, setDetailFormValues] = React.useState<ReturnType<typeof createDetailForm> | null>(null);
  const [actionFeedback, setActionFeedback] = React.useState<ActionFeedback | null>(null);
  const [actionFeedbackFading, setActionFeedbackFading] = React.useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<WorkspaceTab>('betrieb');
  const previousSelectedInstanceIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    void loadInstance(instanceId);
  }, [instanceId, loadInstance]);

  const selectedInstance = instancesApi.selectedInstance?.instanceId === instanceId ? instancesApi.selectedInstance : null;
  const tenantSecretUserInputRequired = readTenantSecretUserInputRequired(detailFormValues, selectedInstance);
  const configurationAssessment = selectedInstance ? evaluateInstanceConfiguration(selectedInstance, instancesApi.mutationError) : null;
  const operationsModel = readOperationsModel(selectedInstance, instancesApi.mutationError);
  const historyModel = selectedInstance && operationsModel ? buildHistoryWorkspaceModel(selectedInstance, operationsModel) : null;
  const primaryAction = operationsModel ? buildOperationsPrimaryAction(operationsModel) : null;
  const doctorModel =
    selectedInstance && configurationAssessment && operationsModel && primaryAction
      ? buildInstanceDoctorModel({
          instance: selectedInstance,
          configurationAssessment,
          mutationError: instancesApi.mutationError,
          operationsModel,
          primaryAction,
        })
      : null;
  const missingWorkerEnvName = readMissingWorkerEnvName(selectedInstance);
  const workerPendingProjection = readWorkerPendingProjection(selectedInstance);
  const workerUnavailableWarning = readWorkerUnavailableWarning(selectedInstance);
  const hasRunningOperations = Boolean(operationsModel?.steps.some((step) => step.status === 'läuft'));

  React.useEffect(() => {
    if (selectedInstance) {
      const instanceChanged = previousSelectedInstanceIdRef.current !== selectedInstance.instanceId;

      if (instanceChanged) {
        setActionFeedback(null);
        setDetailFormValues(createDetailForm(selectedInstance));
        setActiveWorkspaceTab('betrieb');
      } else if (!detailFormValues) {
        setDetailFormValues(createDetailForm(selectedInstance));
      }

      previousSelectedInstanceIdRef.current = selectedInstance.instanceId;
    } else {
      previousSelectedInstanceIdRef.current = null;
      setActionFeedback(null);
      setActionFeedbackFading(false);
      setDetailFormValues(null);
    }
  }, [detailFormValues, selectedInstance]);

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
    if (!selectedInstance || !detailFormValues) {
      return;
    }

    await instancesApi.updateInstance(selectedInstance.instanceId, {
      displayName: detailFormValues.displayName.trim(),
      parentDomain: detailFormValues.parentDomain.trim(),
      realmMode: detailFormValues.realmMode,
      authRealm: detailFormValues.authRealm.trim(),
      authClientId: detailFormValues.authClientId.trim(),
      authIssuerUrl: detailFormValues.authIssuerUrl.trim() || undefined,
      authClientSecret: detailFormValues.authClientSecret.trim() || undefined,
      tenantAdminClient: detailFormValues.tenantAdminClient.clientId.trim()
        ? {
            clientId: detailFormValues.tenantAdminClient.clientId.trim(),
            secret: detailFormValues.tenantAdminClient.secret.trim() || undefined,
          }
        : undefined,
      tenantAdminBootstrap: detailFormValues.tenantAdminBootstrap.username.trim()
        ? {
            username: detailFormValues.tenantAdminBootstrap.username.trim(),
            email: detailFormValues.tenantAdminBootstrap.email.trim() || undefined,
            firstName: detailFormValues.tenantAdminBootstrap.firstName.trim() || undefined,
            lastName: detailFormValues.tenantAdminBootstrap.lastName.trim() || undefined,
          }
        : undefined,
    });

    setDetailFormValues(clearSensitiveDetailFields);
  };

  const executeProvisioning = async (
    intent: 'provision' | 'provision_admin_client' | 'reset_tenant_admin' | 'rotate_client_secret'
  ) => {
    if (!selectedInstance || !detailFormValues) {
      return;
    }

    setActionFeedback(null);
    const result = await instancesApi.executeKeycloakProvisioning(selectedInstance.instanceId, {
      intent,
      tenantAdminTemporaryPassword: detailFormValues.tenantAdminTemporaryPassword.trim() || undefined,
    });
    if (result) {
      setActionFeedback({
        tone: 'success',
        message: t('admin.instances.feedback.provisioningQueued'),
      });
    }
    await instancesApi.loadInstance(selectedInstance.instanceId);
    setDetailFormValues((current) => (current ? { ...current, tenantAdminTemporaryPassword: '' } : current));
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
        await instancesApi.activateInstance(selectedInstance.instanceId);
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

  const runDetailAction = async (action: DetailWorkflowAction | 'focus_configuration') => {
    switch (action) {
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
        await instancesApi.reconcileKeycloak(selectedInstance.instanceId, {});
        return;
      case 'rotate_client_secret':
        await executeProvisioning('rotate_client_secret');
        return;
      default:
        await triggerWorkflowAction(action);
    }
  };

  return (
    <section className="space-y-5" aria-busy={instancesApi.isLoading || instancesApi.detailLoading}>
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
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950">
          <AlertDescription>{t('admin.instances.feedback.workerProjectionHint')}</AlertDescription>
        </Alert>
      ) : null}

      {workerUnavailableWarning && !missingWorkerEnvName ? (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950">
          <AlertDescription>{t('admin.instances.feedback.workerUnavailable')}</AlertDescription>
        </Alert>
      ) : null}

      {instancesApi.mutationError && instancesApi.mutationError.code !== 'keycloak_unavailable' ? (
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

      {selectedInstance && detailFormValues && operationsModel && primaryAction ? (
        <div className="space-y-5">
          <InstanceDetailHeader
            selectedInstance={selectedInstance}
            operationalTitle={getStatusGuidance(selectedInstance).title}
            operationalSummary={operationsModel.summary}
            onOpenDoctor={() => setActiveWorkspaceTab('doctor')}
            doctorWarning={doctorModel?.warning}
          />

          <Tabs value={activeWorkspaceTab} onValueChange={(value) => setActiveWorkspaceTab(value as WorkspaceTab)} className="space-y-4">
            <TabsList aria-label={t('admin.instances.cockpit.tabsAriaLabel')} className="h-auto flex-wrap justify-start">
              <TabsTrigger value="betrieb">{t('admin.instances.detail.tabs.betrieb')}</TabsTrigger>
              <TabsTrigger value="doctor">{t('admin.instances.detail.tabs.doctor')}</TabsTrigger>
              <TabsTrigger value="einstellungen">{t('admin.instances.detail.tabs.einstellungen')}</TabsTrigger>
            </TabsList>

            <TabsContent value="betrieb" className="space-y-5">
              <InstanceDetailBetriebSection
                selectedInstance={selectedInstance}
                statusLoading={instancesApi.statusLoading}
                mutationError={instancesApi.mutationError}
                onAssignModule={instancesApi.assignModule}
                onRevokeModule={instancesApi.revokeModule}
                onSeedIamBaseline={instancesApi.seedIamBaseline}
                onBootstrapAdminStructure={instancesApi.bootstrapAdminStructure}
              />
              <InstanceDetailAuditSection
                auditRun={instancesApi.instanceAuditRun}
                auditLoading={instancesApi.auditLoading}
                onRefresh={async () => instancesApi.refreshInstanceAudit(selectedInstance.instanceId)}
              />
            </TabsContent>

            <TabsContent value="doctor" className="space-y-5">
              {doctorModel && historyModel ? (
                <InstanceDetailDoctorSection
                  doctorModel={doctorModel}
                  historyModel={historyModel}
                  selectedInstance={selectedInstance}
                  statusLoading={instancesApi.statusLoading}
                  onRunDetailAction={runDetailAction}
                  onLoadProvisioningRun={(runId) => instancesApi.loadKeycloakProvisioningRun(selectedInstance.instanceId, runId)}
                />
              ) : null}
            </TabsContent>

            <TabsContent value="einstellungen" className="space-y-5">
              <InstanceDetailConfigurationSection
                selectedInstance={selectedInstance}
                detailFormValues={detailFormValues}
                statusLoading={statusLoading}
                configurationAssessment={configurationAssessment}
                tenantSecretUserInputRequired={tenantSecretUserInputRequired}
                setDetailFormValues={setDetailFormValues}
                onUpdateSubmit={onUpdateSubmit}
              />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{t('content.messages.loading')}</p>
        </Card>
      )}
    </section>
  );
};
