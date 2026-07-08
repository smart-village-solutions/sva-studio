import { StudioDetailPageTemplate } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import type { IamUserListItem } from '@sva/core';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import { SearchableSelect } from '../../../components/ui/searchable-select';
import { Select } from '../../../components/ui/select';
import { useOrganizations } from '../../../hooks/use-organizations';
import { t } from '../../../i18n';
import { asIamError, listOrganizations, listUsers, type IamHttpError } from '../../../lib/iam-api';
import {
  areOrganizationParentOptionsEqual,
  createOrganizationFormValues,
  getOrganizationTypeTranslationKey,
  loadAllOrganizationParentOptions,
  mergeOrganizationParentOptions,
  OrganizationForm,
  type OrganizationParentOption,
  organizationErrorMessage,
  toOrganizationFormValues,
  toOrganizationMutationPayload,
} from './-organization-shared';

const MEMBERSHIP_USER_PAGE_SIZE = 100;
const MEMBERSHIP_SEARCH_DEBOUNCE_MS = 300;

const formatMembershipUserLabel = (user: IamUserListItem) =>
  user.email ? `${user.displayName} <${user.email}>` : `${user.displayName} <${user.keycloakSubject}>`;

export const sortMembershipUsersByLabel = (users: readonly IamUserListItem[]): readonly IamUserListItem[] =>
  users
    .map((user) => ({
      user,
      label: formatMembershipUserLabel(user),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
    .map(({ user }) => user);

type OrganizationDetailPageProps = {
  readonly organizationId: string;
};

type OrganizationMembershipDraft = {
  readonly visibility: 'internal' | 'external';
  readonly isDefaultContext: boolean;
};

const buildMembershipDrafts = (
  memberships: NonNullable<ReturnType<typeof useOrganizations>['selectedOrganization']>['memberships']
): Record<string, OrganizationMembershipDraft> =>
  Object.fromEntries(
    memberships.map((membership) => [
      membership.accountId,
      {
        visibility: membership.visibility,
        isDefaultContext: membership.isDefaultContext,
      },
    ])
  );

export const OrganizationDetailPage = ({ organizationId }: OrganizationDetailPageProps) => {
  const organizationsApi = useOrganizations();
  const { loadOrganization } = organizationsApi;
  const [membershipForm, setMembershipForm] = React.useState({
    accountId: '',
    isDefaultContext: false,
  });
  const [membershipSearch, setMembershipSearch] = React.useState('');
  const [debouncedMembershipSearch, setDebouncedMembershipSearch] = React.useState('');
  const [membershipUsers, setMembershipUsers] = React.useState<readonly IamUserListItem[]>([]);
  const [membershipUsersLoading, setMembershipUsersLoading] = React.useState(true);
  const [membershipUsersError, setMembershipUsersError] = React.useState<IamHttpError | null>(null);
  const [membershipDrafts, setMembershipDrafts] = React.useState<Record<string, OrganizationMembershipDraft>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [formValues, setFormValues] = React.useState(createOrganizationFormValues);
  const [parentOrganizations, setParentOrganizations] = React.useState<readonly OrganizationParentOption[]>(
    () => organizationsApi.organizations
  );

  React.useEffect(() => {
    void loadOrganization(organizationId);
  }, [loadOrganization, organizationId]);

  React.useEffect(() => {
    setParentOrganizations((current) => {
      const next = mergeOrganizationParentOptions(current, organizationsApi.organizations);
      return areOrganizationParentOptionsEqual(current, next) ? current : next;
    });
  }, [organizationsApi.organizations]);

  React.useEffect(() => {
    let active = true;

    const loadParentOrganizations = async () => {
      try {
        const organizations = await loadAllOrganizationParentOptions((query) => listOrganizations(query));
        if (!active) {
          return;
        }
        setParentOrganizations((current) => {
          const next = mergeOrganizationParentOptions(current, organizations);
          return areOrganizationParentOptionsEqual(current, next) ? current : next;
        });
      } catch {
        // Fall back to the currently loaded page when the full options load is unavailable.
      }
    };

    void loadParentOrganizations();

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    const detail = organizationsApi.selectedOrganization;
    if (!detail || detail.id !== organizationId) {
      return;
    }

    setFormValues(toOrganizationFormValues(detail));
    setMembershipDrafts(buildMembershipDrafts(detail.memberships));
  }, [organizationId, organizationsApi.selectedOrganization]);

  const selectedOrganization =
    organizationsApi.selectedOrganization?.id === organizationId ? organizationsApi.selectedOrganization : null;

  React.useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      setDebouncedMembershipSearch(membershipSearch);
    }, MEMBERSHIP_SEARCH_DEBOUNCE_MS);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [membershipSearch]);

  React.useEffect(() => {
    let active = true;

    const loadMembershipUsers = async () => {
      setMembershipUsersLoading(true);
      setMembershipUsersError(null);

      try {
        const response = await listUsers({
          page: 1,
          pageSize: MEMBERSHIP_USER_PAGE_SIZE,
          search: debouncedMembershipSearch.trim() || undefined,
          status: 'active',
        });

        if (!active) {
          return;
        }

        setMembershipUsers(sortMembershipUsersByLabel(response.data));
      } catch (cause) {
        if (!active) {
          return;
        }
        setMembershipUsers([]);
        setMembershipUsersError(asIamError(cause));
      } finally {
        if (active) {
          setMembershipUsersLoading(false);
        }
      }
    };

    void loadMembershipUsers();

    return () => {
      active = false;
    };
  }, [debouncedMembershipSearch]);

  const assignedMembershipAccountIds = React.useMemo(
    () => new Set(selectedOrganization?.memberships.map((membership) => membership.accountId) ?? []),
    [selectedOrganization?.memberships]
  );
  const availableMembershipUsers = React.useMemo(
    () => membershipUsers.filter((user) => !assignedMembershipAccountIds.has(user.id)),
    [assignedMembershipAccountIds, membershipUsers]
  );

  const onSubmitOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await organizationsApi.updateOrganization(organizationId, toOrganizationMutationPayload(formValues));
  };

  const onAssignMembership = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!membershipForm.accountId) {
      return;
    }

    const success = await organizationsApi.assignMembership(organizationId, {
      accountId: membershipForm.accountId,
      visibility: 'internal',
      isDefaultContext: membershipForm.isDefaultContext,
    });
    if (!success) {
      return;
    }

    setMembershipForm({ accountId: '', isDefaultContext: false });
    setMembershipSearch('');
  };

  const onConfirmDelete = async () => {
    const success = await organizationsApi.deleteOrganization(organizationId);
    if (success) {
      setDeleteConfirmOpen(false);
    }
  };

  const updateMembershipDraft = React.useCallback(
    (accountId: string, patch: Partial<OrganizationMembershipDraft>) => {
      setMembershipDrafts((current) => ({
        ...current,
        [accountId]: {
          visibility: patch.visibility ?? current[accountId]?.visibility ?? 'internal',
          isDefaultContext: patch.isDefaultContext ?? current[accountId]?.isDefaultContext ?? false,
        },
      }));
    },
    []
  );

  const saveMembership = React.useCallback(
    async (accountId: string) => {
      const draft = membershipDrafts[accountId];
      if (!draft) {
        return;
      }

      await organizationsApi.updateMembership(organizationId, accountId, draft);
    },
    [membershipDrafts, organizationId, organizationsApi]
  );

  if (organizationsApi.error) {
    return (
      <section className="space-y-4">
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{organizationErrorMessage(organizationsApi.error)}</AlertDescription>
        </Alert>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/organizations">{t('admin.organizations.detail.backToList')}</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-busy={organizationsApi.detailLoading}>
      <div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/organizations">{t('admin.organizations.detail.backToList')}</Link>
        </Button>
      </div>

      <StudioDetailPageTemplate
        title={selectedOrganization?.displayName ?? t('admin.organizations.editDialog.title')}
        description={t('admin.organizations.editDialog.description')}
        actions={
          selectedOrganization ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={selectedOrganization.childCount > 0}
            >
              {t('admin.organizations.actions.delete')}
            </Button>
          ) : undefined
        }
      >
        {!selectedOrganization && !organizationsApi.detailLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">{t('admin.organizations.detail.notFound')}</Card>
        ) : null}

        {selectedOrganization ? (
          <>
            <Card className="space-y-4 p-5">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  {t('admin.organizations.sections.overviewTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('admin.organizations.sections.overviewDescription')}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('admin.organizations.form.keyLabel')}
                  </p>
                  <p className="text-sm text-foreground">{selectedOrganization.organizationKey}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('admin.organizations.table.headerStatus')}
                  </p>
                  <Badge className="rounded-full" variant="outline">
                    {selectedOrganization.isActive
                      ? t('admin.organizations.filters.statusActive')
                      : t('admin.organizations.filters.statusInactive')}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('admin.organizations.table.headerType')}
                  </p>
                  <p className="text-sm text-foreground">
                    {t(getOrganizationTypeTranslationKey(selectedOrganization.organizationType))}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('admin.organizations.table.headerParent')}
                  </p>
                  <p className="text-sm text-foreground">
                    {selectedOrganization.parentDisplayName ?? t('admin.organizations.messages.root')}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('admin.organizations.table.headerChildren')}
                  </p>
                  <p className="text-sm text-foreground">{selectedOrganization.childCount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('admin.organizations.table.headerMembers')}
                  </p>
                  <p className="text-sm text-foreground">{selectedOrganization.membershipCount}</p>
                </div>
                <div className="space-y-1 xl:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('admin.organizations.messages.hierarchyPath', { value: '' }).replace(': ', '')}
                  </p>
                  <p className="text-sm text-foreground">
                    {(selectedOrganization.hierarchyPath ?? []).join(' > ') || t('admin.organizations.messages.root')}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('admin.organizations.messages.metadataCount', { value: '' }).replace(': ', '')}
                  </p>
                  <p className="text-sm text-foreground">
                    {Object.keys(selectedOrganization.metadata ?? {}).length}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="space-y-4 p-5">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  {t('admin.organizations.sections.baseDataTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('admin.organizations.sections.baseDataDescription')}
                </p>
              </div>
              <OrganizationForm
                excludeOrganizationId={organizationId}
                organizations={parentOrganizations}
                onSubmit={(event) => void onSubmitOrganization(event)}
                setFormValues={setFormValues}
                submitLabel={t('admin.organizations.actions.save')}
                formValues={formValues}
              />
            </Card>

            <Card className="space-y-4 p-5">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  {t('admin.organizations.sections.membershipsTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('admin.organizations.sections.membershipsDescription')}
                </p>
              </div>
              <Card className="bg-background p-3 text-sm text-foreground shadow-none">
                <p className="font-semibold">{selectedOrganization.displayName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('admin.organizations.membershipsDialog.description', {
                    name: selectedOrganization.displayName,
                  })}
                </p>
              </Card>

              <form className="grid gap-3" onSubmit={(event) => void onAssignMembership(event)}>
                <div className="grid gap-1 text-sm text-foreground">
                  <SearchableSelect
                    id="membership-account"
                    label={t('admin.organizations.membershipsDialog.accountLabel')}
                    value={membershipForm.accountId}
                    placeholder={t('admin.organizations.membershipsDialog.accountPlaceholder')}
                    searchPlaceholder={t('admin.organizations.membershipsDialog.searchPlaceholder')}
                    emptyText={t('admin.organizations.membershipsDialog.emptySelection')}
                    options={availableMembershipUsers.map((user) => ({
                      value: user.id,
                      label: formatMembershipUserLabel(user),
                      keywords: [user.displayName, user.email ?? '', user.keycloakSubject],
                    }))}
                    searchValue={membershipSearch}
                    onSearchValueChange={setMembershipSearch}
                    onValueChange={(accountId) =>
                      setMembershipForm((current) => ({ ...current, accountId }))
                    }
                    disabled={membershipUsersLoading}
                  />
                  {membershipUsersLoading ? (
                    <p className="text-xs text-muted-foreground">{t('admin.organizations.membershipsDialog.loading')}</p>
                  ) : null}
                  {membershipUsersError ? (
                    <p className="text-xs text-destructive">{organizationErrorMessage(membershipUsersError)}</p>
                  ) : null}
                  {!membershipUsersLoading && !membershipUsersError ? (
                    <p className="text-xs text-muted-foreground">
                      {availableMembershipUsers.length > 0
                        ? t('admin.organizations.membershipsDialog.availableCount', {
                            count: String(availableMembershipUsers.length),
                          })
                        : t('admin.organizations.membershipsDialog.emptySelection')}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Label htmlFor="membership-default" className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      id="membership-default"
                      checked={membershipForm.isDefaultContext}
                      onChange={(event) =>
                        setMembershipForm((current) => ({ ...current, isDefaultContext: event.target.checked }))
                      }
                    />
                    <span>{t('admin.organizations.membershipsDialog.defaultLabel')}</span>
                  </Label>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={!membershipForm.accountId}>
                    {t('admin.organizations.actions.assignMembership')}
                  </Button>
                </div>
              </form>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {t('admin.organizations.membershipsDialog.membersTitle')}
                </h3>
                {selectedOrganization.memberships.length ? (
                  <ul className="space-y-2">
                    {selectedOrganization.memberships.map((membership) => (
                      <li
                        key={membership.accountId}
                        className="rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-shell"
                      >
                        <div>
                          <p className="font-medium">{membership.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {membership.email ?? membership.keycloakSubject}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('admin.organizations.membershipsDialog.createdAt', { value: membership.createdAt })}
                          </p>
                        </div>
                        <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,12rem)_auto_auto] md:items-end">
                          <div className="grid gap-1 text-sm text-foreground">
                            <Label htmlFor={`membership-visibility-${membership.accountId}`}>
                              {t('admin.organizations.membershipsDialog.visibilityLabel')}
                            </Label>
                            <Select
                              id={`membership-visibility-${membership.accountId}`}
                              value={membershipDrafts[membership.accountId]?.visibility ?? membership.visibility}
                              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                                updateMembershipDraft(membership.accountId, {
                                  visibility: event.target.value as 'internal' | 'external',
                                })
                              }
                            >
                              <option value="internal">
                                {t('admin.organizations.membershipsDialog.visibilityInternal')}
                              </option>
                              <option value="external">
                                {t('admin.organizations.membershipsDialog.visibilityExternal')}
                              </option>
                            </Select>
                          </div>
                          <Label
                            htmlFor={`membership-default-${membership.accountId}`}
                            className="flex items-center gap-2 text-sm text-foreground"
                          >
                            <Checkbox
                              id={`membership-default-${membership.accountId}`}
                              checked={
                                membershipDrafts[membership.accountId]?.isDefaultContext ??
                                membership.isDefaultContext
                              }
                              onChange={(event) =>
                                updateMembershipDraft(membership.accountId, {
                                  isDefaultContext: event.target.checked,
                                })
                              }
                            />
                            <span>{t('admin.organizations.membershipsDialog.defaultLabel')}</span>
                          </Label>
                          <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            {membership.isDefaultContext ? (
                              <Badge
                                className="rounded-full border-primary/40 bg-primary/10 text-primary"
                                variant="outline"
                              >
                                {t('admin.organizations.membershipsDialog.defaultBadge')}
                              </Badge>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void saveMembership(membership.accountId)}
                            >
                              {t('admin.organizations.actions.save')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => void organizationsApi.removeMembership(organizationId, membership.accountId)}
                            >
                              {t('admin.organizations.actions.removeMembership')}
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('admin.organizations.membershipsDialog.empty')}</p>
                )}
              </div>
            </Card>
          </>
        ) : null}

        {organizationsApi.mutationError && selectedOrganization ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{organizationErrorMessage(organizationsApi.mutationError)}</AlertDescription>
          </Alert>
        ) : null}
      </StudioDetailPageTemplate>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t('admin.organizations.confirm.deleteTitle')}
        description={t('admin.organizations.confirm.deleteDescription')}
        confirmLabel={t('admin.organizations.actions.delete')}
        cancelLabel={t('account.actions.cancel')}
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </section>
  );
};
