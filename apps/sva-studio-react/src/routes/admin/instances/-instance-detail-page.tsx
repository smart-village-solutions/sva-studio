import { Link } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import { InstanceDetailConfigurationSection } from './-instance-detail-configuration-section';
import {
  buildExistingRealmOperationsModel,
  buildHistoryWorkspaceModel,
  buildNewRealmOperationsModel,
  buildOperationsPrimaryAction,
  type DetailWorkflowAction,
  getOperationsActionLabel,
  getOperationsEvidenceSourceLabel,
  evaluateInstanceConfiguration,
  getStatusGuidance,
} from './-instance-detail-models';
import { getErrorMessage } from './-instance-error-messages';
import {
  createDetailForm,
  isTenantSecretUserInputRequired,
} from './-instance-form-models';
import { COCKPIT_STATUS_STYLES, INSTANCE_STATUS_LABELS } from './-instance-detail-view-shared';
import {
  OperationsStepStatusBadge,
  ProvisioningStepBadge,
} from './-instance-status-badges';
import type { OperationsDetailAction, OperationsStepModel } from './-instances-shared';

type InstanceDetailPageProps = {
  readonly instanceId: string;
};

type ActionFeedback = {
  readonly tone: 'success' | 'warning';
  readonly message: string;
};

type WorkspaceTab = 'overview' | 'configuration' | 'history';

const DETAIL_AUTO_REFRESH_INTERVAL_MS = 5_000;
const WORKER_UNAVAILABLE_WARNING_THRESHOLD_MS = 15_000;
const ACTION_FEEDBACK_VISIBLE_MS = 15_000;
const ACTION_FEEDBACK_FADE_MS = 300;

const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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

