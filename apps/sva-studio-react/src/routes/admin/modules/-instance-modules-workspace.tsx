import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import { studioModuleIamContracts } from '../../../lib/plugins';
import { getErrorMessage } from '../instances/-instances-shared';
import { resolveModuleDescription } from './-module-description';

type ModuleWorkspaceInstance = {
  readonly instanceId: string;
  readonly assignedModules?: readonly string[];
};

type InstanceModulesWorkspaceProps = {
  readonly selectedInstance: ModuleWorkspaceInstance | null;
  readonly statusLoading: boolean;
  readonly mutationError: IamHttpError | null;
  readonly showMutationError?: boolean;
  readonly emptyState: string;
  readonly onAssignModule: (instanceId: string, moduleId: string) => Promise<unknown>;
  readonly onRevokeModule: (instanceId: string, moduleId: string) => Promise<unknown>;
  readonly onSeedIamBaseline: (instanceId: string) => Promise<unknown>;
  readonly onBootstrapAdminStructure: (instanceId: string, moduleIds: readonly string[]) => Promise<unknown>;
};

const formatRoleNames = (roleNames: readonly string[]) => roleNames.join(', ');

export const InstanceModulesWorkspace = ({
  selectedInstance,
  statusLoading,
  mutationError,
  showMutationError = true,
  emptyState,
  onAssignModule,
  onRevokeModule,
  onSeedIamBaseline,
  onBootstrapAdminStructure,
}: InstanceModulesWorkspaceProps) => {
  const [pendingRevokeModuleId, setPendingRevokeModuleId] = React.useState<string | null>(null);
  const [bootstrapConfirmOpen, setBootstrapConfirmOpen] = React.useState(false);

  const assignedModuleIds = new Set(selectedInstance?.assignedModules ?? []);
  const assignedModules = studioModuleIamContracts.filter((module) => assignedModuleIds.has(module.moduleId));
  const availableModules = studioModuleIamContracts.filter((module) => !assignedModuleIds.has(module.moduleId));
  const pendingRevokeModule = assignedModules.find((module) => module.moduleId === pendingRevokeModuleId) ?? null;

  return (
    <div className="space-y-5">
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

      {showMutationError && mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{getErrorMessage(mutationError)}</AlertDescription>
        </Alert>
      ) : null}

      {selectedInstance ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-medium text-foreground">{t('admin.instances.instanceModules.assigned.title')}</div>
                <p className="text-sm text-muted-foreground">{t('admin.instances.instanceModules.assigned.subtitle')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void onSeedIamBaseline(selectedInstance.instanceId)}
                  disabled={statusLoading}
                >
                  {t('admin.instances.instanceModules.actions.seedIamBaseline')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBootstrapConfirmOpen(true)}
                  disabled={statusLoading}
                >
                  {t('admin.instances.instanceModules.actions.bootstrapAdminStructure')}
                </Button>
              </div>
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
                            value: formatRoleNames((module.systemRoles ?? []).map((role) => role.roleName)),
                          })}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {resolveModuleDescription(module.descriptionKey)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPendingRevokeModuleId(module.moduleId)}
                        disabled={statusLoading}
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
                            value: formatRoleNames((module.systemRoles ?? []).map((role) => role.roleName)),
                          })}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {resolveModuleDescription(module.descriptionKey)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => void onAssignModule(selectedInstance.instanceId, module.moduleId)}
                        disabled={statusLoading}
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
          const success = await onRevokeModule(selectedInstance.instanceId, pendingRevokeModule.moduleId);
          if (success) {
            setPendingRevokeModuleId(null);
          }
        }}
      />

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
          const success = await onBootstrapAdminStructure(
            selectedInstance.instanceId,
            selectedInstance.assignedModules ?? []
          );
          if (success) {
            setBootstrapConfirmOpen(false);
          }
        }}
      />
    </div>
  );
};
