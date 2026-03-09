import { Link } from '@tanstack/react-router';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ModalDialog } from '../../../components/ModalDialog';
import { useRoles } from '../../../hooks/use-roles';
import { useUsers } from '../../../hooks/use-users';
import { isIamBulkEnabled } from '../../../lib/iam-admin-access';
import { t } from '../../../i18n';
import { userErrorMessage } from './-user-error-message';

type SortKey = 'displayName' | 'email' | 'status' | 'role' | 'lastLoginAt';
type SortDirection = 'asc' | 'desc';

const statusClassByValue: Record<'active' | 'inactive' | 'pending', string> = {
  active: 'border-primary/40 bg-primary/15 text-primary',
  inactive: 'border-destructive/40 bg-destructive/10 text-destructive',
  pending: 'border-secondary/40 bg-secondary/10 text-secondary',
};

const statusTranslationKeyByValue = {
  active: 'account.status.active',
  inactive: 'account.status.inactive',
  pending: 'account.status.pending',
} as const;

const resolveSortValue = (input: {
  displayName: string;
  email?: string;
  status: string;
  roleName?: string;
  lastLoginAt?: string;
}, key: SortKey): string => {
  switch (key) {
    case 'displayName':
      return input.displayName;
    case 'email':
      return input.email ?? '';
    case 'status':
      return input.status;
    case 'role':
      return input.roleName ?? '';
    case 'lastLoginAt':
      return input.lastLoginAt ?? '';
    default:
      return '';
  }
};

