import type { IamOrganizationType } from '@sva/core';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ModalDialog } from '../../../components/ModalDialog';
import { useOrganizations } from '../../../hooks/use-organizations';
import { useUsers } from '../../../hooks/use-users';
import { t, type TranslationKey } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

const ORGANIZATION_TYPE_KEYS = {
  county: 'admin.organizations.types.county',
  municipality: 'admin.organizations.types.municipality',
  district: 'admin.organizations.types.district',
  company: 'admin.organizations.types.company',
  agency: 'admin.organizations.types.agency',
  other: 'admin.organizations.types.other',
} satisfies Record<IamOrganizationType, TranslationKey>;

const organizationErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('admin.organizations.messages.error');
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.organizations.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.organizations.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.organizations.errors.rateLimited');
    case 'conflict':
      return t('admin.organizations.errors.conflict');
    case 'invalid_organization_id':
      return t('admin.organizations.errors.invalidOrganization');
    case 'organization_inactive':
      return t('admin.organizations.errors.organizationInactive');
    case 'database_unavailable':
      return t('admin.organizations.errors.databaseUnavailable');
    default:
      return t('admin.organizations.messages.error');
  }
};

const typeOptions = Object.keys(ORGANIZATION_TYPE_KEYS) as IamOrganizationType[];

type EditState = { mode: 'create' } | { mode: 'edit'; organizationId: string } | null;

