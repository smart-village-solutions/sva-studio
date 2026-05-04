import { Link } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import { FieldHelp } from './-field-help';
import {
  buildInstanceDetailCockpitModel,
  ConfigurationStatusBadge,
  createDetailForm,
  type DetailWorkflowAction,
  evaluateInstanceConfiguration,
  getEffectiveTenantIamStatus,
  getErrorMessage,
  getKeycloakStatusEntries,
  getSetupWorkflowSteps,
  getStatusGuidance,
  INSTANCE_FIELD_HELP,
  INSTANCE_STATUS_LABELS,
  isTenantSecretUserInputRequired,
  KeycloakStatusBadge,
  ProvisioningStepBadge,
  WorkflowStatusBadge,
} from './-instances-shared';

type InstanceDetailPageProps = {
  readonly instanceId: string;
};

type ActionFeedback = {
  readonly tone: 'success' | 'warning';
  readonly message: string;
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const FormLabelWithHelp = ({
  htmlFor,
  label,
  helpKey,
}: {
  htmlFor: string;
  label: string;
  helpKey: keyof typeof INSTANCE_FIELD_HELP;
}) => {
  const help = INSTANCE_FIELD_HELP[helpKey];
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      <FieldHelp {...help} />
    </div>
  );
};

const TenantIamStatusBadge = ({ status }: { status?: 'ready' | 'degraded' | 'blocked' | 'unknown' }) => {
  const tone =
    status === 'ready'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'blocked'
        ? 'bg-red-100 text-red-800'
        : status === 'degraded'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-muted text-muted-foreground';

  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone}`}>{status ?? 'unknown'}</span>;
};

const readLatestKeycloakRun = (instance: ReturnType<typeof useInstances>['selectedInstance']) =>
  instance?.latestKeycloakProvisioningRun ?? instance?.keycloakProvisioningRuns[0];

const readWorkerPendingProjection = (instance: ReturnType<typeof useInstances>['selectedInstance']) =>
  Boolean(
    instance?.keycloakPreflight?.checks.some((check) => {
      const details = check.details as Record<string, unknown> | undefined;
      return details?.source === 'worker_pending';
    })
  );

const readMissingWorkerEnvName = (instance: ReturnType<typeof useInstances>['selectedInstance']) => {
  const preflightStep = readLatestKeycloakRun(instance)?.steps.find((step) => step.stepKey === 'worker_preflight_snapshot');
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

const COCKPIT_STATUS_STYLES = {
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900',
  degraded: 'border-amber-500/30 bg-amber-500/10 text-amber-950',
  blocked: 'border-red-500/30 bg-red-500/10 text-red-900',
  unknown: 'border-slate-400/30 bg-slate-500/10 text-slate-900',
} as const;

const TENANT_IAM_AXIS_TITLE_KEYS = {
  configuration: 'admin.instances.tenantIam.axes.configuration',
  access: 'admin.instances.tenantIam.axes.access',
  reconcile: 'admin.instances.tenantIam.axes.reconcile',
} as const;

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

  const preflightTimestamp =
    instance.keycloakPreflight && typeof instance.keycloakPreflight === 'object'
      ? 'checkedAt' in instance.keycloakPreflight && typeof instance.keycloakPreflight.checkedAt === 'string'
        ? instance.keycloakPreflight.checkedAt
        : 'generatedAt' in instance.keycloakPreflight &&
            typeof (instance.keycloakPreflight as { generatedAt?: string }).generatedAt === 'string'
          ? (instance.keycloakPreflight as { generatedAt?: string }).generatedAt
          : undefined
      : undefined;
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
  const [detailFormValues, setDetailFormValues] = React.useState<ReturnType<typeof createDetailForm> | null>(null);
  const [actionFeedback, setActionFeedback] = React.useState<ActionFeedback | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<'configuration' | 'operations' | 'history'>(
    'configuration'
  );

  React.useEffect(() => {
    void instancesApi.loadInstance(instanceId);
  }, [instanceId]);

  const selectedInstance = instancesApi.selectedInstance?.instanceId === instanceId ? instancesApi.selectedInstance : null;
  const effectiveTenantIamStatus = selectedInstance ? getEffectiveTenantIamStatus(selectedInstance) : undefined;
  const tenantSecretUserInputRequired = selectedInstance ? isTenantSecretUserInputRequired(selectedInstance.realmMode) : true;
  const configurationAssessment = selectedInstance ? evaluateInstanceConfiguration(selectedInstance, instancesApi.mutationError) : null;
  const missingWorkerEnvName = readMissingWorkerEnvName(selectedInstance);
  const workerPendingProjection = readWorkerPendingProjection(selectedInstance);

  React.useEffect(() => {
    if (!selectedInstance) {
      setDetailFormValues(null);
      return;
    }

    setDetailFormValues(createDetailForm(selectedInstance));
    setActiveWorkspaceTab('configuration');
  }, [selectedInstance]);

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

    setDetailFormValues((current) =>
      current
        ? {
            ...current,
            authClientSecret: '',
            tenantAdminClient: {
              ...current.tenantAdminClient,
              secret: '',
            },
          }
        : current
    );
  };

  const executeProvisioning = async (
    intent: 'provision' | 'provision_admin_client' | 'reset_tenant_admin' | 'rotate_client_secret'
  ) => {
    if (!selectedInstance || !detailFormValues) {
      return;
    }

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
    const result = await instancesApi.probeTenantIamAccess(selectedInstance.instanceId);
    if (result) {
      setActionFeedback({
        tone: 'success',
        message: t('admin.instances.feedback.tenantIamProbeUpdated'),
      });
    }
  };

  const runDetailAction = async (action: DetailWorkflowAction) => {
    switch (action) {
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

  const cockpitModel = selectedInstance ? buildInstanceDetailCockpitModel(selectedInstance, instancesApi.mutationError) : null;

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
        <Alert
          className={
            actionFeedback.tone === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-950'
          }
        >
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

      {selectedInstance && detailFormValues && cockpitModel ? (
        <div className="space-y-5">
          <Card className="overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(30,41,59,0.08),transparent_38%),linear-gradient(135deg,rgba(248,250,252,0.98),rgba(241,245,249,0.92))] p-0">
            <div className="space-y-6 p-5 md:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      {t('admin.instances.cockpit.eyebrow')}
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-foreground">{t('admin.instances.cockpit.title')}</h2>
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {t('admin.instances.cockpit.subtitle')}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

                    <div className={`rounded-2xl border p-4 shadow-sm ${COCKPIT_STATUS_STYLES[cockpitModel.overallStatus]}`}>
                      <div className="text-xs uppercase tracking-wide opacity-80">
                        {t('admin.instances.cockpit.currentState')}
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="text-lg font-semibold">{cockpitModel.overallTitle}</div>
                        <p className="text-sm opacity-90">{cockpitModel.overallSummary}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t('admin.instances.cockpit.configurationSnapshot')}
                      </div>
                      {configurationAssessment ? (
                        <div className="mt-3 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-foreground">{configurationAssessment.title}</div>
                            <ConfigurationStatusBadge status={configurationAssessment.overallStatus} />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t('admin.instances.configuration.labels.requirementsValue', {
                              satisfied: configurationAssessment.satisfiedRequirements,
                              total: configurationAssessment.totalRequirements,
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t('admin.instances.cockpit.lifecycle')}
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="text-lg font-semibold text-foreground">
                          {t(INSTANCE_STATUS_LABELS[selectedInstance.status])}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t('admin.instances.detail.parentDomain', { value: selectedInstance.parentDomain })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-md rounded-2xl border border-border/70 bg-background/95 p-4 shadow-lg shadow-slate-200/70">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {t('admin.instances.cockpit.primaryAction')}
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="text-lg font-semibold text-foreground">{t('admin.instances.cockpit.primaryActionTitle')}</div>
                    <p className="text-sm text-muted-foreground">{cockpitModel.overallSummary}</p>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => void runDetailAction(cockpitModel.primaryAction.action)}
                      disabled={instancesApi.statusLoading}
                    >
                      {cockpitModel.primaryAction.label}
                    </Button>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('admin.instances.cockpit.secondaryActions')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cockpitModel.secondaryActions.map((action) => (
                          <Button
                            key={action.action}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void runDetailAction(action.action)}
                            disabled={instancesApi.statusLoading}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                <div className="rounded-2xl border border-border/60 bg-background/85 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{t('admin.instances.cockpit.anomaliesTitle')}</div>
                      <p className="text-sm text-muted-foreground">{t('admin.instances.cockpit.anomaliesSubtitle')}</p>
                    </div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{cockpitModel.anomalyQueue.length} / 3</div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {cockpitModel.anomalyQueue.length > 0 ? (
                      cockpitModel.anomalyQueue.map((item) => (
                        <div key={item.key} className="rounded-2xl border border-border/60 bg-muted/20 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-foreground">{item.title}</div>
                              <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                            </div>
                            <TenantIamStatusBadge status={item.status} />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{item.sourceLabel}</span>
                            {item.checkedAt ? (
                              <span>{t('admin.instances.cockpit.checkedAt', { value: formatDateTime(item.checkedAt) })}</span>
                            ) : null}
                            {item.requestId ? (
                              <span>{t('admin.instances.tenantIam.requestId', { value: item.requestId })}</span>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                        {t('admin.instances.cockpit.anomaliesEmpty')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/85 p-4">
                  <div className="text-sm font-semibold text-foreground">{t('admin.instances.cockpit.evidenceTitle')}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{t('admin.instances.cockpit.evidenceSubtitle')}</p>
                  <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{cockpitModel.dominantEvidence.label}</div>
                    <div className="mt-2 text-lg font-semibold text-foreground">{cockpitModel.dominantEvidence.sourceLabel}</div>
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      {cockpitModel.dominantEvidence.checkedAt ? (
                        <div>{t('admin.instances.cockpit.checkedAt', { value: formatDateTime(cockpitModel.dominantEvidence.checkedAt) })}</div>
                      ) : (
                        <div>{t('admin.instances.cockpit.noEvidenceTimestamp')}</div>
                      )}
                      {cockpitModel.dominantEvidence.requestId ? (
                        <div>{t('admin.instances.tenantIam.requestId', { value: cockpitModel.dominantEvidence.requestId })}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="text-sm font-medium text-foreground">{getStatusGuidance(selectedInstance).title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{getStatusGuidance(selectedInstance).body}</p>
                  </div>
                  {instancesApi.mutationError?.code === 'keycloak_unavailable' ? (
                    <Alert className="mt-4">
                      <AlertDescription>{t('admin.instances.guidance.keycloakUnavailable')}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          <Tabs value={activeWorkspaceTab} onValueChange={(value) => setActiveWorkspaceTab(value as typeof activeWorkspaceTab)} className="space-y-4">
            <TabsList aria-label={t('admin.instances.cockpit.tabsAriaLabel')} className="h-auto flex-wrap justify-start">
              <TabsTrigger value="configuration" onClick={() => setActiveWorkspaceTab('configuration')}>
                {t('admin.instances.cockpit.tabs.configuration')}
              </TabsTrigger>
              <TabsTrigger value="operations" onClick={() => setActiveWorkspaceTab('operations')}>
                {t('admin.instances.cockpit.tabs.operations')}
              </TabsTrigger>
              <TabsTrigger value="history" onClick={() => setActiveWorkspaceTab('history')}>
                {t('admin.instances.cockpit.tabs.history')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="configuration" className="space-y-5">
              {configurationAssessment ? (
                <Card className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{t('admin.instances.configuration.title')}</div>
                      <p className="text-sm text-muted-foreground">{configurationAssessment.title}</p>
                    </div>
                    <ConfigurationStatusBadge status={configurationAssessment.overallStatus} />
                  </div>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div className="rounded-md border border-border bg-muted/20 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t('admin.instances.configuration.labels.lifecycle')}
                      </div>
                      <div className="mt-1 font-medium text-foreground">{t(INSTANCE_STATUS_LABELS[selectedInstance.status])}</div>
                    </div>
                    <div className="rounded-md border border-border bg-muted/20 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t('admin.instances.configuration.labels.requirements')}
                      </div>
                      <div className="mt-1 font-medium text-foreground">
                        {t('admin.instances.configuration.labels.requirementsValue', {
                          satisfied: configurationAssessment.satisfiedRequirements,
                          total: configurationAssessment.totalRequirements,
                        })}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{configurationAssessment.body}</p>
                  {configurationAssessment.blockingIssues.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-foreground">
                        {t('admin.instances.configuration.labels.blockingIssues')}
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {configurationAssessment.blockingIssues.map((issue) => (
                          <li key={issue.key}>• {issue.label}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {configurationAssessment.warningIssues.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-foreground">
                        {t('admin.instances.configuration.labels.warnings')}
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {configurationAssessment.warningIssues.map((issue) => (
                          <li key={issue.key}>• {issue.label}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Card>
              ) : null}

              <Card className="space-y-5 p-4">
              <form className="space-y-4" onSubmit={onUpdateSubmit}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium text-foreground">{t('admin.instances.flow.realmModeTitle')}</h2>
                    <FieldHelp {...INSTANCE_FIELD_HELP.realmMode} />
                  </div>
                  <p className="text-xs text-muted-foreground">{t('admin.instances.flow.realmModeSubtitle')}</p>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                    <input
                      type="radio"
                      name="detail-realm-mode"
                      checked={detailFormValues.realmMode === 'new'}
                      onChange={() => setDetailFormValues((current) => (current ? { ...current, realmMode: 'new' } : current))}
                    />
                    <span>{t('admin.instances.flow.realmModeNew')}</span>
                  </label>
                  <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                    <input
                      type="radio"
                      name="detail-realm-mode"
                      checked={detailFormValues.realmMode === 'existing'}
                      onChange={() =>
                        setDetailFormValues((current) => (current ? { ...current, realmMode: 'existing' } : current))
                      }
                    />
                    <span>{t('admin.instances.flow.realmModeExisting')}</span>
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <FormLabelWithHelp htmlFor="detail-display-name" label={t('admin.instances.form.displayName')} helpKey="displayName" />
                    <Input
                      id="detail-display-name"
                      value={detailFormValues.displayName}
                      onChange={(event) =>
                        setDetailFormValues((current) => (current ? { ...current, displayName: event.target.value } : current))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <FormLabelWithHelp htmlFor="detail-parent-domain" label={t('admin.instances.form.parentDomain')} helpKey="parentDomain" />
                    <Input
                      id="detail-parent-domain"
                      value={detailFormValues.parentDomain}
                      onChange={(event) =>
                        setDetailFormValues((current) => (current ? { ...current, parentDomain: event.target.value } : current))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <FormLabelWithHelp htmlFor="detail-auth-realm" label={t('admin.instances.form.authRealm')} helpKey="authRealm" />
                    <Input
                      id="detail-auth-realm"
                      value={detailFormValues.authRealm}
                      onChange={(event) =>
                        setDetailFormValues((current) => (current ? { ...current, authRealm: event.target.value } : current))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <FormLabelWithHelp
                      htmlFor="detail-auth-client-id"
                      label={t('admin.instances.form.authClientId')}
                      helpKey="authClientId"
                    />
                    <Input
                      id="detail-auth-client-id"
                      value={detailFormValues.authClientId}
                      onChange={(event) =>
                        setDetailFormValues((current) => (current ? { ...current, authClientId: event.target.value } : current))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="detail-auth-issuer-url"
                    label={t('admin.instances.form.authIssuerUrl')}
                    helpKey="authIssuerUrl"
                  />
                  <Input
                    id="detail-auth-issuer-url"
                    value={detailFormValues.authIssuerUrl}
                    onChange={(event) =>
                      setDetailFormValues((current) => (current ? { ...current, authIssuerUrl: event.target.value } : current))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="detail-auth-client-secret"
                    label={t('admin.instances.form.authClientSecret')}
                    helpKey="authClientSecret"
                  />
                  <Input
                    id="detail-auth-client-secret"
                    type="password"
                    disabled={!tenantSecretUserInputRequired}
                    placeholder={
                      !tenantSecretUserInputRequired
                        ? t('admin.instances.form.authClientSecretGeneratedDuringProvisioning')
                        : selectedInstance.authClientSecretConfigured
                        ? t('admin.instances.form.authClientSecretConfigured')
                        : t('admin.instances.form.authClientSecretMissing')
                    }
                    value={detailFormValues.authClientSecret}
                    onChange={(event) =>
                      setDetailFormValues((current) => (current ? { ...current, authClientSecret: event.target.value } : current))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {tenantSecretUserInputRequired
                      ? t('admin.instances.form.authClientSecretHint')
                      : t('admin.instances.form.authClientSecretGeneratedHint')}
                  </p>
                </div>

                <div className="space-y-1">
                  <h2 className="text-sm font-medium text-foreground">{t('admin.instances.form.tenantAdminClientTitle')}</h2>
                  <p className="text-xs text-muted-foreground">{t('admin.instances.form.tenantAdminClientSubtitle')}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <FormLabelWithHelp
                      htmlFor="detail-tenant-admin-client-id"
                      label={t('admin.instances.form.tenantAdminClientId')}
                      helpKey="tenantAdminClientId"
                    />
                    <Input
                      id="detail-tenant-admin-client-id"
                      value={detailFormValues.tenantAdminClient.clientId}
                      onChange={(event) =>
                        setDetailFormValues((current) =>
                          current
                            ? {
                                ...current,
                                tenantAdminClient: { ...current.tenantAdminClient, clientId: event.target.value },
                              }
                            : current
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <FormLabelWithHelp
                      htmlFor="detail-tenant-admin-client-secret"
                      label={t('admin.instances.form.tenantAdminClientSecret')}
                      helpKey="tenantAdminClientSecret"
                    />
                    <Input
                      id="detail-tenant-admin-client-secret"
                      type="password"
                      placeholder={
                        selectedInstance.tenantAdminClient?.secretConfigured
                          ? t('admin.instances.form.tenantAdminClientSecretConfigured')
                          : t('admin.instances.form.tenantAdminClientSecretMissing')
                      }
                      value={detailFormValues.tenantAdminClient.secret}
                      onChange={(event) =>
                        setDetailFormValues((current) =>
                          current
                            ? {
                                ...current,
                                tenantAdminClient: { ...current.tenantAdminClient, secret: event.target.value },
                              }
                            : current
                        )
                      }
                    />
                    <p className="text-xs text-muted-foreground">{t('admin.instances.form.tenantAdminClientSecretHint')}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <h2 className="text-sm font-medium text-foreground">{t('admin.instances.form.tenantAdminTitle')}</h2>
                  <p className="text-xs text-muted-foreground">{t('admin.instances.form.tenantAdminSubtitle')}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <FormLabelWithHelp
                      htmlFor="detail-admin-username"
                      label={t('admin.instances.form.tenantAdminUsername')}
                      helpKey="tenantAdminUsername"
                    />
                    <Input
                      id="detail-admin-username"
                      value={detailFormValues.tenantAdminBootstrap.username}
                      onChange={(event) =>
                        setDetailFormValues((current) =>
                          current
                            ? {
                                ...current,
                                tenantAdminBootstrap: { ...current.tenantAdminBootstrap, username: event.target.value },
                              }
                            : current
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <FormLabelWithHelp
                      htmlFor="detail-admin-email"
                      label={t('admin.instances.form.tenantAdminEmail')}
                      helpKey="tenantAdminEmail"
                    />
                    <Input
                      id="detail-admin-email"
                      value={detailFormValues.tenantAdminBootstrap.email}
                      onChange={(event) =>
                        setDetailFormValues((current) =>
                          current
                            ? {
                                ...current,
                                tenantAdminBootstrap: { ...current.tenantAdminBootstrap, email: event.target.value },
                              }
                            : current
                        )
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <FormLabelWithHelp
                      htmlFor="detail-admin-first-name"
                      label={t('admin.instances.form.tenantAdminFirstName')}
                      helpKey="tenantAdminFirstName"
                    />
                    <Input
                      id="detail-admin-first-name"
                      value={detailFormValues.tenantAdminBootstrap.firstName}
                      onChange={(event) =>
                        setDetailFormValues((current) =>
                          current
                            ? {
                                ...current,
                                tenantAdminBootstrap: { ...current.tenantAdminBootstrap, firstName: event.target.value },
                              }
                            : current
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <FormLabelWithHelp
                      htmlFor="detail-admin-last-name"
                      label={t('admin.instances.form.tenantAdminLastName')}
                      helpKey="tenantAdminLastName"
                    />
                    <Input
                      id="detail-admin-last-name"
                      value={detailFormValues.tenantAdminBootstrap.lastName}
                      onChange={(event) =>
                        setDetailFormValues((current) =>
                          current
                            ? {
                                ...current,
                                tenantAdminBootstrap: { ...current.tenantAdminBootstrap, lastName: event.target.value },
                              }
                            : current
                        )
                      }
                    />
                  </div>
                </div>
                <Button type="submit" variant="outline">
                  {t('admin.instances.actions.save')}
                </Button>
              </form>
              </Card>
            </TabsContent>

            <TabsContent value="operations" forceMount className="space-y-5 data-[state=inactive]:hidden">
              {effectiveTenantIamStatus ? (
                <Card className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{t('admin.instances.tenantIam.title')}</div>
                      <p className="text-sm text-muted-foreground">{t('admin.instances.tenantIam.subtitle')}</p>
                    </div>
                    <TenantIamStatusBadge status={effectiveTenantIamStatus.overall.status} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {(['configuration', 'access', 'reconcile'] as const).map((axisKey) => {
                      const axis = effectiveTenantIamStatus[axisKey];
                      return (
                        <div key={axisKey} className="rounded-md border border-border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              {t(TENANT_IAM_AXIS_TITLE_KEYS[axisKey])}
                            </div>
                            <TenantIamStatusBadge status={axis?.status} />
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{axis?.summary}</p>
                          {axis?.requestId ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {t('admin.instances.tenantIam.requestId', { value: axis.requestId })}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : null}

              {selectedInstance.moduleIamStatus ? (
                <Card className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{t('admin.instances.instanceModules.detail.title')}</div>
                      <p className="text-sm text-muted-foreground">{t('admin.instances.instanceModules.detail.subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TenantIamStatusBadge status={selectedInstance.moduleIamStatus.overall.status} />
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
                  </div>
                  {selectedInstance.moduleIamStatus.modules.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedInstance.moduleIamStatus.modules.map((module) => (
                        <div key={module.moduleId} className="rounded-md border border-border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-foreground">{module.moduleId}</div>
                            <TenantIamStatusBadge status={module.status} />
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{module.summary}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t('admin.instances.instanceModules.module.permissions', {
                              value: module.permissionIds.join(', ') || '—',
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                      {t('admin.instances.instanceModules.assigned.empty')}
                    </div>
                  )}
                </Card>
              ) : null}

              <Card className="space-y-4 p-4">
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{t('admin.instances.workflow.title')}</div>
                  <p className="text-xs text-muted-foreground">{t('admin.instances.workflow.subtitle')}</p>
                </div>
                <div className="grid gap-2">
                  {getSetupWorkflowSteps(selectedInstance, instancesApi.mutationError).map((step) => (
                    <div key={step.key} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">{step.title}</div>
                          <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                        </div>
                        <WorkflowStatusBadge status={step.status} />
                      </div>
                      {step.action && step.actionLabel ? (
                        <div className="mt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void triggerWorkflowAction(step.action!)}
                            disabled={instancesApi.statusLoading}
                          >
                            {step.actionLabel}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="space-y-3 p-4">
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{t('admin.instances.flow.executeTitle')}</div>
                  <p className="text-xs text-muted-foreground">{t('admin.instances.flow.executeSubtitle')}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tenant-admin-password">{t('admin.instances.keycloakPanel.temporaryPassword')}</Label>
                  <Input
                    id="tenant-admin-password"
                    type="password"
                    value={detailFormValues.tenantAdminTemporaryPassword}
                    onChange={(event) =>
                      setDetailFormValues((current) =>
                        current ? { ...current, tenantAdminTemporaryPassword: event.target.value } : current
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">{t('admin.instances.keycloakPanel.passwordHint')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void executeProvisioning('provision')}>
                    {t('admin.instances.actions.executeProvisioning')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void executeProvisioning('provision_admin_client')}>
                    {t('admin.instances.actions.provisionAdminClient')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void executeProvisioning('reset_tenant_admin')}>
                    {t('admin.instances.actions.resetTenantAdmin')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void executeProvisioning('rotate_client_secret')}>
                    {t('admin.instances.actions.rotateClientSecret')}
                  </Button>
                </div>
              </Card>

              <Card className="space-y-3 p-4">
              <div className="space-y-1">
                <div className="font-medium text-foreground">{t('admin.instances.flow.preflightTitle')}</div>
                <p className="text-xs text-muted-foreground">{t('admin.instances.flow.preflightSubtitle')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void instancesApi.refreshKeycloakPreflight(selectedInstance.instanceId)}
                  disabled={instancesApi.statusLoading}
                >
                  {t('admin.instances.actions.checkPreflight')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void instancesApi.refreshKeycloakStatus(selectedInstance.instanceId)}
                  disabled={instancesApi.statusLoading}
                >
                  {t('admin.instances.actions.checkKeycloakStatus')}
                </Button>
              </div>
              <div className="grid gap-2">
                {selectedInstance.keycloakPreflight?.checks.map((check) => (
                  <div key={check.checkKey} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-foreground">{check.title}</span>
                      <KeycloakStatusBadge ready={check.status === 'ready'} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{check.summary}</p>
                  </div>
                )) ?? <p className="text-sm text-muted-foreground">{t('admin.instances.flow.preflightEmpty')}</p>}
              </div>
              </Card>

              <Card className="space-y-3 p-4">
              <div className="space-y-1">
                <div className="font-medium text-foreground">{t('admin.instances.flow.previewTitle')}</div>
                <p className="text-xs text-muted-foreground">{t('admin.instances.flow.previewSubtitle')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void instancesApi.planKeycloakProvisioning(selectedInstance.instanceId)}
                  disabled={instancesApi.statusLoading}
                >
                  {t('admin.instances.actions.planProvisioning')}
                </Button>
              </div>
              <div className="grid gap-2">
                {selectedInstance.keycloakPlan?.steps.length ? (
                  selectedInstance.keycloakPlan.steps.map((step) => (
                    <div key={step.stepKey} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-foreground">{step.title}</span>
                        <span className="text-xs text-muted-foreground">{step.action}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{step.summary}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t('admin.instances.flow.previewEmpty')}</p>
                )}
              </div>
              </Card>

              <Card className="space-y-3 p-4">
              <div className="space-y-1">
                <div className="font-medium text-foreground">{t('admin.instances.keycloakPanel.title')}</div>
                <p className="text-xs text-muted-foreground">{t('admin.instances.keycloakPanel.subtitle')}</p>
              </div>
              <div className="grid gap-2">
                {getKeycloakStatusEntries(selectedInstance).length ? (
                  getKeycloakStatusEntries(selectedInstance).map(([labelKey, ready]) => (
                    <div key={labelKey} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                      <span>{t(labelKey)}</span>
                      <KeycloakStatusBadge ready={ready} />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t('admin.instances.keycloakPanel.empty')}</p>
                )}
              </div>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-5">
              <Card className="space-y-3 p-4">
              <div className="space-y-1">
                <div className="font-medium text-foreground">{t('admin.instances.flow.protocolTitle')}</div>
                <p className="text-xs text-muted-foreground">{t('admin.instances.flow.protocolSubtitle')}</p>
              </div>
              {selectedInstance.keycloakProvisioningRuns.length > 0 ? (
                selectedInstance.keycloakProvisioningRuns.map((run) => (
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
                    <p className="mt-2 text-xs text-muted-foreground">{run.driftSummary}</p>
                    <div className="mt-3 grid gap-2">
                      {run.steps.map((step) => (
                        <div key={`${run.id}-${step.stepKey}`} className="rounded-md border border-border p-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-foreground">{step.title}</span>
                            <ProvisioningStepBadge status={step.status} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{step.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                  <p className="text-sm text-muted-foreground">{t('admin.instances.flow.protocolEmpty')}</p>
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
