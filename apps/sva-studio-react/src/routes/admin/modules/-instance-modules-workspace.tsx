import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '@sva/studio-ui-react';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import { studioModuleIamContracts, studioPluginSnapshot } from '../../../lib/plugins';
import { getErrorMessage } from '../instances/-instances-shared';
import type { IamInstanceDetail } from '@sva/core';
import type { usePluginTenantReadiness } from '../../../hooks/use-plugin-tenant-readiness';
import { PluginReadinessCard } from '../instances/-instance-plugin-readiness-card';
import { resolveModuleDescription } from './-module-description';

type ModuleWorkspaceInstance = {
  readonly instanceId: string;
  readonly assignedModules?: readonly string[];
  readonly moduleActivations?: IamInstanceDetail['moduleActivations'];
};

type InstanceModulesWorkspaceProps = {
  readonly pluginReadiness?: ReturnType<typeof usePluginTenantReadiness>;
  readonly selectedInstance: ModuleWorkspaceInstance | null;
  readonly statusLoading: boolean;
  readonly mutationError: IamHttpError | null;
  readonly showMutationError?: boolean;
  readonly showBootstrapAction?: boolean;
  readonly emptyState: string;
  readonly onAssignModule: (instanceId: string, moduleId: string) => Promise<unknown>;
  readonly onRevokeModule: (instanceId: string, moduleId: string) => Promise<unknown>;
  readonly onSeedIamBaseline: (instanceId: string) => Promise<unknown>;
  readonly onBootstrapAdminStructure: (
    instanceId: string,
    moduleIds: readonly string[]
  ) => Promise<unknown>;
};

const formatRoleNames = (roleNames: readonly string[]) => roleNames.join(', ');

type StudioModuleContract = (typeof studioModuleIamContracts)[number];

