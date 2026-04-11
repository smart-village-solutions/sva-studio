import { Link } from '@tanstack/react-router';
import type { IamAdminGroupDetail } from '@sva/core';

import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useGroups } from '../../../hooks/use-groups';
import { useRoles } from '../../../hooks/use-roles';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';
import type { IamHttpError } from '../../../lib/iam-api';

type SortDirection = 'asc' | 'desc';

const groupErrorMessage = (error: IamHttpError | null, fallbackKey: TranslationKey): string => {
  if (!error) {
    return t(fallbackKey);
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.groups.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.groups.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.groups.errors.rateLimited');
    case 'conflict':
      return t('admin.groups.errors.conflict');
    case 'database_unavailable':
      return t('admin.groups.errors.databaseUnavailable');
    default:
      return t(fallbackKey);
  }
};

const roleCountLabel = (count: number) =>
  count === 1 ? t('admin.groups.labels.roleCountOne') : t('admin.groups.labels.roleCountOther', { count: String(count) });

const memberCountLabel = (count: number) =>
  count === 1
    ? t('admin.groups.labels.memberCountOne')
    : t('admin.groups.labels.memberCountOther', { count: String(count) });

export const GroupsPage = () => {
  const groupsApi = useGroups();
  const rolesApi = useRoles();

  const [search, setSearch] = React.useState('');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');
  const [deleteGroupId, setDeleteGroupId] = React.useState<string | null>(null);
  const [detailByGroupId, setDetailByGroupId] = React.useState<Record<string, IamAdminGroupDetail>>({});

  const roleNameById = React.useMemo(
    () => new Map(rolesApi.roles.map((role) => [role.id, role.roleName])),
    [rolesApi.roles]
  );

  const filteredGroups = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = groupsApi.groups.filter((group) => {
      const detail = detailByGroupId[group.id];
      const roleNames = (detail?.assignedRoleIds ?? []).map((roleId) => roleNameById.get(roleId) ?? roleId);

      if (!query) {
        return true;
      }

      return (
        group.groupKey.toLowerCase().includes(query) ||
        group.displayName.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query) ||
        roleNames.some((roleName) => roleName.toLowerCase().includes(query))
      );
    });

    result.sort((left, right) => {
      const compare = left.displayName.localeCompare(right.displayName);
      return sortDirection === 'asc' ? compare : compare * -1;
    });

    return result;
  }, [detailByGroupId, groupsApi.groups, roleNameById, search, sortDirection]);

  React.useEffect(() => {
    if (groupsApi.groups.length === 0) {
      setDetailByGroupId((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }

    let active = true;
    const missingIds = groupsApi.groups
      .map((group) => group.id)
      .filter((groupId) => detailByGroupId[groupId] === undefined);

    if (missingIds.length === 0) {
      return;
    }

    void Promise.all(
      missingIds.map(async (groupId) => {
        const detail = await groupsApi.loadGroupDetail(groupId);
        return detail ? [groupId, detail] : null;
      })
    ).then((entries) => {
      if (!active) {
        return;
      }

      const nextEntries = entries.filter((entry): entry is [string, IamAdminGroupDetail] => entry !== null);
      if (nextEntries.length === 0) {
        return;
      }

      setDetailByGroupId((current) => {
        const next = { ...current };
        for (const [groupId, detail] of nextEntries) {
          next[groupId] = detail;
        }
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [detailByGroupId, groupsApi.groups, groupsApi.loadGroupDetail]);

  const onDelete = async () => {
    if (!deleteGroupId) {
      return;
    }

    const deleted = await groupsApi.deleteGroup(deleteGroupId);
    if (!deleted) {
      return;
    }

    setDetailByGroupId((current) => {
      const next = { ...current };
      delete next[deleteGroupId];
      return next;
    });
    setDeleteGroupId(null);
  };

  return (
    <section className="space-y-5" aria-busy={groupsApi.isLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.groups.page.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.groups.page.subtitle')}</p>
      </header>

      <Card className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto]" role="search">
        <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="groups-search">{t('admin.groups.filters.searchLabel')}</Label>
          <Input
            id="groups-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.groups.filters.searchPlaceholder')}
          />
        </div>
        <Button type="button" variant="outline" onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}>
          {t('admin.groups.actions.sort')}
        </Button>
        <Button asChild type="button">
          <Link to="/admin/groups/new">{t('admin.groups.actions.create')}</Link>
        </Button>
      </Card>

      {groupsApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{groupErrorMessage(groupsApi.error, 'admin.groups.messages.error')}</span>
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => void groupsApi.refetch()}>
                {t('admin.groups.actions.retry')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-shell">
        <table className="min-w-full border-collapse" aria-label={t('admin.groups.table.ariaLabel')}>
          <caption className="sr-only">{t('admin.groups.table.caption')}</caption>
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th
                scope="col"
                aria-sort={sortDirection === 'asc' ? 'ascending' : 'descending'}
                className="px-3 py-3"
              >
                {t('admin.groups.table.headerName')}
              </th>
              <th scope="col" className="px-3 py-3">
                {t('admin.groups.table.headerType')}
              </th>
              <th scope="col" className="px-3 py-3">
                {t('admin.groups.table.headerRoles')}
              </th>
              <th scope="col" className="px-3 py-3">
                {t('admin.groups.table.headerMemberCount')}
              </th>
              <th scope="col" className="px-3 py-3">
                {t('admin.groups.table.headerStatus')}
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                {t('admin.groups.table.headerActions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group) => {
              const detail = detailByGroupId[group.id];
              const roleLabels = (detail?.assignedRoleIds ?? [])
                .map((roleId) => roleNameById.get(roleId))
                .filter((roleName): roleName is string => Boolean(roleName));

              return (
                <tr key={group.id} className="border-t border-border align-top text-sm text-foreground">
                  <th scope="row" className="px-3 py-3 text-left font-medium">
                    <div className="space-y-1">
                      <div>{group.displayName}</div>
                      <div className="text-xs text-muted-foreground">{group.groupKey}</div>
                      <div className="text-xs text-muted-foreground">
                        {group.description?.trim() || t('admin.groups.labels.noDescription')}
                      </div>
                    </div>
                  </th>
                  <td className="px-3 py-3">{group.groupType}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {roleLabels.length > 0
                        ? roleLabels.map((label) => (
                            <Badge key={`${group.id}-${label}`} variant="outline">
                              {label}
                            </Badge>
                          ))
                        : (
                            <span className="text-muted-foreground">{roleCountLabel(group.roleCount)}</span>
                          )}
                    </div>
                  </td>
                  <td className="px-3 py-3">{memberCountLabel(group.memberCount)}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline">
                      {group.isActive ? t('admin.groups.labels.active') : t('admin.groups.labels.inactive')}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button asChild type="button" size="sm" variant="outline">
                        <Link to="/admin/groups/$groupId" params={{ groupId: group.id }}>
                          {t('admin.groups.actions.edit')}
                        </Link>
                      </Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteGroupId(group.id)}>
                        {t('admin.groups.actions.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!groupsApi.isLoading && filteredGroups.length === 0 ? (
        <Card className="p-5 text-sm text-muted-foreground" role="status">
          {t('admin.groups.messages.emptyState')}
        </Card>
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteGroupId)}
        title={t('admin.groups.confirm.deleteTitle')}
        description={t('admin.groups.confirm.deleteDescription')}
        confirmLabel={t('admin.groups.actions.delete')}
        cancelLabel={t('account.actions.cancel')}
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteGroupId(null)}
      />
    </section>
  );
};
