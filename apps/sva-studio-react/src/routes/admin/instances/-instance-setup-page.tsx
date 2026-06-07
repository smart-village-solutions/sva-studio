import { Link } from '@tanstack/react-router';
import React from 'react';

import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { studioModuleIamContracts } from '../../../lib/plugins';
import { getErrorMessage } from './-instance-error-messages';
import {
  getInstanceSetupStatusItems,
  getSetupWorkflowSteps,
  isInstanceSetupComplete,
} from './-instance-detail-models';
import { WorkflowStatusBadge } from './-instance-status-badges';

type InstanceSetupPageProps = Readonly<{
  instanceId: string;
}>;

const adminBootstrapModuleLabels = {
  news: 'admin.instances.adminBootstrap.modules.news',
  events: 'admin.instances.adminBootstrap.modules.events',
  poi: 'admin.instances.adminBootstrap.modules.poi',
  media: 'admin.instances.adminBootstrap.modules.media',
  'waste-management': 'admin.instances.adminBootstrap.modules.wasteManagement',
} as const;

const getModuleLabel = (moduleId: keyof typeof adminBootstrapModuleLabels) =>
  t(adminBootstrapModuleLabels[moduleId]);

export const InstanceSetupPage = ({ instanceId }: InstanceSetupPageProps) => {
  const instancesApi = useInstances();
  const { loadInstance } = instancesApi;
  const [selectedModuleIds, setSelectedModuleIds] = React.useState<readonly string[]>([]);
  const [isBootstrappingAdminStructure, setIsBootstrappingAdminStructure] = React.useState(false);
  const [tenantAdminTemporaryPassword, setTenantAdminTemporaryPassword] = React.useState('');
  const [actionFeedback, setActionFeedback] = React.useState<string | null>(null);

  React.useEffect(() => {
    void loadInstance(instanceId);
  }, [instanceId, loadInstance]);

  const selectedInstance = instancesApi.selectedInstance?.instanceId === instanceId ? instancesApi.selectedInstance : null;
  const setupStatusItems = selectedInstance ? getInstanceSetupStatusItems(selectedInstance) : [];
  const setupCompleted = selectedInstance ? isInstanceSetupComplete(selectedInstance) : false;

  const toggleModuleSelection = (moduleId: string) => {
    setSelectedModuleIds((current) =>
      current.includes(moduleId)
        ? current.filter((value) => value !== moduleId)
        : [...current, moduleId]
    );
  };

  const executeProvisioning = async (
    intent: 'provision' | 'provision_admin_client' | 'reset_tenant_admin' | 'rotate_client_secret'
  ) => {
    if (!selectedInstance) {
      return;
    }

    const result = await instancesApi.executeKeycloakProvisioning(selectedInstance.instanceId, {
      intent,
      tenantAdminTemporaryPassword: tenantAdminTemporaryPassword.trim() || undefined,
    });
    if (result) {
      setActionFeedback(t('admin.instances.feedback.provisioningQueued'));
      setTenantAdminTemporaryPassword('');
    }
  };

  const triggerWorkflowAction = async (
    action:
      | 'check_preflight'
      | 'check_keycloak_status'
      | 'plan_provisioning'
      | 'execute_provisioning'
      | 'provision_admin_client'
      | 'rotate_client_secret'
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
          setActionFeedback(t('admin.instances.feedback.preflightUpdated'));
        }
        return;
      }
      case 'check_keycloak_status': {
        const result = await instancesApi.refreshKeycloakStatus(selectedInstance.instanceId);
        if (result) {
          setActionFeedback(t('admin.instances.feedback.keycloakStatusUpdated'));
        }
        return;
      }
      case 'plan_provisioning': {
        const result = await instancesApi.planKeycloakProvisioning(selectedInstance.instanceId);
        if (result) {
          setActionFeedback(t('admin.instances.feedback.provisioningPreviewUpdated'));
        }
        return;
      }
      case 'execute_provisioning':
        await executeProvisioning('provision');
        return;
      case 'provision_admin_client':
        await executeProvisioning('provision_admin_client');
        return;
      case 'rotate_client_secret':
        await executeProvisioning('rotate_client_secret');
        return;
      case 'reset_tenant_admin':
        await executeProvisioning('reset_tenant_admin');
        return;
      case 'activate_instance': {
        const result = await instancesApi.activateInstance(selectedInstance.instanceId);
        if (result) {
          setActionFeedback(t('admin.instances.feedback.instanceActivated'));
        }
      }
    }
  };

  const onBootstrapAdminStructure = async () => {
    if (!selectedInstance) {
      return;
    }

    setIsBootstrappingAdminStructure(true);
    try {
      const bootstrapped = await instancesApi.bootstrapAdminStructure(selectedInstance.instanceId, selectedModuleIds);
      if (!bootstrapped) {
        return;
      }

      setActionFeedback(t('admin.instances.adminBootstrap.success'));
    } finally {
      setIsBootstrappingAdminStructure(false);
    }
  };

  return (
    <section className="space-y-5" aria-busy={instancesApi.isLoading || instancesApi.detailLoading}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.setup.title')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t('admin.instances.setup.subtitle', { instanceId })}
          </p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/instances">{t('admin.instances.setup.actions.backToOverview')}</Link>
        </Button>
      </header>

      {actionFeedback ? (
        <Alert>
          <AlertDescription>{actionFeedback}</AlertDescription>
        </Alert>
      ) : null}

      {instancesApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{getErrorMessage(instancesApi.mutationError)}</span>
            <IamRuntimeDiagnosticDetails error={instancesApi.mutationError} />
          </AlertDescription>
        </Alert>
      ) : null}

      {selectedInstance ? (
        <>
          <Card className="space-y-4 p-5">
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">{t('admin.instances.setup.status.title')}</div>
              <p className="text-sm text-muted-foreground">{t('admin.instances.setup.status.subtitle')}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {setupStatusItems.map((item) => (
                <div key={item.key} className="rounded-xl border border-border/70 bg-background/85 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{item.title}</div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <WorkflowStatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {setupCompleted
                  ? t('admin.instances.setup.completion.ready')
                  : t('admin.instances.setup.completion.pending')}
              </p>
              {setupCompleted ? (
                <Button asChild>
                  <Link to="/admin/instances/$instanceId" params={{ instanceId: selectedInstance.instanceId }}>
                    {t('admin.instances.setup.actions.openOperations')}
                  </Link>
                </Button>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">{t('admin.instances.workflow.title')}</div>
              <p className="text-sm text-muted-foreground">{t('admin.instances.workflow.subtitle')}</p>
            </div>
            <div className="grid gap-3">
              {getSetupWorkflowSteps(selectedInstance, instancesApi.mutationError).map((step) => {
                const action = step.action;
                return (
                  <div key={step.key} className="rounded-xl border border-border/70 bg-background/85 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">{step.title}</div>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                      <WorkflowStatusBadge status={step.status} />
                    </div>
                    {action && step.actionLabel ? (
                      <div className="mt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void triggerWorkflowAction(action)}
                          disabled={instancesApi.statusLoading}
                        >
                          {step.actionLabel}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">{t('admin.instances.setup.temporaryPasswordTitle')}</div>
              <p className="text-sm text-muted-foreground">{t('admin.instances.setup.temporaryPasswordHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instance-setup-tenant-admin-password">
                {t('admin.instances.keycloakPanel.temporaryPassword')}
              </Label>
              <Input
                id="instance-setup-tenant-admin-password"
                type="password"
                value={tenantAdminTemporaryPassword}
                onChange={(event) => setTenantAdminTemporaryPassword(event.target.value)}
              />
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">{t('admin.instances.adminBootstrap.title')}</div>
              <p className="text-sm text-muted-foreground">{t('admin.instances.adminBootstrap.subtitleReady')}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {studioModuleIamContracts.map((module) => {
                const checked = selectedModuleIds.includes(module.moduleId);
                const inputId = `instance-setup-admin-bootstrap-module-${module.moduleId}`;
                const titleId = `${inputId}-title`;
                const hintId = `${inputId}-hint`;

                return (
                  <label
                    htmlFor={inputId}
                    key={module.moduleId}
                    aria-labelledby={titleId}
                    aria-describedby={hintId}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      aria-labelledby={titleId}
                      aria-describedby={hintId}
                      checked={checked}
                      disabled={isBootstrappingAdminStructure}
                      onChange={() => toggleModuleSelection(module.moduleId)}
                    />
                    <span className="space-y-1">
                      <span id={titleId} className="block font-medium text-foreground">
                        {getModuleLabel(module.moduleId as keyof typeof adminBootstrapModuleLabels)}
                      </span>
                      <span id={hintId} className="block text-muted-foreground">
                        {t('admin.instances.adminBootstrap.moduleHint', {
                          value: module.permissionIds.join(', '),
                        })}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              {t('admin.instances.adminBootstrap.conflictHint')}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={isBootstrappingAdminStructure}
                onClick={() => void onBootstrapAdminStructure()}
              >
                {t('admin.instances.adminBootstrap.action')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('admin.instances.adminBootstrap.actionHintReady')}</p>
            </div>
          </Card>
        </>
      ) : null}
    </section>
  );
};
