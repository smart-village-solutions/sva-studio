import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ModalDialog } from '../../../components/ModalDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { useRoles } from '../../../hooks/use-roles';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';
import type { IamHttpError } from '../../../lib/iam-api';

type SortDirection = 'asc' | 'desc';

const statusTone = (syncState: 'synced' | 'pending' | 'failed'): string => {
  if (syncState === 'synced') {
    return 'border-primary/40 bg-primary/10 text-primary';
  }
  if (syncState === 'failed') {
    return 'border-destructive/40 bg-destructive/10 text-destructive';
  }
  return 'border-secondary/40 bg-secondary/10 text-secondary';
};

const STATUS_LABEL_KEYS = {
  synced: 'admin.roles.sync.synced',
  pending: 'admin.roles.sync.pending',
  failed: 'admin.roles.sync.failed',
} as const;

const statusLabel = (syncState: 'synced' | 'pending' | 'failed'): string => t(STATUS_LABEL_KEYS[syncState]);

const roleTypeLabel = (role: { isSystemRole: boolean; managedBy: 'studio' | 'external' }): string => {
  if (role.isSystemRole) {
    return t('admin.roles.labels.systemRole');
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

export const RolesPage = () => {
  const rolesApi = useRoles();

  const [search, setSearch] = React.useState('');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');
  const [expandedRoleIds, setExpandedRoleIds] = React.useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editRoleId, setEditRoleId] = React.useState<string | null>(null);
  const [deleteRoleId, setDeleteRoleId] = React.useState<string | null>(null);

  const [createForm, setCreateForm] = React.useState({
    roleKey: '',
    displayName: '',
    description: '',
    roleLevel: '10',
  });
  const [editForm, setEditForm] = React.useState({
    displayName: '',
    description: '',
    roleLevel: '10',
  });

  const filteredRoles = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = rolesApi.roles.filter((role) => {
      if (!query) {
        return true;
      }

      return (
        role.roleName.toLowerCase().includes(query) ||
        role.roleKey.toLowerCase().includes(query) ||
        role.description?.toLowerCase().includes(query) ||
        role.permissions.some((permission) => permission.permissionKey.toLowerCase().includes(query))
      );
    });

    result.sort((left, right) => {
      const compare = left.roleName.localeCompare(right.roleName);
      return sortDirection === 'asc' ? compare : compare * -1;
    });

    return result;
  }, [rolesApi.roles, search, sortDirection]);

  const editRole = React.useMemo(
    () => rolesApi.roles.find((role) => role.id === editRoleId) ?? null,
    [editRoleId, rolesApi.roles]
  );

  const toggleExpanded = (roleId: string) => {
    setExpandedRoleIds((current) =>
      current.includes(roleId) ? current.filter((entry) => entry !== roleId) : [...current, roleId]
    );
  };

  const onCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const roleKey = createForm.roleKey.trim().toLowerCase().replace(/\s+/g, '_');
    const success = await rolesApi.createRole({
      roleName: roleKey,
      displayName: createForm.displayName.trim() || undefined,
      description: createForm.description.trim() || undefined,
      roleLevel: Number(createForm.roleLevel),
      permissionIds: [],
    });

    if (!success) {
      return;
    }

    setCreateDialogOpen(false);
    setCreateForm({ roleKey: '', displayName: '', description: '', roleLevel: '10' });
  };

  const openCreateDialog = () => {
    rolesApi.clearMutationError();
    setCreateDialogOpen(true);
  };

  const onOpenEdit = (roleId: string) => {
    const role = rolesApi.roles.find((entry) => entry.id === roleId);
    if (!role) {
      return;
    }
    rolesApi.clearMutationError();
    setEditRoleId(roleId);
    setEditForm({
      displayName: role.roleName,
      description: role.description ?? '',
      roleLevel: String(role.roleLevel),
    });
  };

  const onEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editRoleId) {
      return;
    }

    const success = await rolesApi.updateRole(editRoleId, {
      displayName: editForm.displayName.trim(),
      description: editForm.description.trim() || undefined,
      roleLevel: Number(editForm.roleLevel),
    });
    if (!success) {
      return;
    }

    setEditRoleId(null);
  };

  return (
    <section className="space-y-5" aria-busy={rolesApi.isLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.roles.page.title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('admin.roles.page.subtitle')}</p>
      </header>

      <Card className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="roles-search">{t('admin.roles.filters.searchLabel')}</Label>
          <Input
            id="roles-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.roles.filters.searchPlaceholder')}
          />
        </div>
        <Button type="button" variant="outline" onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}>
          {t('admin.roles.actions.sort')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void rolesApi.reconcile()}>
          {t('admin.roles.actions.reconcile')}
        </Button>
        <Button type="button" onClick={openCreateDialog}>
          {t('admin.roles.actions.create')}
        </Button>
      </Card>

      {rolesApi.reconcileReport ? (
        <Alert className="border-secondary/40 bg-secondary/10 text-secondary" role="status">
          <AlertDescription>{t('admin.roles.messages.reconcileSummary', {
            checked: String(rolesApi.reconcileReport.checkedCount),
            corrected: String(rolesApi.reconcileReport.correctedCount),
            failed: String(rolesApi.reconcileReport.failedCount),
            manual: String(rolesApi.reconcileReport.requiresManualActionCount),
          })}</AlertDescription>
        </Alert>
      ) : null}

      {rolesApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{roleErrorMessage(rolesApi.error, 'admin.roles.messages.error')}</span>
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => void rolesApi.refetch()}>
                {t('admin.roles.actions.retry')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-shell">
        <table className="min-w-full border-collapse" aria-label={t('admin.roles.table.ariaLabel')}>
          <caption className="sr-only">{t('admin.roles.table.caption')}</caption>
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-3">
                {t('admin.roles.table.headerName')}
              </th>
              <th scope="col" className="px-3 py-3">
                {t('admin.roles.table.headerType')}
              </th>
              <th scope="col" className="px-3 py-3">
                {t('admin.roles.table.headerSync')}
              </th>
              <th scope="col" className="px-3 py-3">
                {t('admin.roles.table.headerDescription')}
              </th>
              <th scope="col" className="px-3 py-3">
                {t('admin.roles.table.headerUserCount')}
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                {t('admin.roles.table.headerActions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRoles.map((role) => {
              const expanded = expandedRoleIds.includes(role.id);
              const isReadOnly = role.isSystemRole || role.managedBy !== 'studio';

              return (
                <React.Fragment key={role.id}>
                  <tr className="border-t border-border text-sm text-foreground">
                    <td className="px-3 py-3 align-top">
                      <Button
                        type="button"
                        className="h-auto items-start justify-start gap-2 px-0 py-0 text-left hover:bg-transparent"
                        aria-expanded={expanded}
                        aria-controls={`role-permissions-${role.id}`}
                        onClick={() => toggleExpanded(role.id)}
                        variant="ghost"
                      >
                        <span aria-hidden="true">{expanded ? '-' : '+'}</span>
                        <span>
                          <span className="block font-semibold">{role.roleName}</span>
                          <span className="block text-xs text-muted-foreground">{role.roleKey}</span>
                        </span>
                      </Button>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {roleTypeLabel(role)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <Badge
                        className={`rounded-full ${statusTone(role.syncState)}`}
                        aria-label={`${t('admin.roles.table.headerSync')}: ${statusLabel(role.syncState)}`}
                        variant="outline"
                      >
                        {statusLabel(role.syncState)}
                      </Badge>
                      {role.syncError ? (
                        <p className="mt-2 text-xs text-destructive" role="status">
                          {t('admin.roles.messages.syncErrorCode', { code: role.syncError.code })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p>{role.description ?? t('admin.roles.messages.noDescription')}</p>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p>{t('admin.roles.messages.externalRoleName', { value: role.externalRoleName })}</p>
                        <p>{t('admin.roles.messages.managedBy', { value: role.managedBy })}</p>
                        <p>{t('admin.roles.messages.roleLevel', { value: role.roleLevel })}</p>
                      </div>
                      {role.lastSyncedAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('admin.roles.messages.lastSyncedAt', { value: role.lastSyncedAt })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">{role.memberCount}</td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isReadOnly}
                          onClick={() => onOpenEdit(role.id)}
                        >
                          {t('admin.roles.actions.edit')}
                        </Button>
                        {role.syncState === 'failed' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={role.managedBy !== 'studio'}
                            onClick={() => void rolesApi.retryRoleSync(role.id)}
                          >
                            {t('admin.roles.actions.retrySync')}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isReadOnly}
                          onClick={() => setDeleteRoleId(role.id)}
                        >
                          {t('admin.roles.actions.delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  <tr id={`role-permissions-${role.id}`} hidden={!expanded} className="border-t border-border bg-muted/50">
                    <td colSpan={6} className="space-y-3 px-4 py-3">
                      {role.permissions.length > 0 ? (
                        <ul className="grid gap-2 text-xs text-foreground sm:grid-cols-2 lg:grid-cols-3">
                          {role.permissions.map((permission) => (
                            <li key={permission.id} className="rounded border border-border bg-background px-3 py-2">
                              <p className="font-semibold">{permission.permissionKey}</p>
                              {permission.description ? (
                                <p className="mt-1 text-muted-foreground">{permission.description}</p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t('admin.roles.messages.permissionsEmpty')}</p>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {!rolesApi.isLoading && filteredRoles.length === 0 ? (
        <Card className="p-5 text-sm text-muted-foreground" role="status">
          {t('admin.roles.messages.emptyState')}
        </Card>
      ) : null}

      <ModalDialog
        open={createDialogOpen}
        title={t('admin.roles.createDialog.title')}
        description={t('admin.roles.createDialog.description')}
        onClose={() => {
          rolesApi.clearMutationError();
          setCreateDialogOpen(false);
        }}
      >
        <form className="grid gap-4" onSubmit={onCreate}>
          {rolesApi.mutationError ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{roleErrorMessage(rolesApi.mutationError, 'admin.roles.messages.error')}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-role-key">{t('admin.roles.createDialog.keyLabel')}</Label>
            <Input
              id="create-role-key"
              required
              value={createForm.roleKey}
              onChange={(event) => setCreateForm((current) => ({ ...current, roleKey: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-role-name">{t('admin.roles.createDialog.nameLabel')}</Label>
            <Input
              id="create-role-name"
              value={createForm.displayName}
              onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-role-description">{t('admin.roles.createDialog.descriptionLabel')}</Label>
            <Textarea
              id="create-role-description"
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-role-level">{t('admin.roles.createDialog.levelLabel')}</Label>
            <Input
              id="create-role-level"
              required
              type="number"
              min={0}
              max={100}
              value={createForm.roleLevel}
              onChange={(event) => setCreateForm((current) => ({ ...current, roleLevel: event.target.value }))}
            />
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                rolesApi.clearMutationError();
                setCreateDialogOpen(false);
              }}
            >
              {t('account.actions.cancel')}
            </Button>
            <Button type="submit">
              {t('admin.roles.actions.create')}
            </Button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog
        open={Boolean(editRole)}
        title={t('admin.roles.editDialog.title')}
        description={editRole ? t('admin.roles.editDialog.description', { roleKey: editRole.roleKey }) : ''}
        onClose={() => {
          rolesApi.clearMutationError();
          setEditRoleId(null);
        }}
      >
        <form className="grid gap-4" onSubmit={onEdit}>
          {rolesApi.mutationError ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{roleErrorMessage(rolesApi.mutationError, 'admin.roles.messages.error')}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="edit-role-key">{t('admin.roles.editDialog.keyLabel')}</Label>
            <Input
              id="edit-role-key"
              value={editRole?.roleKey ?? ''}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="edit-role-name">{t('admin.roles.editDialog.nameLabel')}</Label>
            <Input
              id="edit-role-name"
              required
              value={editForm.displayName}
              onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="edit-role-description">{t('admin.roles.editDialog.descriptionLabel')}</Label>
            <Textarea
              id="edit-role-description"
              value={editForm.description}
              onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="edit-role-level">{t('admin.roles.editDialog.levelLabel')}</Label>
            <Input
              id="edit-role-level"
              required
              type="number"
              min={0}
              max={100}
              value={editForm.roleLevel}
              onChange={(event) => setEditForm((current) => ({ ...current, roleLevel: event.target.value }))}
            />
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                rolesApi.clearMutationError();
                setEditRoleId(null);
              }}
            >
              {t('account.actions.cancel')}
            </Button>
            <Button type="submit" variant="secondary">
              {t('admin.roles.actions.edit')}
            </Button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={Boolean(deleteRoleId)}
        title={t('admin.roles.confirm.deleteTitle')}
        description={t('admin.roles.confirm.deleteDescription')}
        confirmLabel={t('admin.roles.actions.delete')}
        cancelLabel={t('account.actions.cancel')}
        onCancel={() => setDeleteRoleId(null)}
        onConfirm={() => {
          const roleId = deleteRoleId;
          setDeleteRoleId(null);
          if (roleId) {
            void rolesApi.deleteRole(roleId);
          }
        }}
      />
    </section>
  );
};
