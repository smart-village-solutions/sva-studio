import { KeycloakOidcClientOperations } from './oidc-clients.js';
import { KeycloakAdminRequestError } from './errors.js';
import { encodePathSegment } from './helpers.js';
import type { KeycloakAdminUser, KeycloakRoleMapping } from './internal-models.js';

const REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES = [
  'manage-users',
  'view-users',
  'view-realm',
  'manage-realm',
  'view-clients',
] as const;

const LEGACY_TENANT_ADMIN_CLIENT_ROLE_NAME = 'manage-clients';
const ALLOWED_EFFECTIVE_TENANT_ADMIN_CLIENT_ROLE_NAMES = [
  ...REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES,
  'query-users',
  'query-groups',
  'query-clients',
] as const;

const tenantAdminServiceRoleMappingsAreSafe = (
  directRoleMappings: readonly KeycloakRoleMapping[],
  effectiveRoleMappings: readonly KeycloakRoleMapping[]
): boolean => {
  const directRoleNames = new Set(directRoleMappings.map((role) => role.name));
  const effectiveRoleNames = new Set(effectiveRoleMappings.map((role) => role.name));
  return (
    directRoleNames.size === REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES.length &&
    REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES.every((roleName) => directRoleNames.has(roleName)) &&
    REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES.every((roleName) => effectiveRoleNames.has(roleName)) &&
    [...effectiveRoleNames].every((roleName) =>
      ALLOWED_EFFECTIVE_TENANT_ADMIN_CLIENT_ROLE_NAMES.includes(
        roleName as (typeof ALLOWED_EFFECTIVE_TENANT_ADMIN_CLIENT_ROLE_NAMES)[number]
      )
    )
  );
};

export class KeycloakTenantAdminAccessOperations extends KeycloakOidcClientOperations {
  async ensureTenantAdminServiceAccess(clientId: string): Promise<void> {
    await this.assertWriteAvailability();
    const tenantAdminClient = await this.getOidcClientByClientId(clientId);
    if (!tenantAdminClient) {
      throw new KeycloakAdminRequestError({
        message: `Unknown Keycloak client: ${clientId}`,
        statusCode: 404,
        code: 'unknown_client',
        retryable: false,
      });
    }

    const realmManagementClient = await this.getOidcClientByClientId('realm-management');
    if (!realmManagementClient) {
      throw new KeycloakAdminRequestError({
        message: 'Missing Keycloak client: realm-management',
        statusCode: 404,
        code: 'realm_management_client_missing',
        retryable: false,
      });
    }

    const [serviceAccountUser, availableRoles] = await Promise.all([
      this.executeWithResilience<KeycloakAdminUser>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(tenantAdminClient.id)}/service-account-user`,
        operation: 'get_service_account_user',
      }),
      this.executeWithResilience<KeycloakRoleMapping[]>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(realmManagementClient.id)}/roles`,
        operation: 'list_realm_management_client_roles',
      }),
    ]);

    const currentRoleMappings = await this.executeWithResilience<KeycloakRoleMapping[]>({
      method: 'GET',
      path:
        `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(serviceAccountUser.id)}` +
        `/role-mappings/clients/${encodePathSegment(realmManagementClient.id)}`,
      operation: 'list_service_account_client_roles',
    });

    const availableRoleNames = new Set(availableRoles.map((role) => role.name));
    const missingRequiredRoles = REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES.filter(
      (roleName) => !availableRoleNames.has(roleName)
    );
    if (missingRequiredRoles.length > 0) {
      throw new KeycloakAdminRequestError({
        message: `Missing required Keycloak realm-management roles: ${missingRequiredRoles.join(', ')}`,
        statusCode: 500,
        code: 'realm_management_role_missing',
        retryable: false,
      });
    }

    await this.reconcileTenantAdminServiceRoleMappings({
      availableRoles,
      currentRoleMappings,
      realmManagementClientId: realmManagementClient.id,
      serviceAccountUserId: serviceAccountUser.id,
    });
  }

  private async reconcileTenantAdminServiceRoleMappings(input: {
    readonly availableRoles: readonly KeycloakRoleMapping[];
    readonly currentRoleMappings: readonly KeycloakRoleMapping[];
    readonly realmManagementClientId: string;
    readonly serviceAccountUserId: string;
  }): Promise<void> {
    const currentRoleNames = new Set(input.currentRoleMappings.map((role) => role.name));
    const rolesToAdd = input.availableRoles
      .filter((role) =>
        REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES.includes(
          role.name as (typeof REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES)[number]
        )
      )
      .filter((role) => !currentRoleNames.has(role.name))
      .map((role) => ({ id: role.id, name: role.name }));
    const roleMappingsPath =
      `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(input.serviceAccountUserId)}` +
      `/role-mappings/clients/${encodePathSegment(input.realmManagementClientId)}`;

    if (rolesToAdd.length > 0) {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: roleMappingsPath,
        body: JSON.stringify(rolesToAdd),
        operation: 'grant_service_account_client_roles',
      });
    }

    const legacyClientWriteRole = input.currentRoleMappings.find(
      (role) => role.name === LEGACY_TENANT_ADMIN_CLIENT_ROLE_NAME
    );
    if (legacyClientWriteRole) {
      await this.executeWithResilience<void>({
        method: 'DELETE',
        path: roleMappingsPath,
        body: JSON.stringify([{ id: legacyClientWriteRole.id, name: legacyClientWriteRole.name }]),
        operation: 'revoke_service_account_client_roles',
      });
    }

    const [directRoleMappings, effectiveRoleMappings] = await Promise.all([
      this.executeWithResilience<KeycloakRoleMapping[]>({
        method: 'GET',
        path: roleMappingsPath,
        operation: 'verify_direct_service_account_client_roles',
      }),
      this.executeWithResilience<KeycloakRoleMapping[]>({
        method: 'GET',
        path: `${roleMappingsPath}/composite`,
        operation: 'verify_effective_service_account_client_roles',
      }),
    ]);

    if (!tenantAdminServiceRoleMappingsAreSafe(directRoleMappings, effectiveRoleMappings)) {
      throw new KeycloakAdminRequestError({
        message: 'Tenant admin service-account role reconciliation could not be verified.',
        statusCode: 500,
        code: 'tenant_admin_service_access_readback_failed',
        retryable: false,
      });
    }
  }
}
