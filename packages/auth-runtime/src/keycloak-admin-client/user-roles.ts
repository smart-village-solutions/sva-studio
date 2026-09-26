import { KeycloakUserWriteOperations } from './user-write.js';
import { KeycloakAdminRequestError } from './errors.js';
import {
  encodePathSegment,
  isBuiltInRealmRole,
  isStudioManagedRealmRole,
  mapKeycloakRole,
} from './helpers.js';
import type { KeycloakRealmRole, KeycloakRoleMapping } from './internal-models.js';
import type { IdentityRole } from '../identity-provider-port.js';

export class KeycloakUserRoleOperations extends KeycloakUserWriteOperations {
  async syncRoles(externalId: string, roles: readonly string[]): Promise<void> {
    await this.assertWriteAvailability();
    const expectedRoleNames = new Set(roles);
    const [currentRoleMappings, availableRoles] = await Promise.all([
      this.readUserRoleMappings(externalId, 'sync_roles_read_current'),
      this.listRoles(),
    ]);

    const currentByName = new Map(currentRoleMappings.map((role) => [role.name, role]));
    const availableByName = new Map(availableRoles.map((role) => [role.externalName, role]));

    const missingRoles = [...expectedRoleNames].filter(
      (roleName) => !availableByName.has(roleName)
    );
    if (missingRoles.length > 0) {
      throw new KeycloakAdminRequestError({
        message: `Unknown Keycloak roles: ${missingRoles.join(', ')}`,
        statusCode: 400,
        code: 'unknown_role',
        retryable: false,
      });
    }

    const toAdd = [...expectedRoleNames]
      .filter((roleName) => !currentByName.has(roleName))
      .map((roleName) => availableByName.get(roleName))
      .filter((role): role is IdentityRole => role !== undefined)
      .map((role): KeycloakRealmRole => ({
        id: role.id ?? role.externalName,
        name: role.externalName,
        description: role.description,
        attributes: role.attributes,
        composite: role.composite,
        clientRole: role.clientRole,
        containerId: role.containerId,
      }));

    // Keep Keycloak built-ins and any unmanaged realm roles untouched. Tenant sync only owns
    // Studio-managed realm roles, otherwise tenant-local defaults like offline_access would
    // be removed during ordinary user edits.
    const toRemove = currentRoleMappings.filter((role) => {
      if (expectedRoleNames.has(role.name)) {
        return false;
      }
      if (isBuiltInRealmRole(role.name)) {
        return false;
      }
      return isStudioManagedRealmRole(availableByName.get(role.name));
    });

    if (toAdd.length > 0) {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/role-mappings/realm`,
        body: JSON.stringify(toAdd),
        operation: 'sync_roles_add',
      });
    }

    if (toRemove.length > 0) {
      await this.executeWithResilience<void>({
        method: 'DELETE',
        path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/role-mappings/realm`,
        body: JSON.stringify(toRemove),
        operation: 'sync_roles_remove',
      });
    }
  }

  async assignRealmRoles(externalId: string, roles: readonly string[]): Promise<void> {
    await this.assertWriteAvailability();
    const uniqueRoleNames = [...new Set(roles)];
    if (uniqueRoleNames.length === 0) {
      return;
    }
    const availableRoles = await this.listRoles();
    const availableByName = new Map(availableRoles.map((role) => [role.externalName, role]));
    const roleMappings = uniqueRoleNames.map((roleName) => availableByName.get(roleName));
    const missingRoles = uniqueRoleNames.filter((_roleName, index) => !roleMappings[index]);
    if (missingRoles.length > 0) {
      throw new KeycloakAdminRequestError({
        message: `Unknown Keycloak roles: ${missingRoles.join(', ')}`,
        statusCode: 400,
        code: 'unknown_role',
        retryable: false,
      });
    }

    await this.executeWithResilience<void>({
      method: 'POST',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/role-mappings/realm`,
      body: JSON.stringify(
        roleMappings
          .filter((role): role is IdentityRole => role !== undefined)
          .map((role): KeycloakRealmRole => ({
            id: role.id ?? role.externalName,
            name: role.externalName,
            description: role.description,
            attributes: role.attributes,
            composite: role.composite,
            clientRole: role.clientRole,
            containerId: role.containerId,
          }))
      ),
      operation: 'assign_realm_roles',
    });
  }

  async removeRealmRoles(externalId: string, roles: readonly string[]): Promise<void> {
    await this.assertWriteAvailability();
    const roleNames = new Set(roles);
    if (roleNames.size === 0) {
      return;
    }
    const currentRoleMappings = await this.readUserRoleMappings(
      externalId,
      'remove_realm_roles_read_current'
    );
    const toRemove = currentRoleMappings.filter((role) => roleNames.has(role.name));
    if (toRemove.length === 0) {
      return;
    }

    await this.executeWithResilience<void>({
      method: 'DELETE',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/role-mappings/realm`,
      body: JSON.stringify(toRemove),
      operation: 'remove_realm_roles',
    });
  }

  async listUserRoleNames(externalId: string): Promise<readonly string[]> {
    const currentRoleMappings = await this.readUserRoleMappings(externalId, 'list_user_roles');
    return currentRoleMappings.map((role) => role.name);
  }

  async listUserRealmRoleAssignments(externalId: string) {
    const [direct, effective] = await Promise.all([
      this.readUserRoleMappings(externalId, 'list_user_realm_roles_direct'),
      this.readEffectiveUserRoleMappings(externalId),
    ]);

    return {
      direct: direct.map(mapKeycloakRole),
      effective: effective.map(mapKeycloakRole),
    };
  }
}
