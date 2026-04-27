import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { useRolePermissions } from '../../../hooks/use-role-permissions';
import { useRoles } from '../../../hooks/use-roles';
import { useUsers } from '../../../hooks/use-users';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';
import type { IamHttpError } from '../../../lib/iam-api';
import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';

type RoleDetailTab = 'general' | 'permissions' | 'assignments' | 'sync';

type RoleDetailPageProps = Readonly<{
  roleId: string;
  activeTab: RoleDetailTab;
}>;

const TABS: readonly RoleDetailTab[] = ['general', 'permissions', 'assignments', 'sync'];

const ROLE_PERMISSION_ACTION_LABELS = {
  read: 'admin.roles.permissionActions.read',
  create: 'admin.roles.permissionActions.create',
  write: 'admin.roles.permissionActions.write',
  update: 'admin.roles.permissionActions.update',
  updatemetadata: 'admin.roles.permissionActions.updateMetadata',
  updatepayload: 'admin.roles.permissionActions.updatePayload',
  changestatus: 'admin.roles.permissionActions.changeStatus',
  publish: 'admin.roles.permissionActions.publish',
  archive: 'admin.roles.permissionActions.archive',
  restore: 'admin.roles.permissionActions.restore',
  readhistory: 'admin.roles.permissionActions.readHistory',
  managerevisions: 'admin.roles.permissionActions.manageRevisions',
  delete: 'admin.roles.permissionActions.delete',
  configure: 'admin.roles.permissionActions.configure',
  export: 'admin.roles.permissionActions.export',
} as const;

const ROLE_PERMISSION_RESOURCE_LABELS = {
  content: 'admin.roles.permissionResources.content',
  iam: 'admin.roles.permissionResources.iam',
  users: 'admin.roles.permissionResources.users',
  user: 'admin.roles.permissionResources.users',
  roles: 'admin.roles.permissionResources.roles',
  role: 'admin.roles.permissionResources.roles',
  groups: 'admin.roles.permissionResources.groups',
  group: 'admin.roles.permissionResources.groups',
  organizations: 'admin.roles.permissionResources.organizations',
  organization: 'admin.roles.permissionResources.organizations',
  legal: 'admin.roles.permissionResources.legal',
  interfaces: 'admin.roles.permissionResources.interfaces',
  news: 'admin.roles.permissionResources.news',
  events: 'admin.roles.permissionResources.events',
  poi: 'admin.roles.permissionResources.poi',
} as const;

const ROLE_TAB_LABELS: Record<RoleDetailTab, TranslationKey> = {
  general: 'admin.roles.detail.tabs.general',
  permissions: 'admin.roles.detail.tabs.permissions',
  assignments: 'admin.roles.detail.tabs.assignments',
  sync: 'admin.roles.detail.tabs.sync',
};

const STATUS_LABEL_KEYS = {
  synced: 'admin.roles.sync.synced',
  pending: 'admin.roles.sync.pending',
  failed: 'admin.roles.sync.failed',
} as const;

const statusLabel = (syncState: 'synced' | 'pending' | 'failed'): string => t(STATUS_LABEL_KEYS[syncState]);

const roleTypeLabel = (role: { isSystemRole: boolean; managedBy: 'studio' | 'external' | 'keycloak_builtin' }): string => {
  if (role.isSystemRole) {
    return t('admin.roles.labels.systemRole');
  }
  if (role.managedBy === 'keycloak_builtin') {
    return t('admin.roles.labels.builtInRole');
  }
  if (role.managedBy === 'external') {
    return t('admin.roles.labels.externalRole');
  }
  return t('admin.roles.labels.customRole');
};

const roleErrorMessage = (error: IamHttpError | null, fallbackKey: TranslationKey): string => {
  if (!error) {
    return t(fallbackKey);
  }

  if (error.diagnosticStatus === 'recovery_laeuft') {
    return t('admin.roles.errors.recoveryRunning');
  }

  if (error.classification === 'keycloak_reconcile') {
    return t('admin.roles.errors.keycloakReconcile');
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.roles.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.roles.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.roles.errors.rateLimited');
    case 'conflict':
      return t('admin.roles.errors.conflict');
    case 'keycloak_unavailable':
      return t('admin.roles.errors.keycloakUnavailable');
    case 'database_unavailable':
      return t('admin.roles.errors.databaseUnavailable');
    default:
      return t(fallbackKey);
  }
};