const ModuleRow = ({
  module,
  instance,
  assigned,
  statusLoading,
  onAction,
  pluginReadiness,
}: {
  module: StudioModuleContract;
  instance: ModuleWorkspaceInstance;
  assigned: boolean;
  statusLoading: boolean;
  onAction: (moduleId: string) => void;
  pluginReadiness?: ReturnType<typeof usePluginTenantReadiness>;
}) => {
  const pluginId = studioPluginSnapshot.registry.pluginModuleIamContracts.find(
    (entry) => entry.moduleId === module.moduleId
  )?.ownerPluginId;
  const plugin = pluginId ? studioPluginSnapshot.registry.pluginRegistry.get(pluginId) : undefined;
  const lifecycle = studioPluginSnapshot.registry.tenantLifecycles.find(
    (entry) => entry.pluginId === pluginId
  );
  const readiness = pluginReadiness?.items.find((entry) => entry.pluginId === pluginId);
  const activation = instance.moduleActivations?.find(
    (entry) => entry.moduleId === module.moduleId
  );
  const policy =
    activation?.activationPolicy ??
    studioPluginSnapshot.tenantActivationPolicySnapshot.modules.find(
      (entry) => entry.moduleId === module.moduleId
    )?.activationPolicy;
  const readinessLabel = !lifecycle
    ? t('admin.instances.instanceModules.noLifecycle')
    : !readiness || pluginReadiness?.error
      ? t('admin.instances.instanceModules.notVerified')
      : t(`admin.instances.pluginReadiness.status.${readiness.status}`);
  return (
    <section className="space-y-3 rounded-lg border border-border p-3" aria-label={module.moduleId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-medium">{plugin?.displayName ?? module.moduleId}</h3>
          <p className="text-sm">
            {t(
              assigned
                ? 'admin.instances.instanceModules.assigned.title'
                : 'admin.instances.instanceModules.available.title'
            )}
          </p>
          <dl className="flex flex-wrap gap-3 text-sm">
            {' '}
            <div>
              <dt>{t('admin.instances.instanceModules.detail.table.status')}</dt>
              <dd>
                {activation
                  ? t(
                      activation.effectiveActive
                        ? 'admin.instances.instanceModules.detail.status.active'
                        : 'admin.instances.instanceModules.detail.status.inactive'
                    )
                  : t('admin.instances.instanceModules.detail.notMaterialized')}
              </dd>
            </div>
            <div>
              <dt>{t('admin.instances.instanceModules.detail.table.policy')}</dt>
              <dd>
                {policy
                  ? t(`admin.instances.instanceModules.detail.policy.${policy}`)
                  : t('admin.instances.instanceModules.detail.notMaterialized')}
              </dd>
            </div>
          </dl>
          <p className="text-sm" aria-live="polite">
            {t('admin.instances.instanceModules.readinessLabel')}: {readinessLabel}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={
            statusLoading || Boolean(readiness?.activeJobId) || (assigned && policy === 'required')
          }
          onClick={() => onAction(module.moduleId)}
        >
          {t(
            assigned
              ? 'admin.instances.instanceModules.actions.revoke'
              : 'admin.instances.instanceModules.actions.assign'
          )}
        </Button>
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          {t('admin.instances.wizard.technicalDetails')}
        </summary>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>{module.moduleId}</p>
          <p>{resolveModuleDescription(module.descriptionKey)}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt>{t('admin.instances.instanceModules.detail.table.origin')}</dt>
              <dd>
                {activation
                  ? t(
                      `admin.instances.instanceModules.detail.origin.${activation.activationOrigin === 'policy_reconcile' ? 'policyReconcile' : activation.activationOrigin}`
                    )
                  : t('admin.instances.instanceModules.detail.notMaterialized')}
              </dd>
            </div>
            <div>
              <dt>{t('admin.instances.instanceModules.detail.table.override')}</dt>
              <dd>
                {t(
                  `admin.instances.instanceModules.detail.override.${activation?.manualOverride ?? 'none'}`
                )}
              </dd>
            </div>
          </dl>
          <p>
            {t('admin.instances.instanceModules.module.permissions', {
              value: module.permissionIds.join(', '),
            })}
          </p>
          <p>
            {t('admin.instances.instanceModules.module.roles', {
              value: formatRoleNames((module.systemRoles ?? []).map((role) => role.roleName)),
            })}
          </p>
          {readiness && pluginReadiness ? (
            <PluginReadinessCard
              plugins={[readiness]}
              isLoading={pluginReadiness.isLoading}
              activeAction={pluginReadiness.activeAction}
              error={pluginReadiness.error}
              onRepair={pluginReadiness.startRepair}
            />
          ) : null}
        </div>
      </details>
    </section>
  );
};

export const InstanceModulesWorkspace = ({
  selectedInstance,
  pluginReadiness,
  statusLoading,
  mutationError,
  showMutationError = true,
  showBootstrapAction = true,
  emptyState,
  onAssignModule,
  onRevokeModule,
  onSeedIamBaseline,
  onBootstrapAdminStructure,
}: InstanceModulesWorkspaceProps) => {
  const [pendingRevokeModuleId, setPendingRevokeModuleId] = React.useState<string | null>(null);
  const [bootstrapConfirmOpen, setBootstrapConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const busyRef = React.useRef(false);
  const run = async (action: () => Promise<unknown>) => {
    if (busyRef.current || statusLoading) return;
    busyRef.current = true;
    setBusy(true);
    try {
      return await action();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const assignedModuleIds = new Set(selectedInstance?.assignedModules ?? []);
  const assignedModules = studioModuleIamContracts.filter((module) =>
    assignedModuleIds.has(module.moduleId)
  );
  const availableModuleIds = new Set(studioModuleIamContracts.map((module) => module.moduleId));
  const persistedModuleIds = new Set([
    ...assignedModuleIds,
    ...(selectedInstance?.moduleActivations ?? []).map((activation) => activation.moduleId),
  ]);
  const unavailableModuleIds = [...persistedModuleIds].filter(
    (moduleId) => !availableModuleIds.has(moduleId)
  );
  const availableModules = studioModuleIamContracts.filter(
    (module) => !assignedModuleIds.has(module.moduleId)
  );
  const pendingRevokeModule =
    assignedModules.find((module) => module.moduleId === pendingRevokeModuleId) ?? null;

  return (
    <div className="space-y-5">
      {showMutationError && mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{getErrorMessage(mutationError)}</AlertDescription>
        </Alert>
      ) : null}

      {selectedInstance ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={statusLoading || busy}
              onClick={() => void run(() => onSeedIamBaseline(selectedInstance.instanceId))}
            >
              {t('admin.instances.instanceModules.actions.seedIamBaseline')}
            </Button>
            {showBootstrapAction ? (
              <Button
                type="button"
                variant="secondary"
                disabled={statusLoading || busy}
                onClick={() => setBootstrapConfirmOpen(true)}
              >
                {t('admin.instances.instanceModules.actions.bootstrapAdminStructure')}
              </Button>
            ) : null}
          </div>
          {pluginReadiness?.error ? (
            <Alert>
              <AlertDescription>{getErrorMessage(pluginReadiness.error)}</AlertDescription>
            </Alert>
          ) : null}
          {[
            { key: 'assigned', modules: assignedModules },
            { key: 'available', modules: availableModules },
          ].map((group) => (
            <Card key={group.key} className="space-y-3 p-4">
              <h2 className="font-medium">
                {t(`admin.instances.instanceModules.${group.key}.title`)}
              </h2>
              {group.modules.map((module) => (
                <ModuleRow
                  key={module.moduleId}
                  module={module}
                  instance={selectedInstance}
                  assigned={group.key === 'assigned'}
                  statusLoading={statusLoading || busy || Boolean(pluginReadiness?.activeAction)}
                  pluginReadiness={pluginReadiness}
                  onAction={
                    group.key === 'assigned'
                      ? setPendingRevokeModuleId
                      : (moduleId) =>
                          void run(() => onAssignModule(selectedInstance.instanceId, moduleId))
                  }
                />
              ))}
              {group.key === 'assigned'
                ? unavailableModuleIds.map((moduleId) => (
                    <section
                      key={moduleId}
                      className="rounded-lg border border-border p-3"
                      aria-label={moduleId}
                    >
                      <h3>{moduleId}</h3>
                      <p>{t('admin.instances.instanceModules.detail.status.unavailable')}</p>
                      <p>{t('admin.instances.instanceModules.notVerified')}</p>
                    </section>
                  ))
                : null}
              {group.modules.length === 0 &&
              (group.key !== 'assigned' || unavailableModuleIds.length === 0) ? (
                <p className="text-sm text-muted-foreground">
                  {t(`admin.instances.instanceModules.${group.key}.empty`)}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-4 text-sm text-muted-foreground">{emptyState}</Card>
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
          const success = await run(() =>
            onRevokeModule(selectedInstance.instanceId, pendingRevokeModule.moduleId)
          );
          if (success) {
            setPendingRevokeModuleId(null);
          }
        }}
      />

      {showBootstrapAction ? (
        <ConfirmDialog
          open={bootstrapConfirmOpen && selectedInstance !== null}
          title={t('admin.instances.instanceModules.confirmBootstrap.title')}
          description={t('admin.instances.instanceModules.confirmBootstrap.description', {
            instanceId: selectedInstance?.instanceId ?? '',
          })}
          confirmLabel={t('admin.instances.instanceModules.confirmBootstrap.confirm')}
          cancelLabel={t('admin.instances.instanceModules.confirmBootstrap.cancel')}
          onCancel={() => setBootstrapConfirmOpen(false)}
          onConfirm={async () => {
            if (!selectedInstance) {
              return;
            }
            const success = await run(() =>
              onBootstrapAdminStructure(
                selectedInstance.instanceId,
                assignedModules.map((module) => module.moduleId)
              )
            );
            if (success) {
              setBootstrapConfirmOpen(false);
            }
          }}
        />
      ) : null}
    </div>
  );
};
