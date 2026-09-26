import { KeycloakRoleOperations } from './roles.js';
import { KeycloakAdminUnavailableError } from './errors.js';
import {
  encodePathSegment,
  filterUserAttributes,
  logger,
  mapKeycloakUser,
  toRetryLogReason,
} from './helpers.js';
import type {
  KeycloakAdminUser,
  KeycloakListUsersQuery,
  KeycloakRoleMapping,
} from './internal-models.js';
import type { IdentityListedUser, IdentityUserAttributes } from '../identity-provider-port.js';

export class KeycloakUserReadOperations extends KeycloakRoleOperations {
  async getUserAttributes(
    externalId: string,
    attributeNames?: readonly string[]
  ): Promise<IdentityUserAttributes> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError('Keycloak unavailable; user list cannot be loaded.');
    }

    const user = await this.executeWithResilience<KeycloakAdminUser>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}`,
      operation: 'get_user_attributes',
    });

    return filterUserAttributes(user.attributes, attributeNames);
  }

  async listUsers(query?: KeycloakListUsersQuery): Promise<readonly IdentityListedUser[]> {
    if (this.isCircuitOpen()) {
      logger.error('Keycloak read blocked because circuit breaker is open', {
        operation: 'list_users',
        mode: 'fail_fast',
      });
      throw new KeycloakAdminUnavailableError('Keycloak unavailable; user list cannot be loaded.');
    }

    const searchParams = new URLSearchParams();
    for (const [key, value] of [
      ['first', query?.first],
      ['max', query?.max],
      ['enabled', query?.enabled],
      ['exact', query?.exact],
      ['briefRepresentation', query?.briefRepresentation],
    ] as const) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    for (const [key, value] of [
      ['search', query?.search],
      ['email', query?.email],
      ['username', query?.username],
    ] as const) {
      if (value) {
        searchParams.set(key, value);
      }
    }

    const querySuffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
    try {
      const users = await this.executeWithResilience<KeycloakAdminUser[]>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}/users${querySuffix}`,
        operation: 'list_users',
      });
      return users.map(mapKeycloakUser);
    } catch (error) {
      if (this.isRetryableError(error)) {
        logger.error('Keycloak read failed without fallback', {
          operation: 'list_users',
          mode: 'fail_fast',
          reason: toRetryLogReason(error),
        });
      }
      throw error;
    }
  }

  async countUsers(
    query?: Omit<KeycloakListUsersQuery, 'first' | 'max' | 'exact'>
  ): Promise<number> {
    if (this.isCircuitOpen()) {
      logger.error('Keycloak read blocked because circuit breaker is open', {
        operation: 'count_users',
        mode: 'fail_fast',
      });
      throw new KeycloakAdminUnavailableError('Keycloak unavailable; user count cannot be loaded.');
    }

    const searchParams = new URLSearchParams();
    if (query?.enabled !== undefined) {
      searchParams.set('enabled', String(query.enabled));
    }
    for (const [key, value] of [
      ['search', query?.search],
      ['email', query?.email],
      ['username', query?.username],
    ] as const) {
      if (value) {
        searchParams.set(key, value);
      }
    }

    const querySuffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
    try {
      const count = await this.executeWithResilience<number>({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}/users/count${querySuffix}`,
        operation: 'count_users',
      });
      return count;
    } catch (error) {
      if (this.isRetryableError(error)) {
        logger.error('Keycloak read failed without fallback', {
          operation: 'count_users',
          mode: 'fail_fast',
          reason: toRetryLogReason(error),
        });
      }
      throw error;
    }
  }

  protected async readUserRoleMappings(
    externalId: string,
    operation: string
  ): Promise<readonly KeycloakRoleMapping[]> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError(
        'Keycloak unavailable and user role mapping reads are temporarily disabled.'
      );
    }

    return this.executeWithResilience<KeycloakRoleMapping[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/role-mappings/realm`,
      operation,
    });
  }

  protected async readEffectiveUserRoleMappings(
    externalId: string
  ): Promise<readonly KeycloakRoleMapping[]> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError(
        'Keycloak unavailable and effective user role mapping reads are temporarily disabled.'
      );
    }

    return this.executeWithResilience<KeycloakRoleMapping[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/role-mappings/realm/composite`,
      operation: 'list_user_realm_roles_effective',
    });
  }

  async findUserByUsername(username: string): Promise<KeycloakAdminUser | null> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError(
        'Keycloak unavailable and user lookup is temporarily disabled.'
      );
    }

    const users = await this.executeWithResilience<KeycloakAdminUser[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users?exact=true&username=${encodeURIComponent(username)}`,
      operation: 'find_user_by_username',
    });

    const normalizedUsername = username.toLowerCase();
    return users.find((user) => user.username?.toLowerCase() === normalizedUsername) ?? null;
  }

  async findUserByEmail(email: string): Promise<KeycloakAdminUser | null> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError(
        'Keycloak unavailable and user lookup is temporarily disabled.'
      );
    }

    const users = await this.executeWithResilience<KeycloakAdminUser[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users?exact=true&email=${encodeURIComponent(email)}`,
      operation: 'find_user_by_email',
    });

    return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
  }
}
