import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { StudioTableSurface } from '../../../components/StudioTableSurface';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { studioModuleIamContracts } from '../../../lib/plugins';
import { useAuth } from '../../../providers/auth-provider';
import { resolveModuleDescription } from './-module-description';
import { getErrorMessage } from '../instances/-instances-shared';

const formatRoleNames = (roleNames: readonly string[]) => roleNames.join(', ');

const TenantModulesPage = ({
  assignedModules,
}: {
  readonly assignedModules: readonly string[];
}) => {
  const assignedModuleIds = new Set(assignedModules);

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.instanceModules.detail.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.instances.instanceModules.detail.subtitle')}</p>
      </header>

      <Card className="space-y-4 p-4">
        <StudioTableSurface tone="background">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-foreground">
                  {t('admin.instances.instanceModules.detail.table.module')}
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground">
                  {t('admin.instances.instanceModules.detail.table.status')}
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground">
                  {t('admin.instances.instanceModules.detail.table.description')}
                </th>
              </tr>
            </thead>
            <tbody>
              {studioModuleIamContracts.map((module) => (
                <tr key={module.moduleId} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium text-foreground">{module.moduleId}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {assignedModuleIds.has(module.moduleId)
                      ? t('admin.instances.instanceModules.detail.status.active')
                      : t('admin.instances.instanceModules.detail.status.inactive')}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{resolveModuleDescription(module.descriptionKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </StudioTableSurface>
      </Card>
    </section>
  );
};

const AdminModulesPage = () => {
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
  const assignedModules = studioModuleIamContracts.filter((module) => assignedModuleIds.has(module.moduleId));
  const availableModules = studioModuleIamContracts.filter((module) => !assignedModuleIds.has(module.moduleId));
  const pendingRevokeModule = assignedModules.find((module) => module.moduleId === pendingRevokeModuleId) ?? null;

  return (
    <section className="space-y-5" aria-busy={instancesApi.isLoading || instancesApi.detailLoading || instancesApi.statusLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.instanceModules.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.instances.instanceModules.subtitle')}</p>
      </header>

      <Card className="space-y-3 p-4">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{t('admin.instances.instanceModules.guidance.title')}</div>
          <p className="text-sm text-muted-foreground">{t('admin.instances.instanceModules.guidance.subtitle')}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <div className="font-medium text-foreground">{t('admin.instances.instanceModules.guidance.moduleTitle')}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t('admin.instances.instanceModules.guidance.moduleBody')}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="font-medium text-foreground">{t('admin.instances.instanceModules.guidance.roleTitle')}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t('admin.instances.instanceModules.guidance.roleBody')}</p>
          </div>
        </div>
      </Card>

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
        open={pendingRevokeModule !== null && selectedInstance !== null}
        title={t('admin.instances.instanceModules.confirmRevoke.title')}
        description={t('admin.instances.instanceModules.confirmRevoke.description', {
          moduleId: pendingRevokeModule?.moduleId ?? '',
          instanceId: selectedInstance?.instanceId ?? '',
        })}
        confirmLabel={t('admin.instances.instanceModules.confirmRevoke.confirm')}
        cancelLabel={t('admin.instances.instanceModules.confirmRevoke.cancel')}
        onCancel={() => setPendingRevokeModuleId(null)}
        onConfirm={async () => {
          if (!selectedInstance || !pendingRevokeModule) {
            return;
          }
          const success = await instancesApi.revokeModule(selectedInstance.instanceId, pendingRevokeModule.moduleId);
          if (success) {
            setPendingRevokeModuleId(null);
          }
        }}
      />
    </section>
  );
};

export const ModulesPage = () => {
  const { user } = useAuth();

  if (user?.instanceId) {
    return <TenantModulesPage assignedModules={user.assignedModules ?? []} />;
  }

  return <AdminModulesPage />;
};
