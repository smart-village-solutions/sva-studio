export type TenantKeycloakRoleDescriptor = {
  readonly externalName: string;
  readonly clientRole?: boolean;
  readonly attributes?: Readonly<Record<string, readonly string[]>>;
};

export type TenantKeycloakRoleCategory =
  | 'assignable'
  | 'system_admin'
  | 'keycloak_builtin'
  | 'client_role'
  | 'service_role'
  | 'platform_role';

export type TenantKeycloakRoleAssignmentPolicy = {
  readonly category: TenantKeycloakRoleCategory;
  readonly assignable: boolean;
  readonly reasonCode?: string;
};

const KEYCLOAK_BUILTIN_REALM_ROLES = new Set(['offline_access', 'uma_authorization']);
const TENANT_SERVICE_REALM_ROLES = new Set(['realm_account_admin']);
const PLATFORM_REALM_ROLES = new Set(['instance_registry_admin']);

export const classifyTenantKeycloakRole = (
  role: TenantKeycloakRoleDescriptor
): TenantKeycloakRoleAssignmentPolicy => {
  if (role.clientRole === true) {
    return { category: 'client_role', assignable: false, reasonCode: 'client_role_not_supported' };
  }

  if (
    KEYCLOAK_BUILTIN_REALM_ROLES.has(role.externalName) ||
    role.externalName.startsWith('default-roles-')
  ) {
    return { category: 'keycloak_builtin', assignable: false, reasonCode: 'keycloak_builtin_role' };
  }

  if (TENANT_SERVICE_REALM_ROLES.has(role.externalName)) {
    return { category: 'service_role', assignable: false, reasonCode: 'tenant_service_role' };
  }

  if (PLATFORM_REALM_ROLES.has(role.externalName)) {
    return { category: 'platform_role', assignable: false, reasonCode: 'platform_role' };
  }

  if (role.externalName === 'system_admin') {
    return {
      category: 'system_admin',
      assignable: false,
      reasonCode: 'system_admin_requires_canonical_assignment',
    };
  }

  return { category: 'assignable', assignable: true };
};

export const isTenantKeycloakRoleVisible = (role: TenantKeycloakRoleDescriptor): boolean =>
  role.clientRole !== true;