export const UserListPage = () => {
  const usersApi = useUsers();
  const rolesApi = useRoles();

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [sortKey, setSortKey] = React.useState<SortKey>('displayName');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [deactivateDialog, setDeactivateDialog] = React.useState<{ mode: 'single' | 'bulk'; userId?: string } | null>(
    null
  );
  const [syncResult, setSyncResult] = React.useState<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
  } | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const [createForm, setCreateForm] = React.useState({
    email: '',
    firstName: '',
    lastName: '',
    roleId: '',
  });

  const sortedUsers = React.useMemo(() => {
    const result = [...usersApi.users];
    result.sort((left, right) => {
      const leftRole = left.roles[0]?.roleName;
      const rightRole = right.roles[0]?.roleName;

      const leftValue = resolveSortValue(
        {
          displayName: left.displayName,
          email: left.email,
          status: left.status,
          roleName: leftRole,
          lastLoginAt: left.lastLoginAt,
        },
        sortKey
      ).toLowerCase();
      const rightValue = resolveSortValue(
        {
          displayName: right.displayName,
          email: right.email,
          status: right.status,
          roleName: rightRole,
          lastLoginAt: right.lastLoginAt,
        },
        sortKey
      ).toLowerCase();

      return sortDirection === 'asc' ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
    });

    return result;
  }, [sortDirection, sortKey, usersApi.users]);

  const onSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDirection('asc');
  };

  const onSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(sortedUsers.slice(0, 50).map((entry) => entry.id));
  };

  const onSelectSingle = (userId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (!checked) {
        return current.filter((entry) => entry !== userId);
      }

      if (current.includes(userId) || current.length >= 50) {
        return current;
      }

      return [...current, userId];
    });
  };

  const onCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const roleIds = createForm.roleId ? [createForm.roleId] : [];
    const result = await usersApi.createUser({
      email: createForm.email.trim(),
      firstName: createForm.firstName.trim() || undefined,
      lastName: createForm.lastName.trim() || undefined,
      displayName: `${createForm.firstName} ${createForm.lastName}`.trim() || undefined,
      roleIds,
    });

    if (!result) {
      return;
    }

    setCreateDialogOpen(false);
    setCreateForm({ email: '', firstName: '', lastName: '', roleId: '' });
  };

  const onConfirmDeactivate = async () => {
    const action = deactivateDialog;
    setDeactivateDialog(null);

    if (!action) {
      return;
    }

    if (action.mode === 'single' && action.userId) {
      await usersApi.deactivateUser(action.userId);
      setSelectedIds((current) => current.filter((entry) => entry !== action.userId));
      return;
    }

    if (action.mode === 'bulk') {
      const success = await usersApi.bulkDeactivate(selectedIds);
      if (success) {
        setSelectedIds([]);
      }
    }
  };

  const onSyncUsers = async () => {
    setIsSyncing(true);
    const result = await usersApi.syncUsersFromKeycloak();
    setIsSyncing(false);
    if (!result) {
      return;
    }

    setSyncResult({
      importedCount: result.importedCount,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
    });
  };

  const pageCount = Math.max(1, Math.ceil(usersApi.total / usersApi.pageSize));

  return (
    <section className="space-y-5" aria-busy={usersApi.isLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.users.page.title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('admin.users.page.subtitle')}</p>
      </header>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-shell lg:grid-cols-[1fr_auto_auto]">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          {t('admin.users.filters.searchLabel')}
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder={t('admin.users.filters.searchPlaceholder')}
            value={usersApi.filters.search}
            onChange={(event) => usersApi.setSearch(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          {t('admin.users.filters.statusLabel')}
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            value={usersApi.filters.status}
            onChange={(event) => usersApi.setStatus(event.target.value as 'active' | 'inactive' | 'pending' | 'all')}
          >
            <option value="all">{t('admin.users.filters.statusAll')}</option>
            <option value="active">{t('admin.users.filters.statusActive')}</option>
            <option value="inactive">{t('admin.users.filters.statusInactive')}</option>
            <option value="pending">{t('admin.users.filters.statusPending')}</option>
          </select>
        </label>
        <div className="flex items-end justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted disabled:opacity-60"
            disabled={isSyncing}
            onClick={() => void onSyncUsers()}
          >
            {isSyncing ? t('admin.users.actions.syncing') : t('admin.users.actions.syncKeycloak')}
          </button>
          {isIamBulkEnabled() ? (
            <button
              type="button"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive disabled:opacity-50"
              disabled={selectedIds.length === 0}
              onClick={() => setDeactivateDialog({ mode: 'bulk' })}
            >
              {t('admin.users.actions.bulkDeactivate')}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-primary/40 bg-primary/15 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
            onClick={() => setCreateDialogOpen(true)}
          >
            {t('admin.users.actions.create')}
          </button>
        </div>
      </div>

      <p role="status" className="text-xs text-muted-foreground">
        {t('admin.users.messages.resultCount', { count: usersApi.total })}
      </p>

      {syncResult ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t('admin.users.messages.syncResult', {
            importedCount: syncResult.importedCount,
            updatedCount: syncResult.updatedCount,
            skippedCount: syncResult.skippedCount,
          })}
        </p>
      ) : null}

      {usersApi.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          <p>{userErrorMessage(usersApi.error)}</p>
          <button
            type="button"
            className="mt-3 rounded-md border border-destructive/40 bg-background px-3 py-2 text-xs text-destructive transition hover:bg-muted"
            onClick={() => void usersApi.refetch()}
          >
            {t('admin.users.actions.retry')}
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-shell">
        <table className="hidden min-w-full border-collapse md:table" aria-label={t('admin.users.table.ariaLabel')}>
          <caption className="sr-only">{t('admin.users.table.caption')}</caption>
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-3">
                <input
                  type="checkbox"
                  aria-label={t('admin.users.table.selectAll')}
                  checked={selectedIds.length > 0 && selectedIds.length === sortedUsers.slice(0, 50).length}
                  onChange={(event) => onSelectAll(event.target.checked)}
                />
              </th>
              <th
                scope="col"
                className="px-3 py-3"
                aria-sort={sortKey === 'displayName' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => onSort('displayName')}
                >
                  {t('admin.users.table.headerName')}
                </button>
              </th>
              <th
                scope="col"
                className="px-3 py-3"
                aria-sort={sortKey === 'email' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => onSort('email')}
                >
                  {t('admin.users.table.headerEmail')}
                </button>
              </th>
              <th
                scope="col"
                className="px-3 py-3"
                aria-sort={sortKey === 'role' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => onSort('role')}
                >
                  {t('admin.users.table.headerRole')}
                </button>
              </th>
              <th
                scope="col"
                className="px-3 py-3"
                aria-sort={sortKey === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => onSort('status')}
                >
                  {t('admin.users.table.headerStatus')}
                </button>
              </th>
              <th
                scope="col"
                className="px-3 py-3"
                aria-sort={sortKey === 'lastLoginAt' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => onSort('lastLoginAt')}
                >
                  {t('admin.users.table.headerLastLogin')}
                </button>
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                {t('admin.users.table.headerActions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => (
              <tr key={user.id} className="border-t border-border text-sm text-foreground">
                <td className="px-3 py-3 align-top">
                  <input
                    type="checkbox"
                    aria-label={t('admin.users.table.selectOne', { name: user.displayName })}
                    checked={selectedIds.includes(user.id)}
                    onChange={(event) => onSelectSingle(user.id, event.target.checked)}
                  />
                </td>
                <td className="px-3 py-3 align-top">{user.displayName}</td>
                <td className="px-3 py-3 align-top">{user.email ?? '-'}</td>
                <td className="px-3 py-3 align-top">{user.roles[0]?.roleName ?? '-'}</td>
                <td className="px-3 py-3 align-top">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${statusClassByValue[user.status]}`}
                  >
                    {t(statusTranslationKeyByValue[user.status])}
                  </span>
                </td>
                <td className="px-3 py-3 align-top">{user.lastLoginAt ?? '-'}</td>
                <td className="px-3 py-3 align-top">
                  <div className="flex justify-end gap-2">
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: user.id }}
                      className="rounded-md border border-border bg-background px-3 py-1 text-xs text-foreground transition hover:bg-muted"
                    >
                      {t('admin.users.actions.edit')}
                    </Link>
                    <button
                      type="button"
                      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive"
                      onClick={() => setDeactivateDialog({ mode: 'single', userId: user.id })}
                    >
                      {t('admin.users.actions.deactivate')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-3 p-3 md:hidden">
          {sortedUsers.map((user) => (
            <article key={user.id} className="rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-shell">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user.email ?? '-'}</p>
                </div>
                <input
                  type="checkbox"
                  aria-label={t('admin.users.table.selectOne', { name: user.displayName })}
                  checked={selectedIds.includes(user.id)}
                  onChange={(event) => onSelectSingle(user.id, event.target.checked)}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded border border-border bg-background px-2 py-1 text-foreground">
                  {user.roles[0]?.roleName ?? '-'}
                </span>
                <span className={`rounded border px-2 py-1 ${statusClassByValue[user.status]}`}>
                  {t(statusTranslationKeyByValue[user.status])}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  to="/admin/users/$userId"
                  params={{ userId: user.id }}
                  className="rounded-md border border-border bg-background px-3 py-1 text-xs text-foreground transition hover:bg-muted"
                >
                  {t('admin.users.actions.edit')}
                </Link>
                <button
                  type="button"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive"
                  onClick={() => setDeactivateDialog({ mode: 'single', userId: user.id })}
                >
                  {t('admin.users.actions.deactivate')}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {!usersApi.isLoading && sortedUsers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-shell" role="status">
          {t('admin.users.messages.emptyState')}
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          {t('admin.users.pagination.pageLabel', { page: usersApi.page, totalPages: pageCount })}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-1 text-foreground transition hover:bg-muted disabled:opacity-40"
            disabled={usersApi.page <= 1}
            onClick={() => usersApi.setPage(usersApi.page - 1)}
          >
            {t('admin.users.pagination.previous')}
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-1 text-foreground transition hover:bg-muted disabled:opacity-40"
            disabled={usersApi.page >= pageCount}
            onClick={() => usersApi.setPage(usersApi.page + 1)}
          >
            {t('admin.users.pagination.next')}
          </button>
        </div>
      </footer>

      <ModalDialog
        open={createDialogOpen}
        title={t('admin.users.createDialog.title')}
        description={t('admin.users.createDialog.description')}
        onClose={() => setCreateDialogOpen(false)}
      >
        <form className="grid gap-4" onSubmit={onCreateUser}>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            <span>{t('account.fields.email')}</span>
            <input
              required
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            <span>{t('account.fields.firstName')}</span>
            <input
              required
              value={createForm.firstName}
              onChange={(event) => setCreateForm((current) => ({ ...current, firstName: event.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            <span>{t('account.fields.lastName')}</span>
            <input
              required
              value={createForm.lastName}
              onChange={(event) => setCreateForm((current) => ({ ...current, lastName: event.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            <span>{t('admin.users.createDialog.roleLabel')}</span>
            <select
              value={createForm.roleId}
              onChange={(event) => setCreateForm((current) => ({ ...current, roleId: event.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            >
              <option value="">{t('admin.users.createDialog.rolePlaceholder')}</option>
              {rolesApi.roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.roleName}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted"
              onClick={() => setCreateDialogOpen(false)}
            >
              {t('account.actions.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-md border border-primary/40 bg-primary/15 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
            >
              {t('admin.users.actions.create')}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={Boolean(deactivateDialog)}
        title={t(
          deactivateDialog?.mode === 'bulk'
            ? 'admin.users.confirm.bulkTitle'
            : 'admin.users.confirm.singleTitle'
        )}
        description={t(
          deactivateDialog?.mode === 'bulk'
            ? 'admin.users.confirm.bulkDescription'
            : 'admin.users.confirm.singleDescription'
        )}
        confirmLabel={t('admin.users.actions.deactivate')}
        cancelLabel={t('account.actions.cancel')}
        onCancel={() => setDeactivateDialog(null)}
        onConfirm={() => void onConfirmDeactivate()}
      />
    </section>
  );
};
