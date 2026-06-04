import React from 'react';

import { StudioFilterSurface } from '../../../components/StudioFilterSurface';
import { StudioTableSurface } from '../../../components/StudioTableSurface';
import { Card } from '../../../components/ui/card';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { studioModuleIamContracts } from '../../../lib/plugins';
import { useAuth } from '../../../providers/auth-provider';
import { InstanceModulesWorkspace } from './-instance-modules-workspace';
import { resolveModuleDescription } from './-module-description';

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

  return (
    <section className="space-y-5" aria-busy={instancesApi.isLoading || instancesApi.detailLoading || instancesApi.statusLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.instanceModules.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.instances.instanceModules.subtitle')}</p>
      </header>

      <StudioFilterSurface className="space-y-4">
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
      </StudioFilterSurface>

      <InstanceModulesWorkspace
        selectedInstance={selectedInstance}
        statusLoading={instancesApi.statusLoading}
        mutationError={instancesApi.mutationError}
        emptyState={t('admin.instances.instanceModules.empty')}
        onAssignModule={instancesApi.assignModule}
        onRevokeModule={instancesApi.revokeModule}
        onSeedIamBaseline={instancesApi.seedIamBaseline}
        onBootstrapAdminStructure={instancesApi.bootstrapAdminStructure}
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