export const OrganizationsPage = () => {
  const organizationsApi = useOrganizations();
  const usersApi = useUsers({ pageSize: 100 });

  const [editState, setEditState] = React.useState<EditState>(null);
  const [membershipOrganizationId, setMembershipOrganizationId] = React.useState<string | null>(null);
  const [deactivateOrganizationId, setDeactivateOrganizationId] = React.useState<string | null>(null);
  const [membershipForm, setMembershipForm] = React.useState({
    accountId: '',
    visibility: 'internal' as 'internal' | 'external',
    isDefaultContext: false,
  });
  const [formValues, setFormValues] = React.useState({
    organizationKey: '',
    displayName: '',
    organizationType: 'other' as IamOrganizationType,
    parentOrganizationId: '',
    contentAuthorPolicy: 'org_only' as 'org_only' | 'org_or_personal',
  });

  const pageCount = Math.max(1, Math.ceil(organizationsApi.total / organizationsApi.pageSize));

  const openCreateDialog = () => {
    organizationsApi.clearMutationError();
    setFormValues({
      organizationKey: '',
      displayName: '',
      organizationType: 'other',
      parentOrganizationId: '',
      contentAuthorPolicy: 'org_only',
    });
    setEditState({ mode: 'create' });
  };

  const openEditDialog = async (organizationId: string) => {
    organizationsApi.clearMutationError();
    const detail = await organizationsApi.loadOrganization(organizationId);
    if (!detail) {
      return;
    }
    setFormValues({
      organizationKey: detail.organizationKey,
      displayName: detail.displayName,
      organizationType: detail.organizationType,
      parentOrganizationId: detail.parentOrganizationId ?? '',
      contentAuthorPolicy: detail.contentAuthorPolicy,
    });
    setEditState({ mode: 'edit', organizationId });
  };

  const openMembershipDialog = async (organizationId: string) => {
    organizationsApi.clearMutationError();
    const detail = await organizationsApi.loadOrganization(organizationId);
    if (!detail) {
      return;
    }
    setMembershipForm({ accountId: '', visibility: 'internal', isDefaultContext: false });
    setMembershipOrganizationId(organizationId);
  };

  const onSubmitOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      organizationKey: formValues.organizationKey.trim(),
      displayName: formValues.displayName.trim(),
      organizationType: formValues.organizationType,
      parentOrganizationId: formValues.parentOrganizationId || undefined,
      contentAuthorPolicy: formValues.contentAuthorPolicy,
    };

    const success =
      editState?.mode === 'edit'
        ? await organizationsApi.updateOrganization(editState.organizationId, payload)
        : await organizationsApi.createOrganization(payload);

    if (!success) {
      return;
    }

    setEditState(null);
  };

  const onAssignMembership = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!membershipOrganizationId) {
      return;
    }

    const success = await organizationsApi.assignMembership(membershipOrganizationId, {
      accountId: membershipForm.accountId,
      visibility: membershipForm.visibility,
      isDefaultContext: membershipForm.isDefaultContext,
    });
    if (!success) {
      return;
    }

    setMembershipForm({ accountId: '', visibility: 'internal', isDefaultContext: false });
  };

  const onConfirmDeactivate = async () => {
    if (!deactivateOrganizationId) {
      return;
    }
    const success = await organizationsApi.deactivateOrganization(deactivateOrganizationId);
    if (success) {
      setDeactivateOrganizationId(null);
    }
  };

  const selectedOrganization =
    membershipOrganizationId && organizationsApi.selectedOrganization?.id === membershipOrganizationId
      ? organizationsApi.selectedOrganization
      : null;

  return (
    <section className="space-y-5" aria-busy={organizationsApi.isLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-100">{t('admin.organizations.page.title')}</h1>
        <p className="max-w-2xl text-sm text-slate-300">{t('admin.organizations.page.subtitle')}</p>
      </header>

      <div className="grid gap-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4 lg:grid-cols-[1fr_auto_auto_auto]">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-300">
          {t('admin.organizations.filters.searchLabel')}
          <input
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder={t('admin.organizations.filters.searchPlaceholder')}
            value={organizationsApi.filters.search}
            onChange={(event) => organizationsApi.setSearch(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-300">
          {t('admin.organizations.filters.typeLabel')}
          <select
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={organizationsApi.filters.organizationType}
            onChange={(event) =>
              organizationsApi.setOrganizationType(event.target.value as typeof organizationsApi.filters.organizationType)
            }
          >
            <option value="all">{t('admin.organizations.filters.typeAll')}</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {t(ORGANIZATION_TYPE_KEYS[type])}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-300">
          {t('admin.organizations.filters.statusLabel')}
          <select
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={organizationsApi.filters.status}
            onChange={(event) => organizationsApi.setStatus(event.target.value as 'active' | 'inactive' | 'all')}
          >
            <option value="all">{t('admin.organizations.filters.statusAll')}</option>
            <option value="active">{t('admin.organizations.filters.statusActive')}</option>
            <option value="inactive">{t('admin.organizations.filters.statusInactive')}</option>
          </select>
        </label>
        <div className="flex items-end justify-end">
          <button
            type="button"
            className="rounded-md border border-emerald-700 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-100"
            onClick={openCreateDialog}
          >
            {t('admin.organizations.actions.create')}
          </button>
        </div>
      </div>

      <p role="status" aria-live="polite" className="text-xs text-slate-400">
        {t('admin.organizations.messages.resultCount', { count: organizationsApi.total })}
      </p>

      {organizationsApi.error ? (
        <div className="rounded-xl border border-red-600/40 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
          <p>{organizationErrorMessage(organizationsApi.error)}</p>
          <button
            type="button"
            className="mt-3 rounded-md border border-red-500/60 px-3 py-2 text-xs"
            onClick={() => void organizationsApi.refetch()}
          >
            {t('admin.organizations.actions.retry')}
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full border-collapse" aria-label={t('admin.organizations.table.ariaLabel')}>
          <caption className="sr-only">{t('admin.organizations.table.caption')}</caption>
          <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-300">
            <tr>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerName')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerType')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerParent')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerChildren')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerMembers')}</th>
              <th scope="col" className="px-3 py-3">{t('admin.organizations.table.headerStatus')}</th>
              <th scope="col" className="px-3 py-3 text-right">{t('admin.organizations.table.headerActions')}</th>
            </tr>
          </thead>
          <tbody>
            {organizationsApi.organizations.map((organization) => (
              <tr key={organization.id} className="border-t border-slate-800/70 bg-slate-950/20 text-sm text-slate-100">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2" style={{ paddingLeft: `${organization.depth * 12}px` }}>
                    <span className="font-medium">{organization.displayName}</span>
                    <span className="text-xs text-slate-400">{organization.organizationKey}</span>
                  </div>
                </td>
                <td className="px-3 py-3">{t(ORGANIZATION_TYPE_KEYS[organization.organizationType])}</td>
                <td className="px-3 py-3">{organization.parentDisplayName ?? t('admin.organizations.messages.root')}</td>
                <td className="px-3 py-3">{organization.childCount}</td>
                <td className="px-3 py-3">{organization.membershipCount}</td>
                <td className="px-3 py-3">
                  {organization.isActive
                    ? t('admin.organizations.filters.statusActive')
                    : t('admin.organizations.filters.statusInactive')}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-600 px-3 py-2 text-xs text-slate-100"
                      onClick={() => void openEditDialog(organization.id)}
                    >
                      {t('admin.organizations.actions.edit')}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-sky-700 bg-sky-500/10 px-3 py-2 text-xs text-sky-100"
                      onClick={() => void openMembershipDialog(organization.id)}
                    >
                      {t('admin.organizations.actions.memberships')}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-red-700 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                      onClick={() => setDeactivateOrganizationId(organization.id)}
                      disabled={!organization.isActive}
                    >
                      {t('admin.organizations.actions.deactivate')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {organizationsApi.organizations.length === 0 && !organizationsApi.isLoading ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-6 text-sm text-slate-300">
          {t('admin.organizations.messages.emptyState')}
        </div>
      ) : null}

      <nav aria-label={t('admin.organizations.pagination.ariaLabel')} className="flex items-center justify-between text-sm text-slate-300">
        <p aria-live="polite">{t('admin.organizations.pagination.pageLabel', { page: organizationsApi.page, totalPages: pageCount })}</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-2 disabled:opacity-50"
            disabled={organizationsApi.page <= 1}
            onClick={() => organizationsApi.setPage(organizationsApi.page - 1)}
          >
            {t('admin.organizations.pagination.previous')}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-2 disabled:opacity-50"
            disabled={organizationsApi.page >= pageCount}
            onClick={() => organizationsApi.setPage(organizationsApi.page + 1)}
          >
            {t('admin.organizations.pagination.next')}
          </button>
        </div>
      </nav>

      <ModalDialog
        open={editState !== null}
        onClose={() => setEditState(null)}
        title={editState?.mode === 'edit' ? t('admin.organizations.editDialog.title') : t('admin.organizations.createDialog.title')}
        description={
          editState?.mode === 'edit'
            ? t('admin.organizations.editDialog.description')
            : t('admin.organizations.createDialog.description')
        }
      >
        <form className="space-y-4" onSubmit={(event) => void onSubmitOrganization(event)}>
          {organizationsApi.mutationError ? (
            <div className="rounded-md border border-red-600/40 bg-red-500/10 px-3 py-2 text-sm text-red-100" role="alert">
              {organizationErrorMessage(organizationsApi.mutationError)}
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span>{t('admin.organizations.form.keyLabel')}</span>
            <input
              value={formValues.organizationKey}
              onChange={(event) => setFormValues((current) => ({ ...current, organizationKey: event.target.value }))}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span>{t('admin.organizations.form.nameLabel')}</span>
            <input
              value={formValues.displayName}
              onChange={(event) => setFormValues((current) => ({ ...current, displayName: event.target.value }))}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span>{t('admin.organizations.form.typeLabel')}</span>
            <select
              value={formValues.organizationType}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, organizationType: event.target.value as IamOrganizationType }))
              }
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {t(ORGANIZATION_TYPE_KEYS[type])}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span>{t('admin.organizations.form.parentLabel')}</span>
            <select
              value={formValues.parentOrganizationId}
              onChange={(event) => setFormValues((current) => ({ ...current, parentOrganizationId: event.target.value }))}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            >
              <option value="">{t('admin.organizations.form.parentNone')}</option>
              {organizationsApi.organizations
                .filter((organization) => organization.id !== (editState?.mode === 'edit' ? editState.organizationId : ''))
                .map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.displayName}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            <span>{t('admin.organizations.form.policyLabel')}</span>
            <select
              value={formValues.contentAuthorPolicy}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  contentAuthorPolicy: event.target.value as 'org_only' | 'org_or_personal',
                }))
              }
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            >
              <option value="org_only">{t('admin.organizations.policies.orgOnly')}</option>
              <option value="org_or_personal">{t('admin.organizations.policies.orgOrPersonal')}</option>
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200"
              onClick={() => setEditState(null)}
            >
              {t('account.actions.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-md border border-emerald-700 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-100"
            >
              {editState?.mode === 'edit' ? t('admin.organizations.actions.save') : t('admin.organizations.actions.create')}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog
        open={membershipOrganizationId !== null}
        onClose={() => {
          setMembershipOrganizationId(null);
          organizationsApi.clearSelectedOrganization();
        }}
        title={t('admin.organizations.membershipsDialog.title')}
        description={selectedOrganization ? t('admin.organizations.membershipsDialog.description', { name: selectedOrganization.displayName }) : ''}
      >
        <div className="space-y-4">
          {organizationsApi.mutationError ? (
            <div className="rounded-md border border-red-600/40 bg-red-500/10 px-3 py-2 text-sm text-red-100" role="alert">
              {organizationErrorMessage(organizationsApi.mutationError)}
            </div>
          ) : null}
          <form className="grid gap-3 rounded-lg border border-slate-700 bg-slate-950/50 p-4" onSubmit={(event) => void onAssignMembership(event)}>
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              <span>{t('admin.organizations.membershipsDialog.accountLabel')}</span>
              <select
                value={membershipForm.accountId}
                onChange={(event) => setMembershipForm((current) => ({ ...current, accountId: event.target.value }))}
                className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
              >
                <option value="">{t('admin.organizations.membershipsDialog.accountPlaceholder')}</option>
                {usersApi.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              <span>{t('admin.organizations.membershipsDialog.visibilityLabel')}</span>
              <select
                value={membershipForm.visibility}
                onChange={(event) =>
                  setMembershipForm((current) => ({
                    ...current,
                    visibility: event.target.value as 'internal' | 'external',
                  }))
                }
                className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
              >
                <option value="internal">{t('admin.organizations.membershipsDialog.visibilityInternal')}</option>
                <option value="external">{t('admin.organizations.membershipsDialog.visibilityExternal')}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={membershipForm.isDefaultContext}
                onChange={(event) =>
                  setMembershipForm((current) => ({ ...current, isDefaultContext: event.target.checked }))
                }
              />
              <span>{t('admin.organizations.membershipsDialog.defaultLabel')}</span>
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-md border border-sky-700 bg-sky-500/20 px-3 py-2 text-sm font-semibold text-sky-100"
                disabled={!membershipForm.accountId}
              >
                {t('admin.organizations.actions.assignMembership')}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">{t('admin.organizations.membershipsDialog.membersTitle')}</h2>
            {selectedOrganization?.memberships.length ? (
              <ul className="space-y-2">
                {selectedOrganization.memberships.map((membership) => (
                  <li
                    key={membership.accountId}
                    className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-100 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium">{membership.displayName}</p>
                      <p className="text-xs text-slate-400">{membership.email ?? membership.keycloakSubject}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
                        {membership.visibility === 'internal'
                          ? t('admin.organizations.membershipsDialog.visibilityInternal')
                          : t('admin.organizations.membershipsDialog.visibilityExternal')}
                      </span>
                      {membership.isDefaultContext ? (
                        <span className="rounded-full border border-emerald-700 px-2 py-1 text-xs text-emerald-100">
                          {t('admin.organizations.membershipsDialog.defaultBadge')}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-md border border-red-700 px-3 py-2 text-xs text-red-100"
                        onClick={() => {
                          if (!membershipOrganizationId) {
                            return;
                          }
                          void organizationsApi.removeMembership(membershipOrganizationId, membership.accountId);
                        }}
                      >
                        {t('admin.organizations.actions.removeMembership')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-300">{t('admin.organizations.membershipsDialog.empty')}</p>
            )}
          </div>
        </div>
      </ModalDialog>

      <ConfirmDialog
        open={deactivateOrganizationId !== null}
        title={t('admin.organizations.confirm.deactivateTitle')}
        description={t('admin.organizations.confirm.deactivateDescription')}
        confirmLabel={t('admin.organizations.actions.deactivate')}
        cancelLabel={t('account.actions.cancel')}
        onConfirm={() => void onConfirmDeactivate()}
        onCancel={() => setDeactivateOrganizationId(null)}
      />
    </section>
  );
};