const humanizePermissionSegment = (value: string): string =>
  value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const mapPermissionActionLabel = (action: string): string => {
  const normalizedAction = action.toLowerCase() as keyof typeof ROLE_PERMISSION_ACTION_LABELS;
  return normalizedAction in ROLE_PERMISSION_ACTION_LABELS
    ? t(ROLE_PERMISSION_ACTION_LABELS[normalizedAction])
    : humanizePermissionSegment(action);
};

const mapPermissionResourceLabel = (resource: string): string => {
  const normalizedResource = resource.toLowerCase() as keyof typeof ROLE_PERMISSION_RESOURCE_LABELS;
  return normalizedResource in ROLE_PERMISSION_RESOURCE_LABELS
    ? t(ROLE_PERMISSION_RESOURCE_LABELS[normalizedResource])
    : humanizePermissionSegment(resource);
};

const summarizePermission = (permissionKey: string) => {
  const [resourceSegment, actionSegment = 'access'] = permissionKey.split('.');
  return {
    resourceLabel: mapPermissionResourceLabel(resourceSegment),
    actionLabel: mapPermissionActionLabel(actionSegment),
    detailLabel: `${mapPermissionActionLabel(actionSegment)} ${mapPermissionResourceLabel(resourceSegment)}`,
  };
};

const sortPermissionIdsByCatalog = (
  permissionIds: readonly string[],
  catalog: readonly { id: string; permissionKey: string }[]
) =>
  [...permissionIds].sort((left, right) => {
    const leftKey = catalog.find((permission) => permission.id === left)?.permissionKey ?? left;
    const rightKey = catalog.find((permission) => permission.id === right)?.permissionKey ?? right;
    return leftKey.localeCompare(rightKey);
  });

const groupPermissionsByCatalog = (
  permissions: readonly { id: string; permissionKey: string; description?: string | null }[]
): readonly (readonly [string, readonly { id: string; permissionKey: string; description?: string | null }[]])[] => {
  const buckets = new Map<string, { id: string; permissionKey: string; description?: string | null }[]>();
  for (const permission of permissions) {
    const summary = summarizePermission(permission.permissionKey);
    const existing = buckets.get(summary.resourceLabel) ?? [];
    existing.push(permission);
    buckets.set(summary.resourceLabel, existing);
  }

  return [...buckets.entries()]
    .map(([resourceLabel, items]) => [
      resourceLabel,
      [...items].sort((left, right) => left.permissionKey.localeCompare(right.permissionKey)),
    ] as const)
    .sort(([left], [right]) => left.localeCompare(right));
};

export const normalizeRoleDetailTab = (value: unknown): RoleDetailTab => {
  if (typeof value !== 'string') {
    return 'general';
  }

  return TABS.includes(value as RoleDetailTab) ? (value as RoleDetailTab) : 'general';
};

