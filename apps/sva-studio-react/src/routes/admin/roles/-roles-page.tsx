import React from 'react';
import { Link } from '@tanstack/react-router';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ModalDialog } from '../../../components/ModalDialog';
import { StudioDataTable, type StudioColumnDef } from '../../../components/StudioDataTable';
import { StudioListPageTemplate } from '../../../components/StudioListPageTemplate';
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
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [deleteRoleId, setDeleteRoleId] = React.useState<string | null>(null);

  const [createForm, setCreateForm] = React.useState({
    roleKey: '',
    displayName: '',
    description: '',
    roleLevel: '10',
  });

  const filteredRoles = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return rolesApi.roles.filter((role) => {
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
  }, [rolesApi.roles, search]);

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

  const roleColumns = React.useMemo<readonly StudioColumnDef<(typeof filteredRoles)[number]>[]>(
    () => [
      {
        id: 'roleName',
        header: t('admin.roles.table.headerName'),
        cell: (role) => (
          <div>
            <span className="block font-semibold">{role.roleName}</span>
            <span className="block text-xs text-muted-foreground">{role.roleKey}</span>
          </div>
        ),
        sortable: true,
        sortValue: (role) => role.roleName.toLowerCase(),
      },
      {
        id: 'type',
        header: t('admin.roles.table.headerType'),
        cell: (role) => roleTypeLabel(role),
      },
      {
        id: 'sync',
        header: t('admin.roles.table.headerSync'),
        cell: (role) => (
          <div>
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
          </div>
        ),
      },
      {
        id: 'description',
        header: t('admin.roles.table.headerDescription'),
        cell: (role) => (
          <div>
            <p>{role.description ?? t('admin.roles.messages.noDescription')}</p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>{t('admin.roles.messages.externalRoleName', { value: role.externalRoleName })}</p>
              <p>{t('admin.roles.messages.managedBy', { value: role.managedBy })}</p>
              <p>{t('admin.roles.messages.roleLevel', { value: role.roleLevel })}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'permissions',
        header: t('admin.roles.table.headerPermissions'),
        cell: (role) => String(role.permissions.length),
        sortable: true,
        sortValue: (role) => role.permissions.length,
      },
      {
        id: 'memberCount',
        header: t('admin.roles.table.headerUserCount'),
        cell: (role) => String(role.memberCount),
        sortable: true,
        sortValue: (role) => role.memberCount,
      },
    ],
    [filteredRoles]
  );

  return (
    <section className="space-y-5" aria-busy={rolesApi.isLoading}>
      <StudioListPageTemplate
        title={t('admin.roles.page.title')}
        description={t('admin.roles.page.subtitle')}
        primaryAction={{
          label: t('admin.roles.actions.create'),
          onClick: openCreateDialog,
        }}
      >
        <StudioDataTable
          ariaLabel={t('admin.roles.table.ariaLabel')}
          caption={t('admin.roles.table.caption')}
          data={filteredRoles}
          columns={roleColumns}
          getRowId={(role) => role.id}
          selectionMode="none"
          isLoading={rolesApi.isLoading}
          loadingState={t('content.messages.loading')}
          emptyState={
            <Card className="border-none p-0 text-sm text-muted-foreground shadow-none" role="status">
              {t('admin.roles.messages.emptyState')}
            </Card>
          }
          toolbarStart={
            <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Label htmlFor="roles-search">{t('admin.roles.filters.searchLabel')}</Label>
              <Input
                id="roles-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('admin.roles.filters.searchPlaceholder')}
              />
            </div>
          }
          toolbarEnd={
            <Button type="button" variant="secondary" onClick={() => void rolesApi.reconcile()}>
              {t('admin.roles.actions.reconcile')}
            </Button>
          }
          rowActions={(role) => {
            const isReadOnly = role.isSystemRole || role.managedBy !== 'studio';

            return (
              <>
                <Button asChild type="button" size="sm" variant="outline">
                  <Link to="/admin/roles/$roleId" params={{ roleId: role.id }}>
                    {t('admin.roles.actions.edit')}
                  </Link>
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
              </>
            );
          }}
        />
      </StudioListPageTemplate>

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
            <Button type="submit">{t('admin.roles.actions.create')}</Button>
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
