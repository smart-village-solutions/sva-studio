type RoleLike = Readonly<{
  roleKey?: string | null;
  roleName?: string | null;
  externalRoleName?: string | null;
  managedBy?: 'studio' | 'external' | 'keycloak_builtin' | string;
  editability?: 'editable' | 'read_only' | 'blocked';
}>;

const ROOT_ONLY_ROLE_KEY = 'instance_registry_admin';
const PROTECTED_TENANT_ROLE_KEY = 'system_admin';

const normalizeRoleIdentifier = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const collectRoleIdentifiers = (role: RoleLike): readonly string[] => {
  const identifiers = [
    normalizeRoleIdentifier(role.roleKey),
    normalizeRoleIdentifier(role.roleName),
    normalizeRoleIdentifier(role.externalRoleName),
  ].filter((value): value is string => value !== null);

  return [...new Set(identifiers)];
};

export const isRootOnlyTenantRole = (role: RoleLike): boolean =>
  collectRoleIdentifiers(role).includes(ROOT_ONLY_ROLE_KEY);

export const isProtectedTenantRole = (role: RoleLike): boolean =>
  collectRoleIdentifiers(role).includes(PROTECTED_TENANT_ROLE_KEY);

export const isTenantRoleVisible = (role: RoleLike): boolean =>
  !isRootOnlyTenantRole(role);

export const isTenantRoleReadOnly = (role: RoleLike): boolean => {
  if (role.editability) {
    return role.editability !== 'editable';
  }

  return role.managedBy !== 'studio' || isProtectedTenantRole(role) || isRootOnlyTenantRole(role);
};