const readActionFeedbackClassName = (actionFeedback: ActionFeedback, actionFeedbackFading: boolean) => {
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

const OperationsOverviewCard = ({
  title,
  summary,
  primaryActionLabel,
  onPrimaryAction,
  disabled,
}: {
  title: string;
  summary: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  disabled: boolean;
}) => (
  <Card className="space-y-4 p-5">
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {t('admin.instances.operations.overview.eyebrow')}
      </div>
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{summary}</p>
    </div>
    <div className="flex flex-wrap gap-3">
      <Button type="button" onClick={onPrimaryAction} disabled={disabled}>
        {primaryActionLabel}
      </Button>
    </div>
  </Card>
);

const OperationsStepsPanel = ({
  title,
  subtitle,
  steps,
  onAction,
  disabled,
}: {
  title: string;
  subtitle: string;
  steps: readonly OperationsStepModel[];
  onAction: (action: OperationsDetailAction) => void;
  disabled: boolean;
}) => (
  <Card className="space-y-4 p-4">
    <div className="space-y-1">
      <div className="font-medium text-foreground">{title}</div>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
    <div className="grid gap-3">
      {steps.map((step) => (
        <div key={step.key} className="rounded-xl border border-border/70 bg-background/85 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-medium text-foreground">{step.title}</div>
              <p className="text-sm text-muted-foreground">{step.summary}</p>
            </div>
            <OperationsStepStatusBadge status={step.status} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{t('admin.instances.operations.labels.evidence', { value: getOperationsEvidenceSourceLabel(step.evidenceSource) })}</span>
            {step.checkedAt ? <span>{t('admin.instances.cockpit.checkedAt', { value: formatDateTime(step.checkedAt) })}</span> : null}
            {step.requestId ? <span>{t('admin.instances.tenantIam.requestId', { value: step.requestId })}</span> : null}
          </div>
          {step.action ? (
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => onAction(step.action!)} disabled={disabled}>
                {getOperationsActionLabel(step.action)}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  </Card>
);

export const InstanceDetailPage = ({ instanceId }: InstanceDetailPageProps) => {
  const instancesApi = useInstances();
  const { loadInstance, isLoading, detailLoading, statusLoading } = instancesApi;
  const [detailFormValues, setDetailFormValues] = React.useState<ReturnType<typeof createDetailForm> | null>(null);
  const [actionFeedback, setActionFeedback] = React.useState<ActionFeedback | null>(null);
  const [actionFeedbackFading, setActionFeedbackFading] = React.useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<WorkspaceTab>('overview');
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
  const operationsAnomalies = operationsModel?.steps.filter((step) => step.status === 'fehlgeschlagen').slice(0, 3) ?? [];
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
        setActiveWorkspaceTab('overview');
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
        setActiveWorkspaceTab('configuration');
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
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.detail.title')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.instances.detail.subtitle')}</p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/instances">{t('admin.instances.actions.back')}</Link>
        </Button>
      </header>

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
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('admin.instances.cockpit.identity')}
              </div>
              <div className="mt-3 space-y-1">
                <div className="text-lg font-semibold text-foreground">{selectedInstance.displayName}</div>
                <div className="text-sm text-muted-foreground">{selectedInstance.instanceId}</div>
                <div className="text-sm text-muted-foreground">
                  {t('admin.instances.detail.primaryHostname', { value: selectedInstance.primaryHostname })}
                </div>
              </div>
            </div>
            <div className={`rounded-2xl border p-4 shadow-sm ${COCKPIT_STATUS_STYLES[operationsModel.status]}`}>
              <div className="text-xs uppercase tracking-wide opacity-80">{t('admin.instances.operations.labels.currentState')}</div>
              <div className="mt-3 space-y-2">
                <div className="text-lg font-semibold">{getStatusGuidance(selectedInstance).title}</div>
                <p className="text-sm opacity-90">{operationsModel.summary}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('admin.instances.cockpit.lifecycle')}
              </div>
              <div className="mt-3 space-y-1">
                <div className="text-lg font-semibold text-foreground">{t(INSTANCE_STATUS_LABELS[selectedInstance.status])}</div>
                <div className="text-sm text-muted-foreground">
                  {t('admin.instances.detail.parentDomain', { value: selectedInstance.parentDomain })}
                </div>
              </div>
            </div>
          </div>

          <Tabs value={activeWorkspaceTab} onValueChange={(value) => setActiveWorkspaceTab(value as WorkspaceTab)} className="space-y-4">
            <TabsList aria-label={t('admin.instances.cockpit.tabsAriaLabel')} className="h-auto flex-wrap justify-start">
              <TabsTrigger value="overview">{t('admin.instances.cockpit.tabs.overview')}</TabsTrigger>
              <TabsTrigger value="configuration">{t('admin.instances.cockpit.tabs.configuration')}</TabsTrigger>
              <TabsTrigger value="history">{t('admin.instances.cockpit.tabs.history')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5">
              <OperationsOverviewCard
                title={operationsModel.mode === 'new'
                  ? t('admin.instances.operations.new.title')
                  : t('admin.instances.operations.existing.title')}
                summary={operationsModel.summary}
                primaryActionLabel={primaryAction.label}
                onPrimaryAction={() => void runDetailAction(primaryAction.action)}
                disabled={instancesApi.statusLoading}
              />

              {operationsAnomalies.length > 0 ? (
                <Card className="space-y-4 p-4">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{t('admin.instances.cockpit.anomaliesTitle')}</div>
                    <p className="text-sm text-muted-foreground">{t('admin.instances.cockpit.anomaliesSubtitle')}</p>
                  </div>
                  <div className="grid gap-3">
                    {operationsAnomalies.map((step) => (
                      <div key={step.key} className="rounded-xl border border-border/70 bg-background/85 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{step.title}</div>
                            <p className="mt-1 text-sm text-muted-foreground">{step.summary}</p>
                          </div>
                          <OperationsStepStatusBadge status={step.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              <OperationsStepsPanel
                title={operationsModel.mode === 'new'
                  ? t('admin.instances.operations.new.stepsTitle')
                  : t('admin.instances.operations.existing.stepsTitle')}
                subtitle={operationsModel.mode === 'new'
                  ? t('admin.instances.operations.new.stepsSubtitle')
                  : t('admin.instances.operations.existing.stepsSubtitle')}
                steps={operationsModel.steps}
                onAction={(action) => void runDetailAction(action)}
                disabled={instancesApi.statusLoading}
              />

              {selectedInstance.moduleIamStatus ? (
                <Card className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{t('admin.instances.instanceModules.detail.title')}</div>
                      <p className="text-sm text-muted-foreground">{t('admin.instances.instanceModules.detail.subtitle')}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void instancesApi.seedIamBaseline(selectedInstance.instanceId)}
                      disabled={instancesApi.statusLoading}
                    >
                      {t('admin.instances.instanceModules.actions.seedIamBaseline')}
                    </Button>
                  </div>
                  <div className="rounded-xl border border-dashed border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                    {t('admin.instances.operations.followUpSummary')}
                  </div>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="configuration" className="space-y-5">
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

            <TabsContent value="history" className="space-y-5">
              {historyModel?.currentRun ? (
                <Card className="space-y-4 p-4">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{t('admin.instances.history.currentRunTitle')}</div>
                    <p className="text-sm text-muted-foreground">{t('admin.instances.history.currentRunSubtitle')}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/85 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{historyModel.currentRun.intent}</div>
                        <div className="text-xs text-muted-foreground">
                          {historyModel.currentRun.mode} • {historyModel.currentRun.overallStatus} • {historyModel.currentRun.requestId ?? t('shell.runtimeHealth.notAvailable')}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void instancesApi.loadKeycloakProvisioningRun(selectedInstance.instanceId, historyModel.currentRun!.id)}
                      >
                        {t('admin.instances.actions.loadRun')}
                      </Button>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{historyModel.currentRun.driftSummary}</p>
                    <div className="mt-3 grid gap-2">
                      {historyModel.currentRun.steps.map((step) => (
                        <div key={`${historyModel.currentRun!.id}-${step.stepKey}`} className="rounded-md border border-border p-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-foreground">{step.title}</span>
                            <ProvisioningStepBadge status={step.status} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{step.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {historyModel.hasHistoricalMismatchHint ? (
                    <Alert>
                      <AlertDescription>{t('admin.instances.history.mismatchHint')}</AlertDescription>
                    </Alert>
                  ) : null}
                </Card>
              ) : null}

              <Card className="space-y-4 p-4">
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{t('admin.instances.history.previousRunsTitle')}</div>
                  <p className="text-sm text-muted-foreground">{t('admin.instances.history.previousRunsSubtitle')}</p>
                </div>
                {historyModel && historyModel.historicalRuns.length > 0 ? (
                  historyModel.historicalRuns.map((run) => (
                    <div key={run.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">{run.intent}</div>
                          <div className="text-xs text-muted-foreground">
                            {run.mode} • {run.overallStatus} • {run.requestId ?? t('shell.runtimeHealth.notAvailable')}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void instancesApi.loadKeycloakProvisioningRun(selectedInstance.instanceId, run.id)}
                        >
                          {t('admin.instances.actions.loadRun')}
                        </Button>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{run.driftSummary}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t('admin.instances.history.previousRunsEmpty')}</p>
                )}
              </Card>

              <Card className="space-y-2 p-4">
                <div className="font-medium text-foreground">{t('admin.instances.detail.runs')}</div>
                {selectedInstance.provisioningRuns.length > 0 ? (
                  selectedInstance.provisioningRuns.map((run) => (
                    <div key={run.id} className="rounded-lg border border-border p-3">
                      <div className="font-medium">{run.operation}</div>
                      <div className="text-muted-foreground">
                        {t('admin.instances.detail.runStatus', { value: t(INSTANCE_STATUS_LABELS[run.status]) })}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">{t('admin.instances.detail.noRuns')}</p>
                )}
              </Card>
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