export const RoleDetailPage = ({ roleId, activeTab }: RoleDetailPageProps) => {
  const rolesApi = useRoles();
  const permissionsApi = useRolePermissions();
  const usersApi = useUsers({ page: 1, pageSize: 100 });
  const navigate = useNavigate();
  const role = React.useMemo(() => rolesApi.roles.find((entry) => entry.id === roleId) ?? null, [roleId, rolesApi.roles]);
  const isReadOnly = role ? role.isSystemRole || role.managedBy !== 'studio' : true;
  const [editForm, setEditForm] = React.useState({
    displayName: '',
    description: '',
    roleLevel: '10',
  });
  const [permissionDraft, setPermissionDraft] = React.useState<string[]>([]);
  const [isSavingMeta, setIsSavingMeta] = React.useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = React.useState(false);
  const [isUpdatingAssignmentsForUserIds, setIsUpdatingAssignmentsForUserIds] = React.useState<string[]>([]);
  const [showTechnicalDetails, setShowTechnicalDetails] = React.useState(false);

  React.useEffect(() => {
    if (!role) {
      return;
    }

    setEditForm({
      displayName: role.roleName,
      description: role.description ?? '',
      roleLevel: String(role.roleLevel),
    });
    setPermissionDraft(sortPermissionIdsByCatalog(role.permissions.map((permission) => permission.id), permissionsApi.permissions));
  }, [permissionsApi.permissions, role]);

  const groupedPermissions = React.useMemo(
    () => groupPermissionsByCatalog(permissionsApi.permissions),
    [permissionsApi.permissions]
  );

  const onTabIntent = (tab: RoleDetailTab): void => {
    void Promise.resolve(
      navigate({
        to: '/admin/roles/$roleId',
        params: { roleId },
        search: { tab },
        replace: true,
      })
    ).catch(() => undefined);
  };

  const assignedUsers = React.useMemo(() => {
    if (!role) {
      return [];
    }

    return usersApi.users.filter((user) => user.roles.some((assignment) => assignment.roleId === role.id));
  }, [role, usersApi.users]);

  const unassignedUsers = React.useMemo(() => {
    if (!role) {
      return [];
    }

    return usersApi.users.filter((user) => user.roles.every((assignment) => assignment.roleId !== role.id));
  }, [role, usersApi.users]);

  const onSaveGeneral = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!role || isReadOnly) {
      return;
    }

    setIsSavingMeta(true);
    try {
      await rolesApi.updateRole(role.id, {
        displayName: editForm.displayName.trim(),
        description: editForm.description.trim() || undefined,
        roleLevel: Number(editForm.roleLevel),
      });
    } finally {
      setIsSavingMeta(false);
    }
  };

  const onSavePermissions = async () => {
    if (!role || isReadOnly) {
      return;
    }

    setIsSavingPermissions(true);
    try {
      await rolesApi.updateRole(role.id, {
        permissionIds: permissionDraft,
      });
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const resetPermissionDraft = () => {
    if (!role) {
      return;
    }

    setPermissionDraft(sortPermissionIdsByCatalog(role.permissions.map((permission) => permission.id), permissionsApi.permissions));
  };

  const updateRoleAssignment = async (userId: string, nextRoleIds: readonly string[]) => {
    setIsUpdatingAssignmentsForUserIds((current) => [...current, userId]);
    try {
      await usersApi.updateUser(userId, {
        roleIds: nextRoleIds,
      });
    } finally {
      setIsUpdatingAssignmentsForUserIds((current) => current.filter((entry) => entry !== userId));
    }
  };

  const assignRoleToUser = async (userId: string, currentRoleIds: readonly string[]) => {
    if (!role) {
      return;
    }

    const nextRoleIds = currentRoleIds.includes(role.id) ? [...currentRoleIds] : [...currentRoleIds, role.id];
    await updateRoleAssignment(userId, nextRoleIds);
  };

  const removeRoleFromUser = async (userId: string, currentRoleIds: readonly string[]) => {
    if (!role) {
      return;
    }

    await updateRoleAssignment(
      userId,
      currentRoleIds.filter((entry) => entry !== role.id)
    );
  };

  const togglePermissionDraft = (permissionId: string) => {
    setPermissionDraft((current) => {
      const nextIds = current.includes(permissionId)
        ? current.filter((entry) => entry !== permissionId)
        : [...current, permissionId];

      return sortPermissionIdsByCatalog(nextIds, permissionsApi.permissions);
    });
  };

  if (rolesApi.error) {
    return (
      <section className="space-y-4">
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{roleErrorMessage(rolesApi.error, 'admin.roles.messages.error')}</span>
            <IamRuntimeDiagnosticDetails error={rolesApi.error} />
          </AlertDescription>
        </Alert>
        <Button type="button" variant="outline" onClick={() => void rolesApi.refetch()}>
          {t('admin.roles.actions.retry')}
        </Button>
      </section>
    );
  }

  if (!role && rolesApi.isLoading) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('admin.roles.messages.loading')}</p>
      </section>
    );
  }

  if (!role) {
    return (
      <section className="space-y-4">
        <Button asChild type="button" variant="outline">
          <Link to="/admin/roles">{t('admin.roles.detail.backToList')}</Link>
        </Button>
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{t('admin.roles.detail.notFound')}</AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-busy={rolesApi.isLoading || isSavingMeta || isSavingPermissions}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Button asChild type="button" variant="outline" size="sm">
            <Link to="/admin/roles">{t('admin.roles.detail.backToList')}</Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">{role.roleName}</h1>
            <p className="text-sm text-muted-foreground">{t('admin.roles.detail.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{roleTypeLabel(role)}</Badge>
            <Badge variant="outline">{statusLabel(role.syncState)}</Badge>
            <Badge variant="outline">{t('admin.roles.detail.badges.permissionCount', { count: String(role.permissions.length) })}</Badge>
            <Badge variant="outline">{t('admin.roles.detail.badges.assignmentCount', { count: String(role.memberCount) })}</Badge>
          </div>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/iam" search={{ tab: 'rights' }}>
            {t('admin.roles.workspace.openIamCta')}
          </Link>
        </Button>
      </div>

      {rolesApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{roleErrorMessage(rolesApi.mutationError, 'admin.roles.messages.error')}</span>
            <IamRuntimeDiagnosticDetails error={rolesApi.mutationError} />
          </AlertDescription>
        </Alert>
      ) : null}

      {isReadOnly ? (
        <Alert className="border-secondary/40 bg-secondary/10 text-secondary">
          <AlertDescription>
            {role.isSystemRole
              ? t('admin.roles.workspace.readOnlySystemHint')
              : t('admin.roles.workspace.readOnlyExternalHint')}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card role="tablist" aria-label={t('admin.roles.detail.tabsAriaLabel')} className="flex overflow-x-auto p-1">
        {TABS.map((tab, index) => {
          const selected = tab === activeTab;
          return (
            <Button
              key={tab}
              id={`role-detail-tab-${tab}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`role-detail-panel-${tab}`}
              className={`text-sm transition ${
                selected ? 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground'
              }`}
              onClick={() => onTabIntent(tab)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
                  return;
                }

                event.preventDefault();
                const direction = event.key === 'ArrowRight' ? 1 : -1;
                const nextIndex = (index + direction + TABS.length) % TABS.length;
                const nextTab = TABS[nextIndex] ?? 'general';
                onTabIntent(nextTab);
              }}
              variant={selected ? 'default' : 'ghost'}
            >
              {t(ROLE_TAB_LABELS[tab])}
            </Button>
          );
        })}
      </Card>

      <form
        id="role-detail-panel-general"
        role="tabpanel"
        aria-labelledby="role-detail-tab-general"
        hidden={activeTab !== 'general'}
        className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2"
        onSubmit={onSaveGeneral}
      >
        <div className="grid gap-2 text-sm text-foreground">
          <Label htmlFor="role-detail-key">{t('admin.roles.editDialog.keyLabel')}</Label>
          <Input id="role-detail-key" value={role.roleKey} disabled className="bg-muted" />
        </div>
        <div className="grid gap-2 text-sm text-foreground">
          <Label htmlFor="role-detail-external">{t('admin.roles.detail.general.externalRoleName')}</Label>
          <Input id="role-detail-external" value={role.externalRoleName} disabled className="bg-muted" />
        </div>
        <div className="grid gap-2 text-sm text-foreground">
          <Label htmlFor="role-detail-name">{t('admin.roles.editDialog.nameLabel')}</Label>
          <Input
            id="role-detail-name"
            value={editForm.displayName}
            disabled={isReadOnly}
            onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))}
          />
        </div>
        <div className="grid gap-2 text-sm text-foreground">
          <Label htmlFor="role-detail-level">{t('admin.roles.editDialog.levelLabel')}</Label>
          <Input
            id="role-detail-level"
            type="number"
            min={0}
            max={100}
            value={editForm.roleLevel}
            disabled={isReadOnly}
            onChange={(event) => setEditForm((current) => ({ ...current, roleLevel: event.target.value }))}
          />
        </div>
        <div className="grid gap-2 text-sm text-foreground md:col-span-2">
          <Label htmlFor="role-detail-description">{t('admin.roles.editDialog.descriptionLabel')}</Label>
          <Textarea
            id="role-detail-description"
            value={editForm.description}
            disabled={isReadOnly}
            onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-3 md:col-span-2">
          <Button type="button" variant="outline" disabled={isReadOnly} onClick={() => {
            setEditForm({
              displayName: role.roleName,
              description: role.description ?? '',
              roleLevel: String(role.roleLevel),
            });
          }}>
            {t('admin.roles.detail.general.reset')}
          </Button>
          <Button type="submit" disabled={isReadOnly || isSavingMeta}>
            {isSavingMeta ? t('admin.roles.detail.general.saving') : t('admin.roles.detail.general.save')}
          </Button>
        </div>
      </form>

      <section
        id="role-detail-panel-permissions"
        role="tabpanel"
        aria-labelledby="role-detail-tab-permissions"
        hidden={activeTab !== 'permissions'}
        className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-shell"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">{t('admin.roles.workspace.editPermissionsTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('admin.roles.detail.permissions.subtitle')}</p>
          </div>
          <Card className="space-y-3 p-4 shadow-none">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">{t('admin.roles.workspace.sideTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('admin.roles.workspace.sideSubtitle')}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t('admin.roles.detail.permissions.cockpitHint')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                aria-pressed={showTechnicalDetails}
                onClick={() => setShowTechnicalDetails((current) => !current)}
              >
                {showTechnicalDetails
                  ? t('admin.roles.detail.permissions.hideTechnicalDetails')
                  : t('admin.roles.detail.permissions.showTechnicalDetails')}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link to="/admin/iam" search={{ tab: 'rights' }}>
                  {t('admin.roles.workspace.openIamCta')}
                </Link>
              </Button>
            </div>
          </Card>
        </div>

        {permissionsApi.error ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{t('admin.roles.workspace.permissionsLoadError')}</AlertDescription>
          </Alert>
        ) : permissionsApi.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('admin.roles.workspace.permissionsLoading')}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {groupedPermissions.map(([resourceLabel, permissions]) => (
              <div key={resourceLabel} className="space-y-2 rounded-lg border border-border p-3">
                <h3 className="text-sm font-medium text-foreground">{resourceLabel}</h3>
                <div className="space-y-2">
                  {permissions.map((permission) => {
                    const permissionSummary = summarizePermission(permission.permissionKey);
                    const isAssigned = permissionDraft.includes(permission.id);
                    return (
                      <label key={permission.id} className="flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={isAssigned}
                          disabled={isReadOnly}
                          onChange={() => togglePermissionDraft(permission.id)}
                        />
                        <span className="space-y-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="block font-medium text-foreground">{permissionSummary.detailLabel}</span>
                            <Badge variant={isAssigned ? 'default' : 'outline'}>
                              {isAssigned
                                ? t('admin.roles.detail.permissions.assigned')
                                : t('admin.roles.detail.permissions.notAssigned')}
                            </Badge>
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {permission.description ?? permission.permissionKey}
                          </span>
                          {showTechnicalDetails ? (
                            <span className="block rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                              <span className="block">
                                {t('admin.roles.workspace.technicalKey', { value: permission.permissionKey })}
                              </span>
                              <span className="block">
                                {t('admin.roles.workspace.resourceLabel', { value: permissionSummary.resourceLabel })}
                              </span>
                              <span className="block">
                                {t('admin.roles.detail.permissions.actionLabel', { value: permissionSummary.actionLabel })}
                              </span>
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={isReadOnly || permissionsApi.isLoading || Boolean(permissionsApi.error) || isSavingPermissions}
            onClick={() => void onSavePermissions()}
          >
            {isSavingPermissions
              ? t('admin.roles.workspace.savingPermissions')
              : t('admin.roles.workspace.savePermissions')}
          </Button>
          <Button type="button" variant="outline" disabled={isReadOnly} onClick={resetPermissionDraft}>
            {t('admin.roles.workspace.resetPermissions')}
          </Button>
        </div>
      </section>

      <section
        id="role-detail-panel-assignments"
        role="tabpanel"
        aria-labelledby="role-detail-tab-assignments"
        hidden={activeTab !== 'assignments'}
        className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2"
      >
        <Card className="space-y-3 p-4 shadow-none">
          <h2 className="text-base font-semibold text-foreground">{t('admin.roles.detail.assignments.summaryTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.roles.detail.assignments.summaryBody')}</p>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('admin.roles.workspace.assignmentCountLabel')}</dt>
              <dd>{t('admin.roles.workspace.assignmentCountValue', { count: String(role.memberCount) })}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('admin.roles.detail.assignments.managedBy')}</dt>
              <dd>{role.managedBy}</dd>
            </div>
          </dl>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="role-assignment-search">{t('admin.roles.detail.assignments.searchLabel')}</Label>
            <Input
              id="role-assignment-search"
              value={usersApi.filters.search}
              onChange={(event) => usersApi.setSearch(event.target.value)}
              placeholder={t('admin.roles.detail.assignments.searchPlaceholder')}
            />
          </div>
        </Card>
        <Card className="space-y-4 p-4 shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t('admin.roles.detail.assignments.managementTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('admin.roles.detail.assignments.managementBody')}</p>
            </div>
            <Button asChild type="button" variant="outline">
              <Link to="/admin/users">{t('admin.roles.detail.assignments.openUsers')}</Link>
            </Button>
          </div>

          {usersApi.error ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{t('admin.roles.detail.assignments.loadError')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">{t('admin.roles.detail.assignments.currentTitle')}</h3>
              {usersApi.isLoading ? (
                <p className="text-sm text-muted-foreground">{t('admin.roles.detail.assignments.loading')}</p>
              ) : assignedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('admin.roles.detail.assignments.emptyAssigned')}</p>
              ) : (
                <ul className="space-y-2">
                  {assignedUsers.map((user) => {
                    const roleIds = user.roles.map((assignment) => assignment.roleId);
                    const isBusy = isUpdatingAssignmentsForUserIds.includes(user.id);
                    return (
                      <li key={user.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground">{user.email ?? user.keycloakSubject}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isReadOnly || isBusy}
                          onClick={() => void removeRoleFromUser(user.id, roleIds)}
                        >
                          {isBusy
                            ? t('admin.roles.detail.assignments.updating')
                            : t('admin.roles.detail.assignments.remove')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">{t('admin.roles.detail.assignments.availableTitle')}</h3>
              {usersApi.isLoading ? (
                <p className="text-sm text-muted-foreground">{t('admin.roles.detail.assignments.loading')}</p>
              ) : unassignedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('admin.roles.detail.assignments.emptyAvailable')}</p>
              ) : (
                <ul className="space-y-2">
                  {unassignedUsers.map((user) => {
                    const roleIds = user.roles.map((assignment) => assignment.roleId);
                    const isBusy = isUpdatingAssignmentsForUserIds.includes(user.id);
                    return (
                      <li key={user.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground">{user.email ?? user.keycloakSubject}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isReadOnly || isBusy}
                          onClick={() => void assignRoleToUser(user.id, roleIds)}
                        >
                          {isBusy
                            ? t('admin.roles.detail.assignments.updating')
                            : t('admin.roles.detail.assignments.assign')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </section>

      <section
        id="role-detail-panel-sync"
        role="tabpanel"
        aria-labelledby="role-detail-tab-sync"
        hidden={activeTab !== 'sync'}
        className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-shell md:grid-cols-2"
      >
        <Card className="space-y-3 p-4 shadow-none">
          <h2 className="text-base font-semibold text-foreground">{t('admin.roles.detail.sync.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.roles.detail.sync.subtitle')}</p>
          <Alert className="border-secondary/40 bg-secondary/5 text-secondary">
            <AlertDescription>
              {role.managedBy === 'studio'
                ? t('admin.roles.detail.sync.metadataOnlyHint')
                : t('admin.roles.detail.sync.externalHint')}
            </AlertDescription>
          </Alert>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('admin.roles.detail.sync.metadataStatus')}</dt>
              <dd>{statusLabel(role.syncState)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('admin.roles.detail.sync.lastSyncedAt')}</dt>
              <dd>{role.lastSyncedAt ?? t('admin.roles.detail.sync.notAvailable')}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('admin.roles.detail.sync.source')}</dt>
              <dd>{role.managedBy}</dd>
            </div>
            {role.syncError?.code ? (
              <div>
                <dt className="text-muted-foreground">{t('admin.roles.detail.sync.errorCode')}</dt>
                <dd>{role.syncError.code}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
        <Card className="space-y-3 p-4 shadow-none">
          <h2 className="text-base font-semibold text-foreground">{t('admin.roles.detail.sync.localChangesTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.roles.detail.sync.localChangesBody')}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t('admin.roles.detail.sync.localChangeItems.permissions')}</li>
            <li>{t('admin.roles.detail.sync.localChangeItems.assignments')}</li>
            <li>{t('admin.roles.detail.sync.localChangeItems.roleLevel')}</li>
          </ul>
          <h3 className="pt-2 text-sm font-semibold text-foreground">{t('admin.roles.detail.sync.actionsTitle')}</h3>
          <p className="text-sm text-muted-foreground">{t('admin.roles.detail.sync.actionsBody')}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={role.managedBy !== 'studio'}
              onClick={() => void rolesApi.retryRoleSync(role.id)}
            >
              {t('admin.roles.actions.retrySync')}
            </Button>
            <Button type="button" variant="outline" onClick={() => void rolesApi.refetch()}>
              {t('admin.roles.actions.retry')}
            </Button>
          </div>
        </Card>
      </section>
    </section>
  );
};
