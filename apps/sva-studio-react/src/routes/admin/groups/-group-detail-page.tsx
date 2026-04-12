import { Link } from '@tanstack/react-router';
import type { IamAdminGroupDetail } from '@sva/core';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
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

type GroupDetailPageProps = {
  readonly groupId: string;
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

export const GroupDetailPage = ({ groupId }: GroupDetailPageProps) => {
  const groupsApi = useGroups();
  const rolesApi = useRoles();
  const {
    isLoading,
    mutationError,
    loadGroupDetail,
    updateGroup,
    assignRole,
    removeRole,
    assignMembership,
    removeMembership,
    deleteGroup,
  } = groupsApi;
  const [group, setGroup] = React.useState<IamAdminGroupDetail | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [formValues, setFormValues] = React.useState<EditFormState>({
    displayName: '',
    description: '',
    roleIds: [],
    isActive: true,
  });
  const [membershipForm, setMembershipForm] = React.useState<MembershipFormState>(emptyMembershipForm);

  const loadDetail = React.useCallback(async () => {
    const detail = await loadGroupDetail(groupId);
    if (!detail) {
      return null;
    }

    setGroup(detail);
    setFormValues({
      displayName: detail.displayName,
      description: detail.description ?? '',
      roleIds: [...detail.assignedRoleIds],
      isActive: detail.isActive,
    });
    return detail;
  }, [groupId, loadGroupDetail]);

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const onEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!group) {
      return;
    }

    const updated = await updateGroup(groupId, {
      displayName: formValues.displayName.trim(),
      description: formValues.description.trim() || undefined,
      isActive: formValues.isActive,
    });
    if (!updated) {
      return;
    }

    const currentRoleIds = new Set(group.assignedRoleIds);
    const nextRoleIds = new Set(formValues.roleIds);

    for (const roleId of nextRoleIds) {
      if (!currentRoleIds.has(roleId)) {
        const assigned = await assignRole(groupId, roleId);
        if (!assigned) {
          return;
        }
      }
    }

    for (const roleId of currentRoleIds) {
      if (!nextRoleIds.has(roleId)) {
        const removed = await removeRole(groupId, roleId);
        if (!removed) {
          return;
        }
      }
    }

    await loadDetail();
  };

  const onAssignMembership = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const assigned = await assignMembership(groupId, {
      keycloakSubject: membershipForm.keycloakSubject.trim(),
      validFrom: toIsoDateTime(membershipForm.validFrom),
      validUntil: toIsoDateTime(membershipForm.validUntil),
    });
    if (!assigned) {
      return;
    }

    setMembershipForm(emptyMembershipForm());
    await loadDetail();
  };

  const onRemoveMembership = async (keycloakSubject: string) => {
    const removed = await removeMembership(groupId, keycloakSubject);
    if (!removed) {
      return;
    }

    await loadDetail();
  };

  const onDelete = async () => {
    const deleted = await deleteGroup(groupId);
    if (deleted) {
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <section className="space-y-5" aria-busy={isLoading}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{group?.displayName ?? t('admin.groups.dialogs.editTitle')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {group ? t('admin.groups.dialogs.editDescription', { groupKey: group.groupKey }) : t('admin.groups.messages.loading')}
          </p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/groups">{t('admin.groups.detail.backToList')}</Link>
        </Button>
      </header>

      {!group && !isLoading ? (
        <Card className="p-5 text-sm text-muted-foreground" role="status">
          {t('admin.groups.detail.notFound')}
        </Card>
      ) : null}

      {group ? (
        <>
          <Card className="space-y-4 p-4">
            <form className="grid gap-4" onSubmit={onEdit}>
              <div className="grid gap-2 text-sm text-foreground">
                <Label htmlFor="edit-group-name">{t('admin.groups.dialogs.displayNameLabel')}</Label>
                <Input
                  id="edit-group-name"
                  required
                  value={formValues.displayName}
                  onChange={(event) => setFormValues((current) => ({ ...current, displayName: event.target.value }))}
                />
              </div>
              <div className="grid gap-2 text-sm text-foreground">
                <Label htmlFor="edit-group-description">{t('admin.groups.dialogs.descriptionLabel')}</Label>
                <Textarea
                  id="edit-group-description"
                  value={formValues.description}
                  onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <fieldset className="grid gap-2 text-sm text-foreground">
                <legend>{t('admin.groups.dialogs.rolesLabel')}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {rolesApi.roles.map((role) => {
                    const checked = formValues.roleIds.includes(role.id);
                    return (
                      <Label key={role.id} className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2">
                        <Checkbox
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setFormValues((current) => ({
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
                  checked={formValues.isActive}
                  onChange={(event) => setFormValues((current) => ({ ...current, isActive: event.target.checked }))}
                />
                <span>{t('admin.groups.labels.active')}</span>
              </Label>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
                  {t('admin.groups.actions.delete')}
                </Button>
                <Button type="submit">{t('admin.groups.actions.save')}</Button>
              </div>
            </form>
          </Card>

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
                    <th scope="col" className="px-3 py-3">{t('admin.groups.memberships.tableSubject')}</th>
                    <th scope="col" className="px-3 py-3">{t('admin.groups.memberships.tableValidity')}</th>
                    <th scope="col" className="px-3 py-3">{t('admin.groups.memberships.tableOrigin')}</th>
                    <th scope="col" className="px-3 py-3 text-right">{t('admin.groups.memberships.tableActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.memberships.length > 0 ? (
                    group.memberships.map((membership) => (
                      <tr key={`${membership.groupId}-${membership.accountId}`} className="border-t border-border text-sm text-foreground">
                        <th scope="row" className="px-3 py-3 text-left font-medium">
                          <div className="space-y-1">
                            <div>{membership.displayName ?? (membership.keycloakSubject || membership.accountId)}</div>
                            <div className="text-xs text-muted-foreground">{membership.keycloakSubject || membership.accountId}</div>
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
                              disabled={!membership.keycloakSubject}
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
        </>
      ) : null}

      {mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{groupErrorMessage(mutationError, 'admin.groups.messages.error')}</AlertDescription>
        </Alert>
      ) : null}

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t('admin.groups.confirm.deleteTitle')}
        description={t('admin.groups.confirm.deleteDescription')}
        confirmLabel={t('admin.groups.actions.delete')}
        cancelLabel={t('account.actions.cancel')}
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </section>
  );
};
