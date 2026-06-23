type RoleIdentity = Readonly<{
  role_key?: string | null;
  role_name?: string | null;
  external_role_name?: string | null;
}>;

const SYSTEM_ADMIN_ROLE_KEY = 'system_admin';
const ROOT_ONLY_ROLE_KEY = 'instance_registry_admin';

export const TENANT_TECHNICAL_KEYCLOAK_ROLE_NAMES = [SYSTEM_ADMIN_ROLE_KEY] as const;
export const PLATFORM_TECHNICAL_KEYCLOAK_ROLE_NAMES = [ROOT_ONLY_ROLE_KEY] as const;

const TENANT_TECHNICAL_KEYCLOAK_ROLE_SET = new Set<string>(TENANT_TECHNICAL_KEYCLOAK_ROLE_NAMES);
const PLATFORM_TECHNICAL_KEYCLOAK_ROLE_SET = new Set<string>(PLATFORM_TECHNICAL_KEYCLOAK_ROLE_NAMES);

const normalizeRoleIdentifier = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const collectRoleIdentifiers = (role: RoleIdentity): readonly string[] => {
  const identifiers = [
    normalizeRoleIdentifier(role.role_key),
    normalizeRoleIdentifier(role.role_name),
    normalizeRoleIdentifier(role.external_role_name),
  ].filter((value): value is string => value !== null);

  return [...new Set(identifiers)];
};

export const isProtectedTenantRole = (role: RoleIdentity): boolean =>
  collectRoleIdentifiers(role).includes(SYSTEM_ADMIN_ROLE_KEY);

export const isRootOnlyRole = (role: RoleIdentity): boolean =>
  collectRoleIdentifiers(role).includes(ROOT_ONLY_ROLE_KEY);

export const isTenantManageableRole = (role: RoleIdentity): boolean =>
  !isRootOnlyRole(role);

export const isTenantTechnicalKeycloakRole = (role: RoleIdentity): boolean =>
  collectRoleIdentifiers(role).some((identifier) => TENANT_TECHNICAL_KEYCLOAK_ROLE_SET.has(identifier));

export const filterTenantTechnicalKeycloakRoleNames = (roleNames: readonly string[]): readonly string[] =>
  [...new Set(roleNames.filter((roleName) => TENANT_TECHNICAL_KEYCLOAK_ROLE_SET.has(roleName)))];

export const filterPlatformTechnicalKeycloakRoleNames = (roleNames: readonly string[]): readonly string[] =>
  [...new Set(roleNames.filter((roleName) => PLATFORM_TECHNICAL_KEYCLOAK_ROLE_SET.has(roleName)))];
