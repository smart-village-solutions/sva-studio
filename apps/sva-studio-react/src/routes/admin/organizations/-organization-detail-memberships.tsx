import { Button } from '@sva/studio-ui-react';
import React from 'react';

import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import { SearchableMultiSelect } from '../../../components/ui/searchable-multi-select';
import type { useOrganizations } from '../../../hooks/use-organizations';
import { t } from '../../../i18n';
import { organizationErrorMessage } from './-organization-shared';

import type { useOrganizationMembershipCandidates } from './-organization-membership-candidates';
import {
  formatMembershipUserLabel,
  membershipUserKeywords,
} from './-organization-membership-candidates';

type Organization = NonNullable<ReturnType<typeof useOrganizations>['selectedOrganization']>;

export type OrganizationMembershipDraft = {
  readonly isDefaultContext: boolean;
};

export type MembershipAssignmentForm = {
  readonly accounts: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly isDefaultContext: boolean;
};

export const DEFAULT_MEMBERSHIP_FORM: MembershipAssignmentForm = {
  accounts: [],
  isDefaultContext: false,
};

export const buildMembershipDrafts = (
  memberships: NonNullable<
    ReturnType<typeof useOrganizations>['selectedOrganization']
  >['memberships']
): Record<string, OrganizationMembershipDraft> =>
  Object.fromEntries(
    memberships.map((membership) => [
      membership.accountId,
      {
        isDefaultContext: membership.isDefaultContext,
      },
    ])
  );

const OrganizationMembershipList = ({
  selectedOrganization,
  organizationId,
  organizationsApi,
  canUpdateOrganization,
  membershipDrafts,
  updateMembershipDraft,
  saveMembership,
}: {
  selectedOrganization: Organization;
  organizationId: string;
  organizationsApi: ReturnType<typeof useOrganizations>;
  canUpdateOrganization: boolean;
  membershipDrafts: Record<string, OrganizationMembershipDraft>;
  updateMembershipDraft: (accountId: string, patch: Partial<OrganizationMembershipDraft>) => void;
  saveMembership: (accountId: string) => Promise<void>;
}) => (
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
                {t('admin.organizations.membershipsDialog.createdAt', {
                  value: membership.createdAt,
                })}
              </p>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-[auto_auto] md:items-end">
              <Label
                htmlFor={`membership-default-${membership.accountId}`}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <Checkbox
                  id={`membership-default-${membership.accountId}`}
                  disabled={!canUpdateOrganization}
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
                {canUpdateOrganization ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      aria-label={t('admin.organizations.membershipsDialog.saveMembershipLabel', {
                        name: membership.displayName,
                      })}
                      onClick={() => void saveMembership(membership.accountId)}
                    >
                      {t('admin.organizations.actions.save')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        void organizationsApi.removeMembership(organizationId, membership.accountId)
                      }
                    >
                      {t('admin.organizations.actions.removeMembership')}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-muted-foreground">
        {t('admin.organizations.membershipsDialog.empty')}
      </p>
    )}
  </div>
);

