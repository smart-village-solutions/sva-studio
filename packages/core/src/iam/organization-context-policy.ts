const SYSTEM_ADMIN_ROLE = 'system_admin';

type OrganizationContextOptionLike = {
  readonly organizationId: string;
  readonly isActive: boolean;
};

const normalizeRoleNames = (roleNames: readonly string[] | undefined): readonly string[] =>
  [...new Set(roleNames?.map((roleName) => roleName.trim()).filter((roleName) => roleName.length > 0) ?? [])];

export const hasSystemAdminRole = (roleNames: readonly string[] | undefined): boolean =>
  normalizeRoleNames(roleNames).includes(SYSTEM_ADMIN_ROLE);

const defaultChooseActiveOrganizationId = <T extends OrganizationContextOptionLike>(input: {
  readonly storedActiveOrganizationId?: string;
  readonly activeOrganizations: readonly T[];
}): string | undefined => {
  if (
    input.storedActiveOrganizationId &&
    input.activeOrganizations.some((organization) => organization.organizationId === input.storedActiveOrganizationId)
  ) {
    return input.storedActiveOrganizationId;
  }

  return input.activeOrganizations[0]?.organizationId;
};

export const resolveOrganizationContextState = <T extends OrganizationContextOptionLike>(input: {
  readonly roleNames?: readonly string[];
  readonly organizations?: readonly T[];
  readonly storedActiveOrganizationId?: string;
  readonly chooseActiveOrganizationId?: (input: {
    readonly storedActiveOrganizationId?: string;
    readonly activeOrganizations: readonly T[];
  }) => string | undefined;
}) => {
  const activeOrganizations = (input.organizations ?? []).filter((organization) => organization.isActive);
  const isReadOnly = hasSystemAdminRole(input.roleNames);
  const activeOrganizationId = isReadOnly
    ? undefined
    : (input.chooseActiveOrganizationId ?? defaultChooseActiveOrganizationId)({
        storedActiveOrganizationId: input.storedActiveOrganizationId,
        activeOrganizations,
      });

  return {
    activeOrganizations,
    activeOrganizationId,
    canSwitch: !isReadOnly && activeOrganizations.length > 1,
    hasVisibleMemberships: activeOrganizations.length > 0,
    isReadOnly,
  };
};
