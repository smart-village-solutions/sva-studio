import * as React from 'react';

import { useOrganizations } from '../../../hooks/use-organizations';
import type { useUser } from '../../../hooks/use-user';

type UserDetail = ReturnType<typeof useUser>['user'];

type OrganizationMembershipDraft = {
  readonly visibility: 'internal' | 'external';
  readonly isDefaultContext: boolean;
};

type OrganizationAssignment = {
  readonly organizationId: string;
  readonly organizationLabel: string;
  readonly visibility: 'internal' | 'external';
  readonly isDefaultContext: boolean;
};

const DEFAULT_ORGANIZATION_ASSIGNMENT: OrganizationAssignment = {
  organizationId: '',
  organizationLabel: '',
  visibility: 'internal',
  isDefaultContext: false,
};

const buildOrganizationMembershipDrafts = (user: UserDetail) =>
  Object.fromEntries(
    (user?.organizationMemberships ?? []).map((membership) => [
      membership.organizationId,
      {
        visibility: membership.visibility,
        isDefaultContext: membership.isDefaultContext,
      } satisfies OrganizationMembershipDraft,
    ])
  ) as Record<string, OrganizationMembershipDraft>;

const buildAssignedOrganizationIds = (user: UserDetail) =>
  new Set((user?.organizationMemberships ?? []).map((membership) => membership.organizationId));

const filterAvailableOrganizations = (
  organizations: ReturnType<typeof useOrganizations>['organizations'],
  assignedOrganizationIds: ReadonlySet<string>
) => organizations.filter((organization) => !assignedOrganizationIds.has(organization.id));

const mergeOrganizationMembershipDraft = (
  current: Record<string, OrganizationMembershipDraft>,
  organizationId: string,
  patch: Partial<OrganizationMembershipDraft>
) => ({
  ...current,
  [organizationId]: {
    visibility: patch.visibility ?? current[organizationId]?.visibility ?? 'internal',
    isDefaultContext: patch.isDefaultContext ?? current[organizationId]?.isDefaultContext ?? false,
  },
});

const formatOrganizationAssignmentLabel = (organization: { displayName: string; organizationKey: string }) =>
  `${organization.displayName} (${organization.organizationKey})`;

export const useUserOrganizationMembershipState = (input: {
  readonly userId: string;
  readonly user: UserDetail;
  readonly refetchUser: () => Promise<void>;
}) => {
  const organizationsApi = useOrganizations({ page: 1, pageSize: 100, status: 'active' });
  const [organizationAssignment, setOrganizationAssignment] =
    React.useState<OrganizationAssignment>(DEFAULT_ORGANIZATION_ASSIGNMENT);
  const [organizationSearchValue, setOrganizationSearchValue] = React.useState('');
  const [organizationMembershipDrafts, setOrganizationMembershipDrafts] = React.useState<
    Record<string, OrganizationMembershipDraft>
  >(() => buildOrganizationMembershipDrafts(input.user));

  React.useEffect(() => {
    setOrganizationMembershipDrafts(buildOrganizationMembershipDrafts(input.user));
  }, [input.user]);

  React.useEffect(() => {
    setOrganizationAssignment(DEFAULT_ORGANIZATION_ASSIGNMENT);
    setOrganizationSearchValue('');
    organizationsApi.setSearch('');
  }, [input.userId]);

  const assignedOrganizationIds = React.useMemo(() => buildAssignedOrganizationIds(input.user), [input.user]);
  const availableOrganizations = React.useMemo(
    () => filterAvailableOrganizations(organizationsApi.organizations, assignedOrganizationIds),
    [assignedOrganizationIds, organizationsApi.organizations]
  );

  const selectedAssignableOrganization = React.useMemo(
    () => availableOrganizations.find((organization) => organization.id === organizationAssignment.organizationId) ?? null,
    [availableOrganizations, organizationAssignment.organizationId]
  );

  const updateOrganizationMembershipDraft = React.useCallback(
    (organizationId: string, patch: Partial<OrganizationMembershipDraft>) => {
      setOrganizationMembershipDrafts((current) => mergeOrganizationMembershipDraft(current, organizationId, patch));
    },
    []
  );

  const updateOrganizationSearchValue = React.useCallback(
    (value: string) => {
      setOrganizationSearchValue(value);
      organizationsApi.setSearch(value);
    },
    [organizationsApi]
  );

  const selectOrganizationAssignment = React.useCallback(
    (organizationId: string) => {
      const selectedOrganization = availableOrganizations.find((organization) => organization.id === organizationId);
      setOrganizationAssignment((current) => ({
        ...current,
        organizationId,
        organizationLabel: selectedOrganization ? formatOrganizationAssignmentLabel(selectedOrganization) : current.organizationLabel,
      }));
    },
    [availableOrganizations]
  );

  const assignOrganizationMembership = React.useCallback(async () => {
    if (!organizationAssignment.organizationId) {
      return false;
    }

    const updated = await organizationsApi.assignMembership(organizationAssignment.organizationId, {
      accountId: input.userId,
      visibility: organizationAssignment.visibility,
      isDefaultContext: organizationAssignment.isDefaultContext,
    });
    if (!updated) {
      return false;
    }

    setOrganizationAssignment(DEFAULT_ORGANIZATION_ASSIGNMENT);
    updateOrganizationSearchValue('');
    await input.refetchUser();
    return true;
  }, [input, organizationAssignment, organizationsApi, updateOrganizationSearchValue]);

  const saveOrganizationMembership = React.useCallback(
    async (organizationId: string) => {
      const draft = organizationMembershipDrafts[organizationId];
      if (!draft) {
        return false;
      }

      const updated = await organizationsApi.updateMembership(organizationId, input.userId, draft);
      if (!updated) {
        return false;
      }

      await input.refetchUser();
      return true;
    },
    [input, organizationMembershipDrafts, organizationsApi]
  );

  const removeOrganizationMembership = React.useCallback(
    async (organizationId: string) => {
      const updated = await organizationsApi.removeMembership(organizationId, input.userId);
      if (!updated) {
        return false;
      }

      await input.refetchUser();
      return true;
    },
    [input, organizationsApi]
  );

  return {
    availableOrganizations,
    organizationAssignment,
    organizationMembershipDrafts,
    organizationSearchValue,
    organizationMutationError: organizationsApi.mutationError,
    assignOrganizationMembership,
    removeOrganizationMembership,
    saveOrganizationMembership,
    selectOrganizationAssignment,
    setOrganizationAssignment,
    selectedAssignableOrganization,
    setOrganizationSearchValue: updateOrganizationSearchValue,
    updateOrganizationMembershipDraft,
  };
};
