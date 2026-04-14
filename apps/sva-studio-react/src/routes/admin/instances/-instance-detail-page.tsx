import { Link } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { FieldHelp } from './-field-help';
import {
  ConfigurationStatusBadge,
  createDetailForm,
  evaluateInstanceConfiguration,
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

export const InstanceDetailPage = ({ instanceId }: InstanceDetailPageProps) => {
  const instancesApi = useInstances();
  const [detailFormValues, setDetailFormValues] = React.useState<ReturnType<typeof createDetailForm> | null>(null);

  React.useEffect(() => {
    void instancesApi.loadInstance(instanceId);
  }, [instanceId]);

  const selectedInstance = instancesApi.selectedInstance?.instanceId === instanceId ? instancesApi.selectedInstance : null;
  const tenantSecretUserInputRequired = selectedInstance ? isTenantSecretUserInputRequired(selectedInstance.realmMode) : true;
  const configurationAssessment = selectedInstance ? evaluateInstanceConfiguration(selectedInstance, instancesApi.mutationError) : null;

  React.useEffect(() => {
    if (!selectedInstance) {
      setDetailFormValues(null);
      return;
    }

    setDetailFormValues(createDetailForm(selectedInstance));
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

    await instancesApi.executeKeycloakProvisioning(selectedInstance.instanceId, {
      intent,
      tenantAdminTemporaryPassword: detailFormValues.tenantAdminTemporaryPassword.trim() || undefined,
    });
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
      | 'activate_instance'
  ) => {
    if (!selectedInstance) {
      return;
    }

    switch (action) {
      case 'check_preflight':
        await instancesApi.refreshKeycloakPreflight(selectedInstance.instanceId);
        return;
      case 'check_keycloak_status':
        await instancesApi.refreshKeycloakStatus(selectedInstance.instanceId);
        return;
      case 'plan_provisioning':
        await instancesApi.planKeycloakProvisioning(selectedInstance.instanceId);
        return;
      case 'execute_provisioning':
        await executeProvisioning('provision');
        return;
      case 'provision_admin_client':
        await executeProvisioning('provision_admin_client');
        return;
      case 'activate_instance':
        await instancesApi.activateInstance(selectedInstance.instanceId);
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

      {instancesApi.mutationError && instancesApi.mutationError.code !== 'keycloak_unavailable' ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{getErrorMessage(instancesApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}

      {selectedInstance && detailFormValues ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(25rem,0.9fr)]">
          <div className="space-y-5">
            <Card className="space-y-4 p-4">
              <div className="space-y-1 text-sm">
                <div className="font-medium text-foreground">{selectedInstance.displayName}</div>
                <div className="text-muted-foreground">{selectedInstance.instanceId}</div>
                <div>{t('admin.instances.detail.primaryHostname', { value: selectedInstance.primaryHostname })}</div>
                <div>{t('admin.instances.detail.parentDomain', { value: selectedInstance.parentDomain })}</div>
                <div>{t('admin.instances.detail.status', { value: t(INSTANCE_STATUS_LABELS[selectedInstance.status]) })}</div>
              </div>
              {configurationAssessment ? (
                <div className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{t('admin.instances.configuration.title')}</div>
                      <p className="text-sm text-muted-foreground">{configurationAssessment.title}</p>
                    </div>
                    <ConfigurationStatusBadge status={configurationAssessment.overallStatus} />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <div className="rounded-md border border-border bg-muted/20 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t('admin.instances.configuration.labels.lifecycle')}
                      </div>
                      <div className="mt-1 font-medium text-foreground">
                        {t(INSTANCE_STATUS_LABELS[selectedInstance.status])}
                      </div>
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
                  <p className="mt-3 text-sm text-muted-foreground">{configurationAssessment.body}</p>
                  {configurationAssessment.blockingIssues.length > 0 ? (
                    <div className="mt-3 space-y-2">
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
                    <div className="mt-3 space-y-2">
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
                </div>
              ) : null}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="font-medium text-foreground">{getStatusGuidance(selectedInstance).title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{getStatusGuidance(selectedInstance).body}</p>
              </div>
              {instancesApi.mutationError?.code === 'keycloak_unavailable' ? (
                <Alert>
                  <AlertDescription>{t('admin.instances.guidance.keycloakUnavailable')}</AlertDescription>
                </Alert>
              ) : null}
            </Card>

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
                          onClick={() => {
                            if (!step.action) {
                              return;
                            }
                            void triggerWorkflowAction(step.action);
                          }}
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
          </div>

          <div className="space-y-5">
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
                          {run.mode} • {run.overallStatus} • {run.requestId ?? 'n/a'}
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
          </div>
        </div>
      ) : (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{t('content.messages.loading')}</p>
        </Card>
      )}
    </section>
  );
};
