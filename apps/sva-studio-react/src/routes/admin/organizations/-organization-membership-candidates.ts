import type { IamUserListItem } from '@sva/core';
import React from 'react';

import { filterSearchableSelectOptions } from '../../../components/ui/searchable-select-option-list';
import type { useOrganizations } from '../../../hooks/use-organizations';
import { asIamError, listUsers, type IamHttpError } from '../../../lib/iam-api';

const MEMBERSHIP_USER_PAGE_SIZE = 100;
const MEMBERSHIP_SEARCH_DEBOUNCE_MS = 300;

type Organization = NonNullable<ReturnType<typeof useOrganizations>['selectedOrganization']>;

export const formatMembershipUserLabel = (user: IamUserListItem) =>
  user.email
    ? `${user.displayName} <${user.email}>`
    : `${user.displayName} <${user.keycloakSubject}>`;

export const membershipUserKeywords = (user: IamUserListItem) => [
  user.displayName,
  user.email ?? '',
  user.keycloakSubject,
  user.position ?? '',
  user.department ?? '',
];

export const sortMembershipUsersByLabel = (
  users: readonly IamUserListItem[]
): readonly IamUserListItem[] =>
  users
    .map((user) => ({ user, label: formatMembershipUserLabel(user) }))
    .sort((left, right) => left.label.localeCompare(right.label))
    .map(({ user }) => user);

export const useOrganizationMembershipCandidates = ({
  canUpdateOrganization,
  memberships,
  organizationId,
}: {
  canUpdateOrganization: boolean;
  memberships: Organization['memberships'] | undefined;
  organizationId: string;
}) => {
  const [membershipSearch, setMembershipSearch] = React.useState('');
  const [debouncedMembershipSearch, setDebouncedMembershipSearch] = React.useState('');
  const [membershipUsers, setMembershipUsers] = React.useState<readonly IamUserListItem[]>([]);
  const [membershipUsersLoading, setMembershipUsersLoading] = React.useState(true);
  const [membershipUsersError, setMembershipUsersError] = React.useState<IamHttpError | null>(null);

  React.useEffect(() => {
    setMembershipSearch('');
    setDebouncedMembershipSearch('');
  }, [organizationId]);

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
      if (!canUpdateOrganization) {
        setMembershipUsers([]);
        setMembershipUsersLoading(false);
        setMembershipUsersError(null);
        return;
      }
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
  }, [canUpdateOrganization, debouncedMembershipSearch]);

  const assignedMembershipAccountIds = React.useMemo(
    () => new Set(memberships?.map((membership) => membership.accountId) ?? []),
    [memberships]
  );
  const availableMembershipUsers = React.useMemo(
    () => membershipUsers.filter((user) => !assignedMembershipAccountIds.has(user.id)),
    [assignedMembershipAccountIds, membershipUsers]
  );
  const visibleMembershipUsers = React.useMemo(
    () =>
      filterSearchableSelectOptions(
        availableMembershipUsers.map((user) => ({
          value: user.id,
          label: formatMembershipUserLabel(user),
          keywords: membershipUserKeywords(user),
        })),
        membershipSearch
      ),
    [availableMembershipUsers, membershipSearch]
  );

  return {
    availableMembershipUsers,
    membershipSearch,
    membershipUsersError,
    membershipUsersLoading,
    setMembershipSearch,
    visibleMembershipUsers,
  };
};