export const OrganizationMembershipPanel = ({
  selectedOrganization,
  organizationId,
  organizationsApi,
  canUpdateOrganization,
  membershipForm,
  setMembershipForm,
  membershipAssignmentPending,
  candidates,
  membershipDrafts,
  updateMembershipDraft,
  saveMembership,
  onAssignMembership,
}: {
  selectedOrganization: Organization;
  organizationId: string;
  organizationsApi: ReturnType<typeof useOrganizations>;
  canUpdateOrganization: boolean;
  membershipForm: MembershipAssignmentForm;
  setMembershipForm: React.Dispatch<React.SetStateAction<MembershipAssignmentForm>>;
  membershipAssignmentPending: boolean;
  candidates: ReturnType<typeof useOrganizationMembershipCandidates>;
  membershipDrafts: Record<string, OrganizationMembershipDraft>;
  updateMembershipDraft: (accountId: string, patch: Partial<OrganizationMembershipDraft>) => void;
  saveMembership: (accountId: string) => Promise<void>;
  onAssignMembership: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) => {
  const {
    availableMembershipUsers,
    membershipSearch,
    membershipUsersLoading,
    membershipUsersError,
    setMembershipSearch,
    visibleMembershipUsers,
  } = candidates;
  return (
    <Card className="space-y-4 p-5">
      <Card className="bg-background p-3 text-sm text-foreground shadow-none">
        <p className="font-semibold">{selectedOrganization.displayName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('admin.organizations.membershipsDialog.description', {
            name: selectedOrganization.displayName,
          })}
        </p>
      </Card>

      <form
        className="grid gap-3"
        aria-readonly={!canUpdateOrganization}
        onSubmit={(event) => void onAssignMembership(event)}
      >
        <fieldset
          className="contents"
          disabled={!canUpdateOrganization || membershipAssignmentPending}
        >
          <div className="grid gap-1 text-sm text-foreground">
            <SearchableMultiSelect
              id="membership-account"
              label={t('admin.organizations.membershipsDialog.accountLabel')}
              values={membershipForm.accounts.map((account) => account.value)}
              placeholder={t('admin.organizations.membershipsDialog.accountPlaceholder')}
              selectedCountText={t('admin.organizations.membershipsDialog.selectedCount', {
                count: membershipForm.accounts.length,
              })}
              searchPlaceholder={t('admin.organizations.membershipsDialog.searchPlaceholder')}
              emptyText={t('admin.organizations.membershipsDialog.emptySelection')}
              options={availableMembershipUsers.map((user) => ({
                value: user.id,
                label: formatMembershipUserLabel(user),
                keywords: membershipUserKeywords(user),
              }))}
              selectedOptions={membershipForm.accounts}
              removeValueLabel={(label) =>
                t('admin.organizations.membershipsDialog.removeSelectionLabel', {
                  name: label,
                })
              }
              searchValue={membershipSearch}
              onSearchValueChange={setMembershipSearch}
              onValuesChange={(accountIds) =>
                setMembershipForm((current) => ({
                  ...current,
                  accounts: accountIds.flatMap((accountId) => {
                    const selectedAccount = current.accounts.find(
                      (account) => account.value === accountId
                    );
                    if (selectedAccount) {
                      return [selectedAccount];
                    }
                    const selectedUser = availableMembershipUsers.find(
                      (user) => user.id === accountId
                    );
                    return selectedUser
                      ? [
                          {
                            value: accountId,
                            label: formatMembershipUserLabel(selectedUser),
                          },
                        ]
                      : [];
                  }),
                }))
              }
              disabled={membershipUsersLoading || membershipAssignmentPending}
            />
            {membershipUsersLoading ? (
              <p className="text-xs text-muted-foreground">
                {t('admin.organizations.membershipsDialog.loading')}
              </p>
            ) : null}
            {membershipUsersError ? (
              <p className="text-xs text-destructive">
                {organizationErrorMessage(membershipUsersError)}
              </p>
            ) : null}
            {!membershipUsersLoading && !membershipUsersError ? (
              <p className="text-xs text-muted-foreground">
                {visibleMembershipUsers.length > 0
                  ? t('admin.organizations.membershipsDialog.availableCount', {
                      count: String(visibleMembershipUsers.length),
                    })
                  : t('admin.organizations.membershipsDialog.emptySelection')}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4">
            <Label
              htmlFor="membership-default"
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <Checkbox
                id="membership-default"
                checked={membershipForm.isDefaultContext}
                onChange={(event) =>
                  setMembershipForm((current) => ({
                    ...current,
                    isDefaultContext: event.target.checked,
                  }))
                }
              />
              <span>{t('admin.organizations.membershipsDialog.defaultLabel')}</span>
            </Label>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!membershipForm.accounts.length || membershipAssignmentPending}
            >
              {t('admin.organizations.actions.assignMembership')}
            </Button>
          </div>
        </fieldset>
      </form>

      <OrganizationMembershipList
        selectedOrganization={selectedOrganization}
        organizationId={organizationId}
        organizationsApi={organizationsApi}
        canUpdateOrganization={canUpdateOrganization}
        membershipDrafts={membershipDrafts}
        updateMembershipDraft={updateMembershipDraft}
        saveMembership={saveMembership}
      />
    </Card>
  );
};
