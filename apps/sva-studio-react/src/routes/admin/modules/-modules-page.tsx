import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { studioPluginModuleIamContracts } from '../../../lib/plugins';
import { getErrorMessage } from '../instances/-instances-shared';

const formatRoleNames = (roleNames: readonly string[]) => roleNames.join(', ');

export const ModulesPage = () => {
  const instancesApi = useInstances();
  const { loadInstance } = instancesApi;
  const [selectedInstanceId, setSelectedInstanceId] = React.useState('');
  const [pendingRevokeModuleId, setPendingRevokeModuleId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedInstanceId && instancesApi.instances[0]?.instanceId) {
      setSelectedInstanceId(instancesApi.instances[0].instanceId);
    }
  }, [instancesApi.instances, selectedInstanceId]);

  React.useEffect(() => {
    if (!selectedInstanceId) {
      return;
    }

    void loadInstance(selectedInstanceId);
  }, [loadInstance, selectedInstanceId]);

  const selectedInstance =
    instancesApi.selectedInstance?.instanceId === selectedInstanceId ? instancesApi.selectedInstance : null;
  const assignedModuleIds = new Set(selectedInstance?.assignedModules ?? []);
  const assignedModules = studioPluginModuleIamContracts.filter((module) => assignedModuleIds.has(module.moduleId));
  const availableModules = studioPluginModuleIamContracts.filter((module) => !assignedModuleIds.has(module.moduleId));
  const pendingRevokeModule = assignedModules.find((module) => module.moduleId === pendingRevokeModuleId) ?? null;

  const onConfirmRevokeModule = async () => {
    if (!selectedInstance || !pendingRevokeModule) {
      return;
    }

    const success = await instancesApi.revokeModule(selectedInstance.instanceId, pendingRevokeModule.moduleId);
    if (success) {
      setPendingRevokeModuleId(null);
    }
  };

  return (
    <section className="space-y-5" aria-busy={instancesApi.isLoading || instancesApi.detailLoading || instancesApi.statusLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.instanceModules.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.instances.instanceModules.subtitle')}</p>
      </header>

      {instancesApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{getErrorMessage(instancesApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="space-y-4 p-4">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{t('admin.instances.instanceModules.instanceSelect.label')}</div>
          <p className="text-sm text-muted-foreground">{t('admin.instances.instanceModules.instanceSelect.hint')}</p>
        </div>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={selectedInstanceId}
          onChange={(event) => setSelectedInstanceId(event.target.value)}
        >
          <option value="">{t('admin.instances.instanceModules.instanceSelect.placeholder')}</option>
          {instancesApi.instances.map((instance) => (
            <option key={instance.instanceId} value={instance.instanceId}>
              {instance.displayName} ({instance.instanceId})
            </option>
          ))}
        </select>
      </Card>

      {selectedInstance ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-medium text-foreground">{t('admin.instances.instanceModules.assigned.title')}</div>
                <p className="text-sm text-muted-foreground">{t('admin.instances.instanceModules.assigned.subtitle')}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void instancesApi.seedIamBaseline(selectedInstance.instanceId)}
                disabled={instancesApi.statusLoading}
              >
                {t('admin.instances.instanceModules.actions.seedIamBaseline')}
              </Button>
            </div>

            {assignedModules.length > 0 ? (
              <div className="space-y-3">
                {assignedModules.map((module) => (
                  <div key={module.moduleId} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{module.moduleId}</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t('admin.instances.instanceModules.module.permissions', { value: module.permissionIds.join(', ') })}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('admin.instances.instanceModules.module.roles', {
                            value: formatRoleNames(module.systemRoles.map((role) => role.roleName)),
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPendingRevokeModuleId(module.moduleId)}
                        disabled={instancesApi.statusLoading}
                      >
                        {t('admin.instances.instanceModules.actions.revoke')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                {t('admin.instances.instanceModules.assigned.empty')}
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-4">
            <div className="space-y-1">
              <div className="font-medium text-foreground">{t('admin.instances.instanceModules.available.title')}</div>
              <p className="text-sm text-muted-foreground">{t('admin.instances.instanceModules.available.subtitle')}</p>
            </div>

            {availableModules.length > 0 ? (
              <div className="space-y-3">
                {availableModules.map((module) => (
                  <div key={module.moduleId} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{module.moduleId}</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t('admin.instances.instanceModules.module.permissions', { value: module.permissionIds.join(', ') })}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('admin.instances.instanceModules.module.roles', {
                            value: formatRoleNames(module.systemRoles.map((role) => role.roleName)),
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => void instancesApi.assignModule(selectedInstance.instanceId, module.moduleId)}
                        disabled={instancesApi.statusLoading}
                      >
                        {t('admin.instances.instanceModules.actions.assign')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                {t('admin.instances.instanceModules.available.empty')}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card className="p-4 text-sm text-muted-foreground">{t('admin.instances.instanceModules.empty')}</Card>
      )}

      <ConfirmDialog
        open={pendingRevokeModule !== null}
        title={t('admin.instances.instanceModules.confirm.revokeTitle')}
        description={t('admin.instances.instanceModules.confirm.revokeDescription', {
          moduleId: pendingRevokeModule?.moduleId ?? '',
        })}
        confirmLabel={t('admin.instances.instanceModules.actions.revoke')}
        cancelLabel={t('account.actions.cancel')}
        onConfirm={() => void onConfirmRevokeModule()}
        onCancel={() => setPendingRevokeModuleId(null)}
      />
    </section>
  );
};
