import { StudioTableSurface } from '../../../components/StudioTableSurface';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import { studioModuleIamContracts } from '../../../lib/plugins';
import { resolveModuleDescription } from '../modules/-module-description';
import { TenantIamStatusBadge } from './-instance-detail-view-shared';

import type { SelectedInstance } from './-instances-shared-types';

const ModuleTransparencyTable = ({ selectedInstance }: { selectedInstance: SelectedInstance }) => {
  const assignedModuleIds = new Set(selectedInstance.assignedModules ?? []);
  const tenantModules = studioModuleIamContracts.map((module) => ({
    moduleId: module.moduleId,
    description: resolveModuleDescription(module.descriptionKey),
    isActive: assignedModuleIds.has(module.moduleId),
  }));

  return (
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
          {tenantModules.map((module) => (
            <tr key={module.moduleId} className="border-t border-border align-top">
              <td className="px-3 py-2 font-medium text-foreground">{module.moduleId}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {module.isActive
                  ? t('admin.instances.instanceModules.detail.status.active')
                  : t('admin.instances.instanceModules.detail.status.inactive')}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{module.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StudioTableSurface>
  );
};

const ModuleIamStatusCard = ({
  selectedInstance,
  onSeedIamBaseline,
  statusLoading,
}: {
  readonly selectedInstance: SelectedInstance;
  readonly onSeedIamBaseline: () => Promise<void>;
  readonly statusLoading: boolean;
}) =>
  selectedInstance.moduleIamStatus ? (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{t('admin.instances.instanceModules.title')}</div>
          <p className="text-sm text-muted-foreground">{selectedInstance.moduleIamStatus.overall.summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <TenantIamStatusBadge status={selectedInstance.moduleIamStatus.overall.status} />
          <Button type="button" variant="outline" size="sm" onClick={() => void onSeedIamBaseline()} disabled={statusLoading}>
            {t('admin.instances.instanceModules.actions.seedIamBaseline')}
          </Button>
        </div>
      </div>
    </Card>
  ) : null;

export const InstanceDetailModulesSection = ({
  selectedInstance,
  onSeedIamBaseline,
  statusLoading,
}: {
  readonly selectedInstance: SelectedInstance;
  readonly onSeedIamBaseline: () => Promise<void>;
  readonly statusLoading: boolean;
}) => (
  <>
    <ModuleIamStatusCard
      selectedInstance={selectedInstance}
      onSeedIamBaseline={onSeedIamBaseline}
      statusLoading={statusLoading}
    />
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <div className="font-medium text-foreground">{t('admin.instances.instanceModules.detail.title')}</div>
        <p className="text-sm text-muted-foreground">{t('admin.instances.instanceModules.detail.subtitle')}</p>
      </div>
      <ModuleTransparencyTable selectedInstance={selectedInstance} />
    </Card>
  </>
);
