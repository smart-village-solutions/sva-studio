import { KeycloakRealmOperations } from './realm.js';
import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from './errors.js';
import {
  canReconcileStudioManagedRole,
  encodePathSegment,
  isBuiltInRealmRole,
  isStudioManagedRealmRole,
  logger,
  mapKeycloakRole,
  normalizeManagedRoleAttributes,
  readRoleAttribute,
  toRetryLogReason,
} from './helpers.js';
import type { KeycloakListRolesQuery, KeycloakRealmRole } from './internal-models.js';
import type {
  CreateIdentityRoleInput,
  IdentityRole,
  UpdateIdentityRoleInput,
} from '../identity-provider-port.js';

export class KeycloakRoleOperations extends KeycloakRealmOperations {
  async listRoles(query?: KeycloakListRolesQuery): Promise<readonly IdentityRole[]> {
    if (this.isCircuitOpen()) {
      logger.error('Keycloak read blocked because circuit breaker is open', {
        operation: 'list_roles',
        mode: 'fail_fast',
      });
      throw new KeycloakAdminUnavailableError('Keycloak unavailable; role list cannot be loaded.');
    }

    const searchParams = new URLSearchParams();
    for (const [key, value] of [
      ['first', query?.first],
      ['max', query?.max],
    ] as const) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    if (query?.search) {
      searchParams.set('search', query.search);
    }
    if (query?.briefRepresentation !== undefined) {
      searchParams.set('briefRepresentation', String(query.briefRepresentation));
    }
    const querySuffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';

    try {
      const roles = await this.executeWithResilience<KeycloakRealmRole[]>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}/roles${querySuffix}`,
        operation: 'list_roles',
      });
      return roles.map(mapKeycloakRole);
    } catch (error) {
      if (this.isRetryableError(error)) {
        logger.error('Keycloak read failed without fallback', {
          operation: 'list_roles',
          mode: 'fail_fast',
          reason: toRetryLogReason(error),
        });
      }
      throw error;
    }
  }

  async getRoleByName(externalName: string): Promise<IdentityRole | null> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError(
        'Keycloak unavailable and role lookup is temporarily disabled.'
      );
    }

    try {
      const role = await this.executeWithResilience<KeycloakRealmRole>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}/roles/${encodePathSegment(externalName)}`,
        operation: 'get_role_by_name',
      });
      return {
        id: role.id,
        externalName: role.name,
        description: role.description,
        attributes: role.attributes,
        composite: role.composite,
        clientRole: role.clientRole,
        containerId: role.containerId,
      };
    } catch (error) {
      if (error instanceof KeycloakAdminRequestError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async createRole(
    input: CreateIdentityRoleInput,
    options: { readonly allowLegacyRealmRoleMigration?: boolean } = {}
  ): Promise<IdentityRole> {
    await this.assertWriteAvailability();
    try {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: `/admin/realms/${encodePathSegment(this.realm)}/roles`,
        body: JSON.stringify({
          name: input.externalName,
          description: input.description,
          attributes: normalizeManagedRoleAttributes({
            managed_by: input.attributes.managedBy,
            instance_id: input.attributes.instanceId,
            role_key: input.attributes.roleKey,
            display_name: input.attributes.displayName,
          }),
        }),
        operation: 'create_role',
      });
    } catch (error) {
      if (!(error instanceof KeycloakAdminRequestError) || error.statusCode !== 409) {
        throw error;
      }

      const existing = await this.getRoleByName(input.externalName);
      if (!existing) {
        throw error;
      }

      if (
        !canReconcileStudioManagedRole(
          existing,
          input,
          this.realm,
          options.allowLegacyRealmRoleMigration === true
        )
      ) {
        throw error;
      }

      return this.updateRole(input.externalName, {
        description: input.description,
        attributes: input.attributes,
      });
    }

    const created = await this.getRoleByName(input.externalName);
    if (!created) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak role creation succeeded but role lookup failed afterwards',
        statusCode: 502,
        code: 'role_lookup_failed',
        retryable: false,
      });
    }
    return created;
  }

  async updateRole(externalName: string, input: UpdateIdentityRoleInput): Promise<IdentityRole> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}/roles/${encodePathSegment(externalName)}`,
      body: JSON.stringify({
        name: externalName,
        description: input.description,
        attributes: normalizeManagedRoleAttributes({
          managed_by: input.attributes.managedBy,
          instance_id: input.attributes.instanceId,
          role_key: input.attributes.roleKey,
          display_name: input.attributes.displayName,
        }),
      }),
      operation: 'update_role',
    });

    const updated = await this.getRoleByName(externalName);
    if (!updated) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak role update succeeded but role lookup failed afterwards',
        statusCode: 502,
        code: 'role_lookup_failed',
        retryable: false,
      });
    }
    return updated;
  }

  async deleteRole(externalName: string): Promise<void> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'DELETE',
      path: `/admin/realms/${encodePathSegment(this.realm)}/roles/${encodePathSegment(externalName)}`,
      operation: 'delete_role',
    });
  }

  async ensureRealmRole(
    externalName: string,
    instanceId?: string,
    options: { readonly allowLegacyRealmRoleMigration?: boolean } = {}
  ): Promise<void> {
    const existing = await this.getRoleByName(externalName);
    if (existing) {
      if (!instanceId) {
        return;
      }
      const attributes = existing.attributes;
      const managedBy = readRoleAttribute(attributes, 'managed_by');
      const boundInstanceId = readRoleAttribute(attributes, 'instance_id');
      const roleKey = readRoleAttribute(attributes, 'role_key');
      const displayName = readRoleAttribute(attributes, 'display_name');
      const metadataMatches =
        managedBy === 'studio' && boundInstanceId === instanceId && roleKey === externalName;
      if (!metadataMatches) {
        const isLegacyRealmBoundRole =
          options.allowLegacyRealmRoleMigration === true &&
          managedBy === 'studio' &&
          boundInstanceId === this.realm &&
          roleKey === externalName;
        if (!isLegacyRealmBoundRole) {
          throw new KeycloakAdminRequestError({
            message: `Keycloak role ${externalName} has conflicting or incomplete Studio ownership metadata.`,
            statusCode: 409,
            code: 'role_ownership_conflict',
            retryable: false,
          });
        }
        await this.updateRole(externalName, {
          description: existing.description,
          attributes: {
            managedBy: 'studio',
            instanceId,
            roleKey: externalName,
            displayName: displayName ?? externalName,
          },
        });
      }
      return;
    }
    await this.createRole(
      {
        externalName,
        attributes: {
          managedBy: 'studio',
          instanceId: instanceId ?? this.realm,
          roleKey: externalName,
          displayName: externalName,
        },
      },
      options
    );
  }
}
