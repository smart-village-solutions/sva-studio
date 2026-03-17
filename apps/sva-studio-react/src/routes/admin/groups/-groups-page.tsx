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

const groupStatusLabel = (isActive: boolean) =>
  isActive ? t('admin.groups.labels.active') : t('admin.groups.labels.inactive');

export const GroupsPage = () => {
  const groupsApi = useGroups();
  const rolesApi = useRoles();

  const [search, setSearch] = React.useState('');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editGroupId, setEditGroupId] = React.useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = React.useState<string | null>(null);
  const [createForm, setCreateForm] = React.useState({
    groupKey: '',
    displayName: '',
    description: '',
    roleIds: [] as string[],
  });
  const [editForm, setEditForm] = React.useState({
    displayName: '',
    description: '',
    roleIds: [] as string[],
    isActive: true,
  });

  const filteredGroups = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = groupsApi.groups.filter((group) => {
      if (!query) {
        return true;
      }

      return (
        group.groupKey.toLowerCase().includes(query) ||
        group.displayName.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query) ||
        group.roles.some((role) => role.roleName.toLowerCase().includes(query) || role.roleKey.toLowerCase().includes(query))
      );
    });

    result.sort((left, right) => {
      const compare = left.displayName.localeCompare(right.displayName);
      return sortDirection === 'asc' ? compare : compare * -1;
    });
    return result;
  }, [groupsApi.groups, search, sortDirection]);

  const editGroup = React.useMemo(
    () => groupsApi.groups.find((group) => group.id === editGroupId) ?? null,
    [editGroupId, groupsApi.groups]
  );

  const toggleRoleId = (currentRoleIds: readonly string[], roleId: string, checked: boolean) => {
    return checked ? [...currentRoleIds, roleId] : currentRoleIds.filter((entry) => entry !== roleId);
  };

  const onCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const success = await groupsApi.createGroup({
      groupKey: createForm.groupKey.trim().toLowerCase().replace(/\s+/g, '_'),
      displayName: createForm.displayName.trim(),
      description: createForm.description.trim() || undefined,
      roleIds: createForm.roleIds,
    });
    if (!success) {
      return;
    }

    setCreateDialogOpen(false);
    setCreateForm({ groupKey: '', displayName: '', description: '', roleIds: [] });
  };

  const onOpenEdit = (groupId: string) => {
    const group = groupsApi.groups.find((entry) => entry.id === groupId);
    if (!group) {
      return;
    }
    groupsApi.clearMutationError();
    setEditGroupId(groupId);
    setEditForm({
      displayName: group.displayName,
      description: group.description ?? '',
      roleIds: group.roles.map((role) => role.roleId),
      isActive: group.isActive,
    });
  };

  const onEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editGroupId) {
      return;
    }

    const success = await groupsApi.updateGroup(editGroupId, {
      displayName: editForm.displayName.trim(),
      description: editForm.description.trim() || undefined,
      roleIds: editForm.roleIds,
      isActive: editForm.isActive,
    });
    if (!success) {
      return;
    }

    setEditGroupId(null);
  };

  return (
    <section className="space-y-5" aria-busy={groupsApi.isLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.groups.page.title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('admin.groups.page.subtitle')}</p>
      </header>

      <Card className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto]">
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
              <th scope="col" className="px-3 py-3">{t('admin.groups.table.headerName')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.groups.table.headerType')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.groups.table.headerRoles')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.groups.table.headerMemberCount')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.groups.table.headerStatus')}</th>
              <th scope="col" className="px-3 py-3 text-right">{t('admin.groups.table.headerActions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group) => (
              <tr key={group.id} className="border-t border-border align-top">
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{group.displayName}</div>
                    <div className="text-xs text-muted-foreground">{group.groupKey}</div>
                    <div className="text-xs text-muted-foreground">
                      {group.description?.trim() || t('admin.groups.labels.noDescription')}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-foreground">{t('admin.groups.labels.roleBundle')}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    {group.roles.length > 0 ? (
                      group.roles.map((role) => (
                        <Badge key={role.roleId} variant="outline">
                          {role.roleName}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">{t('admin.groups.labels.noRoles')}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-foreground">{group.memberCount}</td>
                <td className="px-3 py-3">
                  <Badge variant="outline">{groupStatusLabel(group.isActive)}</Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => onOpenEdit(group.id)}>
                      {t('admin.groups.actions.edit')}
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteGroupId(group.id)}>
                      {t('admin.groups.actions.delete')}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
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
          <fieldset className="grid gap-2 text-sm text-foreground">
            <legend>{t('admin.groups.dialogs.rolesLabel')}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {rolesApi.roles.map((role) => {
                const checked = createForm.roleIds.includes(role.id);
                return (
                  <Label key={role.id} className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2">
                    <Checkbox
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          roleIds: toggleRoleId(current.roleIds, role.id, event.target.checked),
                        }))
                      }
                    />
                    <span>{role.roleName}</span>
                  </Label>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t('account.actions.cancel')}
            </Button>
            <Button type="submit">{t('admin.groups.actions.create')}</Button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog
        open={Boolean(editGroup)}
        title={t('admin.groups.dialogs.editTitle')}
        description={editGroup ? t('admin.groups.dialogs.editDescription', { groupKey: editGroup.groupKey }) : ''}
        onClose={() => {
          groupsApi.clearMutationError();
          setEditGroupId(null);
        }}
      >
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
                          roleIds: toggleRoleId(current.roleIds, role.id, event.target.checked),
                        }))
                      }
                    />
                    <span>{role.roleName}</span>
                  </Label>
                );
              })}
            </div>
          </fieldset>
          <Label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              type="checkbox"
              checked={editForm.isActive}
              onChange={(event) => setEditForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            <span>{t('admin.groups.labels.active')}</span>
          </Label>
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEditGroupId(null)}>
              {t('account.actions.cancel')}
            </Button>
            <Button type="submit" variant="secondary">
              {t('admin.groups.actions.edit')}
            </Button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={Boolean(deleteGroupId)}
        title={t('admin.groups.confirm.deleteTitle')}
        description={t('admin.groups.confirm.deleteDescription')}
        confirmLabel={t('admin.groups.actions.delete')}
        cancelLabel={t('account.actions.cancel')}
        onCancel={() => setDeleteGroupId(null)}
        onConfirm={() => {
          const groupId = deleteGroupId;
          setDeleteGroupId(null);
          if (groupId) {
            void groupsApi.deleteGroup(groupId);
          }
        }}
      />
    </section>
  );
};
