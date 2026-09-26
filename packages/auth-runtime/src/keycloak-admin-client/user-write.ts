import { KeycloakUserReadOperations } from './user-read.js';
import { KeycloakAdminRequestError } from './errors.js';
import {
  encodePathSegment,
  logKeycloakWriteFailure,
  logKeycloakWriteSuccess,
  normalizeAttributes,
  parseLocationHeader,
} from './helpers.js';
import type { KeycloakUserCreateResponse } from './internal-models.js';
import type {
  CreateIdentityUserInput,
  IdentityUser,
  UpdateIdentityUserInput,
} from '../identity-provider-port.js';

export class KeycloakUserWriteOperations extends KeycloakUserReadOperations {
  async createUser(input: CreateIdentityUserInput): Promise<IdentityUser> {
    await this.assertWriteAvailability();
    const payload = {
      username: input.username ?? input.email,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: input.enabled ?? true,
      attributes: normalizeAttributes(input.attributes),
    };

    const response = await this.executeWithResilience<KeycloakUserCreateResponse>({
      method: 'POST',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users`,
      body: JSON.stringify(payload),
      operation: 'create_user',
    });

    const externalId = parseLocationHeader(response.location);
    if (!externalId) {
      throw new KeycloakAdminRequestError({
        message: 'Keycloak user creation succeeded without location header',
        statusCode: 502,
        code: 'missing_location_header',
        retryable: false,
      });
    }

    return { externalId };
  }

  async executeActionsEmail(
    externalId: string,
    input: {
      readonly actions: readonly string[];
      readonly clientId?: string;
      readonly redirectUri?: string;
      readonly lifespan?: number;
    }
  ): Promise<void> {
    await this.assertWriteAvailability();
    const params = new URLSearchParams();
    if (input.clientId) {
      params.set('client_id', input.clientId);
    }
    if (input.redirectUri) {
      params.set('redirect_uri', input.redirectUri);
    }
    if (typeof input.lifespan === 'number') {
      params.set('lifespan', String(input.lifespan));
    }

    const query = params.toString();
    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/execute-actions-email${
        query.length > 0 ? `?${query}` : ''
      }`,
      body: JSON.stringify([...input.actions]),
      operation: 'execute_actions_email',
    });
  }

  async updateUser(externalId: string, input: UpdateIdentityUserInput): Promise<void> {
    await this.assertWriteAvailability();
    const payload = {
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: input.enabled,
      attributes: normalizeAttributes(input.attributes),
    };

    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}`,
      body: JSON.stringify(payload),
      operation: 'update_user',
    });
  }

  async deactivateUser(externalId: string): Promise<void> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}`,
      body: JSON.stringify({ enabled: false }),
      operation: 'deactivate_user',
    });
  }

  async deleteUser(externalId: string): Promise<void> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'DELETE',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}`,
      operation: 'delete_user',
    });
  }

  async logoutUser(externalId: string): Promise<void> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'POST',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/logout`,
      operation: 'logout_user',
    });
  }

  async setUserPassword(externalId: string, password: string, temporary = true): Promise<void> {
    await this.assertWriteAvailability();
    try {
      await this.executeWithResilience<void>({
        method: 'PUT',
        path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}/reset-password`,
        operation: 'reset_user_password',
        body: JSON.stringify({
          type: 'password',
          value: password,
          temporary,
        }),
      });
      logKeycloakWriteSuccess('reset_user_password', {
        operation: 'reset_user_password',
        realm: this.realm,
        temporary,
      });
    } catch (error) {
      logKeycloakWriteFailure(
        'reset_user_password_failed',
        {
          operation: 'reset_user_password',
          realm: this.realm,
          temporary,
        },
        error
      );
      throw error;
    }
  }

  async setUserRequiredActions(
    externalId: string,
    requiredActions: readonly string[]
  ): Promise<void> {
    await this.assertWriteAvailability();
    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}`,
      operation: 'set_user_required_actions',
      body: JSON.stringify({
        requiredActions: [...requiredActions],
      }),
    });
  }
}
