import { StudioTableSurface } from '../../../components/StudioTableSurface';
import { Button } from '@sva/studio-ui-react';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import { studioModuleIamContracts } from '../../../lib/plugins';
import { resolveModuleDescription } from '../modules/-module-description';
import { TenantIamStatusBadge } from './-instance-detail-view-shared';

import type { SelectedInstance } from './-instances-shared-types';

const activationPolicyLabels = {
  optional: 'admin.instances.instanceModules.detail.policy.optional',
  automatic: 'admin.instances.instanceModules.detail.policy.automatic',
  required: 'admin.instances.instanceModules.detail.policy.required',
} as const;

const activationOriginLabels = {
  manual: 'admin.instances.instanceModules.detail.origin.manual',
  policy_reconcile: 'admin.instances.instanceModules.detail.origin.policyReconcile',
  migration: 'admin.instances.instanceModules.detail.origin.migration',
} as const;

const manualOverrideLabels = {
  enabled: 'admin.instances.instanceModules.detail.override.enabled',
  disabled: 'admin.instances.instanceModules.detail.override.disabled',
} as const;

const ModuleTransparencyTable = ({ selectedInstance }: { selectedInstance: SelectedInstance }) => {
  const contractsByModuleId = new Map(
    studioModuleIamContracts.map((contract) => [contract.moduleId, contract] as const)
  );
  const activationsByModuleId = new Map(
    (selectedInstance.moduleActivations ?? []).map(
      (activation) => [activation.moduleId, activation] as const
    )
  );
  const moduleIds = [
    ...new Set([...contractsByModuleId.keys(), ...activationsByModuleId.keys()]),
  ].sort((left, right) => left.localeCompare(right, 'de'));
  const tenantModules = moduleIds.map((moduleId) => {
    const contract = contractsByModuleId.get(moduleId);
    return {
      moduleId,
      description: contract
        ? resolveModuleDescription(contract.descriptionKey)
        : t('admin.instances.instanceModules.detail.descriptionFallback'),
      activation: activationsByModuleId.get(moduleId),
    };
  });

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
              {t('admin.instances.instanceModules.detail.table.policy')}
            </th>
            <th className="px-3 py-2 text-left font-medium text-foreground">
              {t('admin.instances.instanceModules.detail.table.origin')}
            </th>
            <th className="px-3 py-2 text-left font-medium text-foreground">
              {t('admin.instances.instanceModules.detail.table.override')}
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
                {module.activation?.effectiveActive
                  ? t('admin.instances.instanceModules.detail.status.active')
                  : t('admin.instances.instanceModules.detail.status.inactive')}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {module.activation
                  ? t(activationPolicyLabels[module.activation.activationPolicy])
                  : t('admin.instances.instanceModules.detail.notMaterialized')}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {module.activation
                  ? t(activationOriginLabels[module.activation.activationOrigin])
                  : t('admin.instances.instanceModules.detail.notMaterialized')}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {module.activation?.manualOverride
                  ? t(manualOverrideLabels[module.activation.manualOverride])
                  : t('admin.instances.instanceModules.detail.override.none')}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{module.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StudioTableSurface>
  );
};

export const ModuleActivationTransparencyCard = ({
  selectedInstance,
}: {
  readonly selectedInstance: SelectedInstance;
}) => (
  <Card className="space-y-4 p-4">
    <div className="space-y-1">
      <div className="font-medium text-foreground">
        {t('admin.instances.instanceModules.detail.title')}
      </div>
      <p className="text-sm text-muted-foreground">
        {t('admin.instances.instanceModules.detail.subtitle')}
      </p>
    </div>
    <ModuleTransparencyTable selectedInstance={selectedInstance} />
  </Card>
);

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
          <div className="font-medium text-foreground">
            {t('admin.instances.instanceModules.title')}
          </div>
          <p className="text-sm text-muted-foreground">
            {selectedInstance.moduleIamStatus.overall.summary}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TenantIamStatusBadge status={selectedInstance.moduleIamStatus.overall.status} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void onSeedIamBaseline()}
            disabled={statusLoading}
          >
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
    <ModuleActivationTransparencyCard selectedInstance={selectedInstance} />
  </>
);
