import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  StudioDataTable,
  StudioDetailPageTemplate,
  type StudioColumnDef,
} from '@sva/studio-ui-react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { createStudioDataTableLabels } from '../../../components/studio-data-table-labels';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { useRolePermissions } from '../../../hooks/use-role-permissions';
import { useRoles } from '../../../hooks/use-roles';
import { useUsers } from '../../../hooks/use-users';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';
import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import { roleErrorMessage, roleStatusLabel, roleTypeLabel } from './-roles-shared';

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
  media: 'admin.roles.permissionResources.media',
  news: 'admin.roles.permissionResources.news',
  events: 'admin.roles.permissionResources.events',
  poi: 'admin.roles.permissionResources.poi',
  'waste-management': 'admin.roles.permissionResources.wasteManagement',
} as const;

const ROLE_TAB_LABELS: Record<RoleDetailTab, TranslationKey> = {
  general: 'admin.roles.detail.tabs.general',
  permissions: 'admin.roles.detail.tabs.permissions',
  assignments: 'admin.roles.detail.tabs.assignments',
  sync: 'admin.roles.detail.tabs.sync',
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

type RolePermissionTableRow = Readonly<{
  id: string;
  permissionKey: string;
  description: string;
  resourceLabel: string;
  actionLabel: string;
  detailLabel: string;
  isAssigned: boolean;
}>;

const normalizePermissionSearch = (value: string) => value.trim().toLowerCase();

const DetailMetaItem = ({
  label,
  value,
}: Readonly<{
  label: string;
  value: React.ReactNode;
}>) => (
  <div className="space-y-1">
    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="text-sm font-medium text-foreground">{value}</dd>
  </div>
);

export const sortPermissionIdsByCatalog = (
  permissionIds: readonly string[],
  catalog: readonly { id: string; permissionKey: string }[]
) => {
  const permissionKeyById = new Map(catalog.map((permission) => [permission.id, permission.permissionKey] as const));

  return [...permissionIds].sort((left, right) => {
    const leftKey = permissionKeyById.get(left) ?? left;
    const rightKey = permissionKeyById.get(right) ?? right;
    return leftKey.localeCompare(rightKey);
  });
};

export const RoleDetailPage = ({ roleId, activeTab }: RoleDetailPageProps) => {
  const rolesApi = useRoles();
  const permissionsApi = useRolePermissions();
  const usersApi = useUsers({ page: 1, pageSize: 100 });
  const navigate = useNavigate();
  const studioDataTableLabels = createStudioDataTableLabels();
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
  const [permissionSearch, setPermissionSearch] = React.useState('');

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

  const permissionTableRows = React.useMemo<readonly RolePermissionTableRow[]>(
    () =>
      permissionsApi.permissions.map((permission) => {
        const summary = summarizePermission(permission.permissionKey);
        return {
          id: permission.id,
          permissionKey: permission.permissionKey,
          description:
            permission.description?.trim() || t('admin.roles.detail.permissions.permissionDescriptionFallback'),
          resourceLabel: summary.resourceLabel,
          actionLabel: summary.actionLabel,
          detailLabel: summary.detailLabel,
          isAssigned: permissionDraft.includes(permission.id),
        };
      }),
    [permissionDraft, permissionsApi.permissions]
  );

  const filteredPermissionTableRows = React.useMemo(() => {
    const normalizedSearch = normalizePermissionSearch(permissionSearch);
    if (!normalizedSearch) {
      return permissionTableRows;
    }

    return permissionTableRows.filter((permission) =>
      [
        permission.resourceLabel,
        permission.actionLabel,
        permission.detailLabel,
        permission.permissionKey,
        permission.description,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [permissionSearch, permissionTableRows]);

  const permissionTableColumns = React.useMemo<readonly StudioColumnDef<RolePermissionTableRow>[]>(
    () => [
      {
        id: 'assignedToggle',
        header: t('admin.roles.detail.permissions.table.columns.assignment'),
        cell: (permission) => (
          <Label className="flex items-center gap-3">
            <Checkbox
              type="checkbox"
              checked={permission.isAssigned}
              disabled={isReadOnly}
              aria-label={t('admin.roles.detail.permissions.toggleAssignment', {
                permission: permission.detailLabel,
              })}
              onChange={() => togglePermissionDraft(permission.id)}
            />
            <span className="text-sm text-foreground">
              {permission.isAssigned
                ? t('admin.roles.detail.permissions.assigned')
                : t('admin.roles.detail.permissions.notAssigned')}
            </span>
          </Label>
        ),
        sortable: true,
        sortValue: (permission) => (permission.isAssigned ? '0' : '1'),
        className: 'align-middle',
      },
      {
        id: 'detail',
        header: t('admin.roles.detail.permissions.table.columns.permission'),
        cell: (permission) => (
          <div className="space-y-1">
            <span className="block font-medium text-foreground">{permission.detailLabel}</span>
            <span className="block text-xs text-muted-foreground">{permission.description}</span>
          </div>
        ),
        sortable: true,
        sortValue: (permission) => permission.detailLabel.toLowerCase(),
      },
      {
        id: 'resource',
        header: t('admin.roles.detail.permissions.table.columns.resource'),
        cell: (permission) => permission.resourceLabel,
        sortable: true,
        sortValue: (permission) => permission.resourceLabel.toLowerCase(),
      },
      {
        id: 'action',
        header: t('admin.roles.detail.permissions.table.columns.action'),
        cell: (permission) => permission.actionLabel,
        sortable: true,
        sortValue: (permission) => permission.actionLabel.toLowerCase(),
      },
      ...(showTechnicalDetails
        ? ([
            {
              id: 'technical',
              header: t('admin.roles.detail.permissions.table.columns.technicalKey'),
              cell: (permission) => (
                <code className="rounded bg-muted px-2 py-1 text-xs text-foreground">{permission.permissionKey}</code>
              ),
              sortable: true,
              sortValue: (permission) => permission.permissionKey.toLowerCase(),
              className: 'align-middle',
            },
          ] satisfies readonly StudioColumnDef<RolePermissionTableRow>[])
        : []),
    ],
    [isReadOnly, showTechnicalDetails]
  );

  const assignAllPermissions = React.useCallback(() => {
    setPermissionDraft(sortPermissionIdsByCatalog(permissionsApi.permissions.map((permission) => permission.id), permissionsApi.permissions));
  }, [permissionsApi.permissions]);

  const removeAllPermissions = React.useCallback(() => {
    setPermissionDraft([]);
  }, []);

  const applyPermissionBulkAssignment = React.useCallback(
    (permissionIds: readonly string[], nextAssigned: boolean) => {
      setPermissionDraft((current) => {
        const nextIds = nextAssigned
          ? [...new Set([...current, ...permissionIds])]
          : current.filter((permissionId) => !permissionIds.includes(permissionId));

        return sortPermissionIdsByCatalog(nextIds, permissionsApi.permissions);
      });
    },
    [permissionsApi.permissions]
  );

  const assignVisiblePermissions = React.useCallback(() => {
    applyPermissionBulkAssignment(
      filteredPermissionTableRows.map((permission) => permission.id),
      true
    );
  }, [applyPermissionBulkAssignment, filteredPermissionTableRows]);

  const removeVisiblePermissions = React.useCallback(() => {
    applyPermissionBulkAssignment(
      filteredPermissionTableRows.map((permission) => permission.id),
      false
    );
  }, [applyPermissionBulkAssignment, filteredPermissionTableRows]);

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
            <span>
              {roleErrorMessage(rolesApi.error, 'admin.roles.messages.error', {
                includeKeycloakReconcileError: true,
                includeRecoveryRunningError: true,
              })}
            </span>
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
    <StudioDetailPageTemplate
      title={role.roleName}
      description={t('admin.roles.detail.subtitle')}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline" size="sm">
            <Link to="/admin/roles">{t('admin.roles.detail.backToList')}</Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/admin/iam" search={{ tab: 'rights' }}>
              {t('admin.roles.workspace.openIamCta')}
            </Link>
          </Button>
        </div>
      }
      className="aria-busy:opacity-100"
    >
      <section className="space-y-5" aria-busy={rolesApi.isLoading || isSavingMeta || isSavingPermissions}>
        {rolesApi.mutationError ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription className="flex flex-col gap-3">
              <span>
                {roleErrorMessage(rolesApi.mutationError, 'admin.roles.messages.error', {
                  includeKeycloakReconcileError: true,
                  includeRecoveryRunningError: true,
                })}
              </span>
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

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-lg font-semibold leading-none tracking-tight text-foreground">{role.roleName}</p>
                <CardDescription>{role.description?.trim() || t('admin.roles.detail.subtitle')}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{roleTypeLabel(role)}</Badge>
                <Badge variant="outline">{roleStatusLabel(role.syncState)}</Badge>
                <Badge variant="outline">{t('admin.roles.detail.badges.permissionCount', { count: String(role.permissions.length) })}</Badge>
                <Badge variant="outline">{t('admin.roles.detail.badges.assignmentCount', { count: String(role.memberCount) })}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <DetailMetaItem label={t('admin.roles.editDialog.keyLabel')} value={<code>{role.roleKey}</code>} />
              <DetailMetaItem
                label={t('admin.roles.detail.general.externalRoleName')}
                value={<code>{role.externalRoleName}</code>}
              />
              <DetailMetaItem label={t('admin.roles.detail.sync.source')} value={role.managedBy} />
              <DetailMetaItem label={t('admin.roles.editDialog.levelLabel')} value={String(role.roleLevel)} />
            </dl>
          </CardContent>
        </Card>

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

        <section
          id="role-detail-panel-general"
          role="tabpanel"
          aria-labelledby="role-detail-tab-general"
          hidden={activeTab !== 'general'}
          className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"
        >
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.roles.detail.tabs.general')}</CardTitle>
              <CardDescription>{t('admin.roles.detail.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={onSaveGeneral}>
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
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isReadOnly}
                    onClick={() => {
                      setEditForm({
                        displayName: role.roleName,
                        description: role.description ?? '',
                        roleLevel: String(role.roleLevel),
                      });
                    }}
                  >
                    {t('admin.roles.detail.general.reset')}
                  </Button>
                  <Button type="submit" disabled={isReadOnly || isSavingMeta}>
                    {isSavingMeta ? t('admin.roles.detail.general.saving') : t('admin.roles.detail.general.save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.roles.detail.tabs.sync')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <DetailMetaItem label={t('admin.roles.detail.tabs.sync')} value={roleStatusLabel(role.syncState)} />
                <DetailMetaItem label={t('admin.roles.detail.assignments.managedBy')} value={role.managedBy} />
                <DetailMetaItem
                  label={t('admin.roles.detail.sync.lastSyncedAt')}
                  value={role.lastSyncedAt ?? t('admin.roles.detail.sync.notAvailable')}
                />
              </dl>
            </CardContent>
          </Card>
        </section>

        <section
        id="role-detail-panel-permissions"
        role="tabpanel"
        aria-labelledby="role-detail-tab-permissions"
        hidden={activeTab !== 'permissions'}
        className="space-y-4"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.roles.workspace.editPermissionsTitle')}</CardTitle>
              <CardDescription>{t('admin.roles.detail.permissions.subtitle')}</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('admin.roles.workspace.sideTitle')}</CardTitle>
              <CardDescription>{t('admin.roles.workspace.sideSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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
            </CardContent>
          </Card>
        </div>

        {permissionsApi.error ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{t('admin.roles.workspace.permissionsLoadError')}</AlertDescription>
          </Alert>
        ) : permissionsApi.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('admin.roles.workspace.permissionsLoading')}</p>
        ) : (
          <StudioDataTable
            ariaLabel={t('admin.roles.detail.permissions.table.ariaLabel')}
            labels={studioDataTableLabels}
            caption={t('admin.roles.detail.permissions.table.caption')}
            data={filteredPermissionTableRows}
            columns={permissionTableColumns}
            getRowId={(permission) => permission.id}
            selectionMode="none"
            emptyState={
              <Card className="border-none p-0 text-sm text-muted-foreground shadow-none" role="status">
                {t('admin.roles.detail.permissions.table.empty')}
              </Card>
            }
            toolbarStart={
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[16rem] flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                  <Label htmlFor="role-permissions-search">{t('admin.roles.detail.permissions.filters.searchLabel')}</Label>
                  <Input
                    id="role-permissions-search"
                    value={permissionSearch}
                    onChange={(event) => setPermissionSearch(event.target.value)}
                    placeholder={t('admin.roles.detail.permissions.filters.searchPlaceholder')}
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">
                    {t('admin.roles.detail.permissions.summary.visibleCount', {
                      count: String(filteredPermissionTableRows.length),
                    })}
                  </Badge>
                  <Badge variant="outline">
                    {t('admin.roles.detail.permissions.summary.assignedCount', {
                      count: String(permissionDraft.length),
                    })}
                  </Badge>
                </div>
              </div>
            }
            toolbarEnd={
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={isReadOnly} onClick={assignVisiblePermissions}>
                  {t('admin.roles.detail.permissions.bulk.assignVisible')}
                </Button>
                <Button type="button" variant="outline" disabled={isReadOnly} onClick={removeVisiblePermissions}>
                  {t('admin.roles.detail.permissions.bulk.removeVisible')}
                </Button>
                <Button type="button" variant="outline" disabled={isReadOnly} onClick={assignAllPermissions}>
                  {t('admin.roles.detail.permissions.bulk.assignAll')}
                </Button>
                <Button type="button" variant="outline" disabled={isReadOnly} onClick={removeAllPermissions}>
                  {t('admin.roles.detail.permissions.bulk.removeAll')}
                </Button>
              </div>
            }
          />
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
        className="grid gap-4 md:grid-cols-2"
      >
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.roles.detail.assignments.summaryTitle')}</CardTitle>
            <CardDescription>{t('admin.roles.detail.assignments.summaryBody')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-4">
              <DetailMetaItem
                label={t('admin.roles.workspace.assignmentCountLabel')}
                value={t('admin.roles.workspace.assignmentCountValue', { count: String(role.memberCount) })}
              />
              <DetailMetaItem label={t('admin.roles.detail.assignments.managedBy')} value={role.managedBy} />
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{t('admin.roles.detail.assignments.managementTitle')}</CardTitle>
                <CardDescription>{t('admin.roles.detail.assignments.managementBody')}</CardDescription>
              </div>
              <Button asChild type="button" variant="outline">
                <Link to="/admin/users">{t('admin.roles.detail.assignments.openUsers')}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

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
          </CardContent>
        </Card>
        </section>

        <section
        id="role-detail-panel-sync"
        role="tabpanel"
        aria-labelledby="role-detail-tab-sync"
        hidden={activeTab !== 'sync'}
        className="grid gap-4 md:grid-cols-2"
      >
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.roles.detail.sync.title')}</CardTitle>
            <CardDescription>{t('admin.roles.detail.sync.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-secondary/40 bg-secondary/5 text-secondary">
              <AlertDescription>
                {role.managedBy === 'studio'
                  ? t('admin.roles.detail.sync.metadataOnlyHint')
                  : t('admin.roles.detail.sync.externalHint')}
              </AlertDescription>
            </Alert>
            <dl className="grid gap-4">
              <DetailMetaItem label={t('admin.roles.detail.sync.metadataStatus')} value={roleStatusLabel(role.syncState)} />
              <DetailMetaItem
                label={t('admin.roles.detail.sync.lastSyncedAt')}
                value={role.lastSyncedAt ?? t('admin.roles.detail.sync.notAvailable')}
              />
              <DetailMetaItem label={t('admin.roles.detail.sync.source')} value={role.managedBy} />
              {role.syncError?.code ? (
                <DetailMetaItem label={t('admin.roles.detail.sync.errorCode')} value={role.syncError.code} />
              ) : null}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.roles.detail.sync.localChangesTitle')}</CardTitle>
            <CardDescription>{t('admin.roles.detail.sync.localChangesBody')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t('admin.roles.detail.sync.localChangeItems.permissions')}</li>
              <li>{t('admin.roles.detail.sync.localChangeItems.assignments')}</li>
              <li>{t('admin.roles.detail.sync.localChangeItems.roleLevel')}</li>
            </ul>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t('admin.roles.detail.sync.actionsTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('admin.roles.detail.sync.actionsBody')}</p>
            </div>
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
          </CardContent>
        </Card>
        </section>
      </section>
    </StudioDetailPageTemplate>
  );
};
