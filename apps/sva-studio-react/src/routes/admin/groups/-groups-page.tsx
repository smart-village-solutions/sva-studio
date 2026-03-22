import type { IamAdminGroupDetail } from '@sva/core';

import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ModalDialog } from '../../../components/ModalDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { useGroups } from '../../../hooks/use-groups';
import { useRoles } from '../../../hooks/use-roles';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';
import type { IamHttpError } from '../../../lib/iam-api';

type SortDirection = 'asc' | 'desc';

type CreateFormState = {
  groupKey: string;
  displayName: string;
  description: string;
};

type EditFormState = {
  displayName: string;
  description: string;
  roleIds: string[];
  isActive: boolean;
};

type MembershipFormState = {
  keycloakSubject: string;
  validFrom: string;
  validUntil: string;
};

const emptyCreateForm = (): CreateFormState => ({
  groupKey: '',
  displayName: '',
  description: '',
});

const emptyMembershipForm = (): MembershipFormState => ({
  keycloakSubject: '',
  validFrom: '',
  validUntil: '',
});

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

const formatDateTime = (value?: string) => {
  if (!value) {
    return t('admin.groups.labels.noValidity');
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const toIsoDateTime = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
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
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editGroupId, setEditGroupId] = React.useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = React.useState<string | null>(null);
  const [createForm, setCreateForm] = React.useState<CreateFormState>(emptyCreateForm);
  const [editForm, setEditForm] = React.useState<EditFormState>({
    displayName: '',
    description: '',
    roleIds: [],
    isActive: true,
  });
  const [membershipForm, setMembershipForm] = React.useState<MembershipFormState>(emptyMembershipForm);
  const [detailByGroupId, setDetailByGroupId] = React.useState<Record<string, IamAdminGroupDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = React.useState<string | null>(null);

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

  const editGroup = editGroupId ? detailByGroupId[editGroupId] ?? null : null;

  React.useEffect(() => {
    if (groupsApi.groups.length === 0) {
      setDetailByGroupId({});
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

  const refreshGroupDetail = React.useCallback(
    async (groupId: string) => {
      setLoadingDetailId(groupId);
      const detail = await groupsApi.loadGroupDetail(groupId);
      setLoadingDetailId(null);

      if (!detail) {
        return null;
      }

      setDetailByGroupId((current) => ({ ...current, [groupId]: detail }));
      return detail;
    },
    [groupsApi.loadGroupDetail]
  );

  const onOpenEdit = React.useCallback(
    async (groupId: string) => {
      groupsApi.clearMutationError();
      setMembershipForm(emptyMembershipForm());
      const detail = detailByGroupId[groupId] ?? (await refreshGroupDetail(groupId));
      if (!detail) {
        return;
      }

      setEditGroupId(groupId);
      setEditForm({
        displayName: detail.displayName,
        description: detail.description ?? '',
        roleIds: [...detail.assignedRoleIds],
        isActive: detail.isActive,
      });
    },
    [detailByGroupId, groupsApi, refreshGroupDetail]
  );

  const onCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const success = await groupsApi.createGroup({
      groupKey: createForm.groupKey.trim().toLowerCase().replace(/\s+/g, '_'),
      displayName: createForm.displayName.trim(),
      description: createForm.description.trim() || undefined,
    });
    if (!success) {
      return;
    }

    setCreateDialogOpen(false);
    setCreateForm(emptyCreateForm());
  };

  const onEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editGroupId || !editGroup) {
      return;
    }

    const updated = await groupsApi.updateGroup(editGroupId, {
      displayName: editForm.displayName.trim(),
      description: editForm.description.trim() || undefined,
      isActive: editForm.isActive,
    });
    if (!updated) {
      return;
    }

    const currentRoleIds = new Set(editGroup.assignedRoleIds);
    const nextRoleIds = new Set(editForm.roleIds);

    for (const roleId of nextRoleIds) {
      if (!currentRoleIds.has(roleId)) {
        const assigned = await groupsApi.assignRole(editGroupId, roleId);
        if (!assigned) {
          return;
        }
      }
    }

    for (const roleId of currentRoleIds) {
      if (!nextRoleIds.has(roleId)) {
        const removed = await groupsApi.removeRole(editGroupId, roleId);
        if (!removed) {
          return;
        }
      }
    }

    const refreshed = await refreshGroupDetail(editGroupId);
    if (!refreshed) {
      return;
    }

    setEditGroupId(null);
  };

  const onAssignMembership = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editGroupId) {
      return;
    }

    const assigned = await groupsApi.assignMembership(editGroupId, {
      keycloakSubject: membershipForm.keycloakSubject.trim(),
      validFrom: toIsoDateTime(membershipForm.validFrom),
      validUntil: toIsoDateTime(membershipForm.validUntil),
    });
    if (!assigned) {
      return;
    }

    setMembershipForm(emptyMembershipForm());
    await refreshGroupDetail(editGroupId);
  };

  const onRemoveMembership = async (keycloakSubject: string) => {
    if (!editGroupId) {
      return;
    }

    const removed = await groupsApi.removeMembership(editGroupId, keycloakSubject);
    if (!removed) {
      return;
    }

    await refreshGroupDetail(editGroupId);
  };

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
        <Button
          type="button"
          onClick={() => {
            groupsApi.clearMutationError();
            setCreateForm(emptyCreateForm());
            setCreateDialogOpen(true);
          }}
        >
          {t('admin.groups.actions.create')}
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
                      <Button type="button" size="sm" variant="outline" onClick={() => void onOpenEdit(group.id)}>
                        {t('admin.groups.actions.edit')}
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

      <ModalDialog
        open={createDialogOpen}
        title={t('admin.groups.dialogs.createTitle')}
        description={t('admin.groups.dialogs.createDescription')}
        onClose={() => {
          groupsApi.clearMutationError();
          setCreateDialogOpen(false);
        }}
      >
        <form className="grid gap-4" onSubmit={onCreate}>
          {groupsApi.mutationError ? (
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertDescription>{groupErrorMessage(groupsApi.mutationError, 'admin.groups.messages.error')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-group-key">{t('admin.groups.dialogs.keyLabel')}</Label>
            <Input
              id="create-group-key"
              required
              value={createForm.groupKey}
              onChange={(event) => setCreateForm((current) => ({ ...current, groupKey: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-group-name">{t('admin.groups.dialogs.displayNameLabel')}</Label>
            <Input
              id="create-group-name"
              required
              value={createForm.displayName}
              onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))}
            />
          </div>
          <div className="grid gap-2 text-sm text-foreground">
            <Label htmlFor="create-group-description">{t('admin.groups.dialogs.descriptionLabel')}</Label>
            <Textarea
              id="create-group-description"
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t('account.actions.cancel')}
            </Button>
            <Button type="submit">{t('admin.groups.actions.create')}</Button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog
        open={Boolean(editGroupId)}
        title={t('admin.groups.dialogs.editTitle')}
        description={editGroup ? t('admin.groups.dialogs.editDescription', { groupKey: editGroup.groupKey }) : undefined}
        onClose={() => {
          groupsApi.clearMutationError();
          setEditGroupId(null);
          setMembershipForm(emptyMembershipForm());
        }}
      >
        {loadingDetailId === editGroupId ? (
          <p className="text-sm text-muted-foreground">{t('admin.groups.messages.loading')}</p>
        ) : editGroup ? (
          <div className="space-y-6">
            <form className="grid gap-4" onSubmit={onEdit}>
              {groupsApi.mutationError ? (
                <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                  <AlertDescription>{groupErrorMessage(groupsApi.mutationError, 'admin.groups.messages.error')}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-2 text-sm text-foreground">
                <Label htmlFor="edit-group-name">{t('admin.groups.dialogs.displayNameLabel')}</Label>
                <Input
                  id="edit-group-name"
                  required
                  value={editForm.displayName}
                  onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))}
                />
              </div>
              <div className="grid gap-2 text-sm text-foreground">
                <Label htmlFor="edit-group-description">{t('admin.groups.dialogs.descriptionLabel')}</Label>
                <Textarea
                  id="edit-group-description"
                  value={editForm.description}
                  onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <fieldset className="grid gap-2 text-sm text-foreground">
                <legend>{t('admin.groups.dialogs.rolesLabel')}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {rolesApi.roles.map((role) => {
                    const checked = editForm.roleIds.includes(role.id);
                    return (
                      <Label key={role.id} className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2">
                        <Checkbox
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              roleIds: event.target.checked
                                ? [...current.roleIds, role.id]
                                : current.roleIds.filter((entry) => entry !== role.id),
                            }))
                          }
                        />
                        <span>{role.roleName}</span>
                      </Label>
                    );
                  })}
                </div>
              </fieldset>
              <Label className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
                <Checkbox
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) => setEditForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                <span>{t('admin.groups.labels.active')}</span>
              </Label>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setEditGroupId(null)}>
                  {t('account.actions.cancel')}
                </Button>
                <Button type="submit">{t('admin.groups.actions.save')}</Button>
              </div>
            </form>

            <section className="space-y-3">
              <header className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">{t('admin.groups.memberships.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('admin.groups.memberships.subtitle')}</p>
              </header>
              <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={onAssignMembership}>
                <div className="grid gap-2 text-sm text-foreground">
                  <Label htmlFor="group-membership-subject">{t('admin.groups.memberships.subjectLabel')}</Label>
                  <Input
                    id="group-membership-subject"
                    required
                    value={membershipForm.keycloakSubject}
                    onChange={(event) =>
                      setMembershipForm((current) => ({ ...current, keycloakSubject: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2 text-sm text-foreground">
                  <Label htmlFor="group-membership-valid-from">{t('admin.groups.memberships.validFromLabel')}</Label>
                  <Input
                    id="group-membership-valid-from"
                    type="datetime-local"
                    value={membershipForm.validFrom}
                    onChange={(event) => setMembershipForm((current) => ({ ...current, validFrom: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2 text-sm text-foreground">
                  <Label htmlFor="group-membership-valid-until">{t('admin.groups.memberships.validUntilLabel')}</Label>
                  <Input
                    id="group-membership-valid-until"
                    type="datetime-local"
                    value={membershipForm.validUntil}
                    onChange={(event) => setMembershipForm((current) => ({ ...current, validUntil: event.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit">{t('admin.groups.memberships.assign')}</Button>
                </div>
              </form>

              <div className="overflow-x-auto rounded-xl border border-border bg-background">
                <table className="min-w-full border-collapse" aria-label={t('admin.groups.memberships.tableAriaLabel')}>
                  <caption className="sr-only">{t('admin.groups.memberships.caption')}</caption>
                  <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-3">
                        {t('admin.groups.memberships.tableSubject')}
                      </th>
                      <th scope="col" className="px-3 py-3">
                        {t('admin.groups.memberships.tableValidity')}
                      </th>
                      <th scope="col" className="px-3 py-3">
                        {t('admin.groups.memberships.tableOrigin')}
                      </th>
                      <th scope="col" className="px-3 py-3 text-right">
                        {t('admin.groups.memberships.tableActions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {editGroup.memberships.length > 0 ? (
                      editGroup.memberships.map((membership) => (
                        <tr key={`${membership.groupId}-${membership.accountId}`} className="border-t border-border text-sm text-foreground">
                          <th scope="row" className="px-3 py-3 text-left font-medium">
                            <div className="space-y-1">
                              <div>{membership.displayName ?? membership.keycloakSubject}</div>
                              <div className="text-xs text-muted-foreground">{membership.keycloakSubject}</div>
                            </div>
                          </th>
                          <td className="px-3 py-3">
                            {membership.validFrom || membership.validUntil
                              ? t('admin.groups.memberships.validityRange', {
                                  from: formatDateTime(membership.validFrom),
                                  to: formatDateTime(membership.validUntil),
                                })
                              : t('admin.groups.labels.noValidity')}
                          </td>
                          <td className="px-3 py-3">
                            {membership.assignedByAccountId
                              ? t('admin.groups.memberships.originManual', {
                                  accountId: membership.assignedByAccountId,
                                })
                              : t('admin.groups.memberships.originUnknown')}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void onRemoveMembership(membership.keycloakSubject)}
                              >
                                {t('admin.groups.memberships.remove')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-border text-sm text-muted-foreground">
                        <td colSpan={4} className="px-3 py-4">
                          {t('admin.groups.memberships.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}
      </ModalDialog>

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
