import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ModalDialog } from '../../../components/ModalDialog';
import { useRoles } from '../../../hooks/use-roles';
import { t } from '../../../i18n';

type SortDirection = 'asc' | 'desc';

const statusTone = (syncState: 'synced' | 'pending' | 'failed'): string => {
  if (syncState === 'synced') {
    return 'border-emerald-600/40 bg-emerald-500/10 text-emerald-100';
  }
  if (syncState === 'failed') {
    return 'border-red-600/40 bg-red-500/10 text-red-100';
  }
  return 'border-amber-600/40 bg-amber-500/10 text-amber-100';
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
        <h1 className="text-3xl font-semibold text-slate-100">{t('admin.roles.page.title')}</h1>
        <p className="max-w-2xl text-sm text-slate-300">{t('admin.roles.page.subtitle')}</p>
      </header>

      <div className="grid gap-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4 lg:grid-cols-[1fr_auto_auto_auto]">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-300">
          {t('admin.roles.filters.searchLabel')}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.roles.filters.searchPlaceholder')}
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <button
          type="button"
          className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-100"
          onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
        >
          {t('admin.roles.actions.sort')}
        </button>
        <button
          type="button"
          className="rounded-md border border-sky-700 bg-sky-500/20 px-3 py-2 text-sm font-semibold text-sky-100"
          onClick={() => void rolesApi.reconcile()}
        >
          {t('admin.roles.actions.reconcile')}
        </button>
        <button
          type="button"
          className="rounded-md border border-emerald-700 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-100"
          onClick={openCreateDialog}
        >
          {t('admin.roles.actions.create')}
        </button>
      </div>

      {rolesApi.reconcileReport ? (
        <div className="rounded-xl border border-sky-600/40 bg-sky-500/10 p-4 text-sm text-sky-100" role="status">
          {t('admin.roles.messages.reconcileSummary', {
            checked: String(rolesApi.reconcileReport.checkedCount),
            corrected: String(rolesApi.reconcileReport.correctedCount),
            failed: String(rolesApi.reconcileReport.failedCount),
            manual: String(rolesApi.reconcileReport.requiresManualActionCount),
          })}
        </div>
      ) : null}

      {rolesApi.error ? (
        <div className="rounded-xl border border-red-600/40 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
          <p>{rolesApi.error.message || t('admin.roles.messages.error')}</p>
          <button
            type="button"
            className="mt-3 rounded-md border border-red-500/60 px-3 py-2 text-xs"
            onClick={() => void rolesApi.refetch()}
          >
            {t('admin.roles.actions.retry')}
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full border-collapse" aria-label={t('admin.roles.table.ariaLabel')}>
          <caption className="sr-only">{t('admin.roles.table.caption')}</caption>
          <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-300">
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
                  <tr className="border-t border-slate-700 text-sm text-slate-100">
                    <td className="px-3 py-3 align-top">
                      <button
                        type="button"
                        className="inline-flex items-start gap-2 text-left"
                        aria-expanded={expanded}
                        aria-controls={`role-permissions-${role.id}`}
                        onClick={() => toggleExpanded(role.id)}
                      >
                        <span aria-hidden="true">{expanded ? '-' : '+'}</span>
                        <span>
                          <span className="block font-semibold">{role.roleName}</span>
                          <span className="block text-xs text-slate-400">{role.roleKey}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {roleTypeLabel(role)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(role.syncState)}`}
                        aria-label={`${t('admin.roles.table.headerSync')}: ${statusLabel(role.syncState)}`}
                      >
                        {statusLabel(role.syncState)}
                      </span>
                      {role.syncError ? (
                        <p className="mt-2 text-xs text-red-200" role="status">
                          {t('admin.roles.messages.syncErrorCode', { code: role.syncError.code })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p>{role.description ?? '-'}</p>
                      {role.lastSyncedAt ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {t('admin.roles.messages.lastSyncedAt', { value: role.lastSyncedAt })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">{role.memberCount}</td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-100 disabled:opacity-50"
                          disabled={isReadOnly}
                          onClick={() => onOpenEdit(role.id)}
                        >
                          {t('admin.roles.actions.edit')}
                        </button>
                        {role.syncState === 'failed' ? (
                          <button
                            type="button"
                            className="rounded-md border border-amber-600 px-3 py-1 text-xs text-amber-100 disabled:opacity-50"
                            disabled={role.managedBy !== 'studio'}
                            onClick={() => void rolesApi.retryRoleSync(role.id)}
                          >
                            {t('admin.roles.actions.retrySync')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded-md border border-red-700 px-3 py-1 text-xs text-red-100 disabled:opacity-50"
                          disabled={isReadOnly}
                          onClick={() => setDeleteRoleId(role.id)}
                        >
                          {t('admin.roles.actions.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr id={`role-permissions-${role.id}`} hidden={!expanded} className="border-t border-slate-800 bg-slate-900/20">
                    <td colSpan={6} className="space-y-3 px-4 py-3">
                      {role.permissions.length > 0 ? (
                        <ul className="grid gap-2 text-xs text-slate-200 sm:grid-cols-2 lg:grid-cols-3">
                          {role.permissions.map((permission) => (
                            <li key={permission.id} className="rounded border border-slate-700 bg-slate-950/60 px-3 py-2">
                              <p className="font-semibold">{permission.permissionKey}</p>
                              {permission.description ? (
                                <p className="mt-1 text-slate-400">{permission.description}</p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">{t('admin.roles.messages.permissionsEmpty')}</p>
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
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-5 text-sm text-slate-300" role="status">
          {t('admin.roles.messages.emptyState')}
        </div>
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
            <div className="rounded-md border border-red-600/40 bg-red-500/10 p-3 text-sm text-red-100" role="alert">
              {rolesApi.mutationError.message || t('admin.roles.messages.error')}
            </div>
          ) : null}
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span>{t('admin.roles.createDialog.keyLabel')}</span>
            <input
              required
              value={createForm.roleKey}
              onChange={(event) => setCreateForm((current) => ({ ...current, roleKey: event.target.value }))}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span>{t('admin.roles.createDialog.nameLabel')}</span>
            <input
              value={createForm.displayName}
              onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span>{t('admin.roles.createDialog.descriptionLabel')}</span>
            <textarea
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-[100px] rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span>{t('admin.roles.createDialog.levelLabel')}</span>
            <input
              required
              type="number"
              min={0}
              max={100}
              value={createForm.roleLevel}
              onChange={(event) => setCreateForm((current) => ({ ...current, roleLevel: event.target.value }))}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm"
              onClick={() => {
                rolesApi.clearMutationError();
                setCreateDialogOpen(false);
              }}
            >
              {t('account.actions.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-md border border-emerald-700 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-100"
            >
              {t('admin.roles.actions.create')}
            </button>
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
            <div className="rounded-md border border-red-600/40 bg-red-500/10 p-3 text-sm text-red-100" role="alert">
              {rolesApi.mutationError.message || t('admin.roles.messages.error')}
            </div>
          ) : null}
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span>{t('admin.roles.editDialog.keyLabel')}</span>
            <input
              value={editRole?.roleKey ?? ''}
              disabled
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-400"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span>{t('admin.roles.editDialog.nameLabel')}</span>
            <input
              required
              value={editForm.displayName}
              onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span>{t('admin.roles.editDialog.descriptionLabel')}</span>
            <textarea
              value={editForm.description}
              onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-[100px] rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span>{t('admin.roles.editDialog.levelLabel')}</span>
            <input
              required
              type="number"
              min={0}
              max={100}
              value={editForm.roleLevel}
              onChange={(event) => setEditForm((current) => ({ ...current, roleLevel: event.target.value }))}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2"
            />
          </label>

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-2 text-sm"
              onClick={() => {
                rolesApi.clearMutationError();
                setEditRoleId(null);
              }}
            >
              {t('account.actions.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-md border border-sky-700 bg-sky-500/20 px-3 py-2 text-sm font-semibold text-sky-100"
            >
              {t('admin.roles.actions.edit')}
            </button>
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
