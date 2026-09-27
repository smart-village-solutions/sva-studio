import { KeycloakUserRoleOperations } from './user-roles.js';
import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from './errors.js';
import {
  encodePathSegment,
  logKeycloakWriteFailure,
  logKeycloakWriteSuccess,
  parseLocationHeader,
} from './helpers.js';
import type { KeycloakUserCreateResponse } from './internal-models.js';
import {
  reconcileOidcClient,
  setOidcClientEnabled as reconcileOidcClientEnabled,
  type EnsureOidcClientInput,
  type KeycloakOidcClientOperations as OidcClientReconciliationOperations,
  type KeycloakOidcClientRepresentation as KeycloakClientRepresentation,
} from './oidc-client-reconciliation.js';

export class KeycloakOidcClientOperations extends KeycloakUserRoleOperations {
  async getOidcClientByClientId(clientId: string): Promise<KeycloakClientRepresentation | null> {
    if (this.isCircuitOpen()) {
      throw new KeycloakAdminUnavailableError(
        'Keycloak unavailable and client lookup is temporarily disabled.'
      );
    }

    const query = await this.executeWithResilience<KeycloakClientRepresentation[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/clients?clientId=${encodeURIComponent(clientId)}`,
      operation: 'find_client',
    });

    return query[0] ?? null;
  }

  async getOidcClientSecretValue(clientId: string): Promise<string | null> {
    const client = await this.getOidcClientByClientId(clientId);
    if (!client) {
      return null;
    }

    const response = await this.executeWithResilience<{ value?: string }>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/client-secret`,
      operation: 'get_client_secret',
    });

    return typeof response.value === 'string' && response.value.length > 0 ? response.value : null;
  }

  async ensureOidcClient(input: EnsureOidcClientInput): Promise<void> {
    return reconcileOidcClient(this.oidcClientOperations(), input);
  }

  async setOidcClientEnabled(clientId: string, enabled: boolean): Promise<void> {
    return reconcileOidcClientEnabled(this.oidcClientOperations(), clientId, enabled);
  }

  private oidcClientOperations(): OidcClientReconciliationOperations {
    return {
      assertWriteAvailability: () => this.assertWriteAvailability(),
      findClient: (clientId) => this.getOidcClientByClientId(clientId),
      createClient: (payload, clientId) => this.createOidcClient(payload, clientId),
      updateClient: (existing, payload, clientId) =>
        this.updateOidcClient(existing, payload, clientId),
      deleteClientForCompensation: (clientId, displayClientId) =>
        this.deleteOidcClientForCompensation(clientId, displayClientId),
      logCompensationFailure: (clientId, error) =>
        logKeycloakWriteFailure(
          'delete_client_failed',
          { operation: 'delete_client', realm: this.realm, client_id: clientId },
          error
        ),
      getClientSecretValue: (clientId) => this.getOidcClientSecretValue(clientId),
      rotateClientSecret: (client, input) => this.rotateOidcClientSecret(client, input),
    };
  }

  private async createOidcClient(payload: object, clientId: string): Promise<string | null> {
    try {
      const response = await this.executeWithResilience<KeycloakUserCreateResponse>({
        method: 'POST',
        path: `/admin/realms/${encodePathSegment(this.realm)}/clients`,
        operation: 'create_client',
        body: JSON.stringify(payload),
      });
      logKeycloakWriteSuccess('create_client', {
        operation: 'create_client',
        realm: this.realm,
        client_id: clientId,
      });
      return parseLocationHeader(response?.location ?? null);
    } catch (error) {
      logKeycloakWriteFailure(
        'create_client_failed',
        { operation: 'create_client', realm: this.realm, client_id: clientId },
        error
      );
      throw error;
    }
  }

  private async updateOidcClient(
    existing: KeycloakClientRepresentation,
    payload: object,
    clientId: string
  ): Promise<void> {
    try {
      await this.executeWithResilience<void>({
        method: 'PUT',
        path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(existing.id)}`,
        operation: 'update_client',
        body: JSON.stringify({
          ...existing,
          ...payload,
        }),
      });
      logKeycloakWriteSuccess('update_client', {
        operation: 'update_client',
        realm: this.realm,
        client_id: clientId,
      });
    } catch (error) {
      logKeycloakWriteFailure(
        'update_client_failed',
        { operation: 'update_client', realm: this.realm, client_id: clientId },
        error
      );
      throw error;
    }
  }

  private async deleteOidcClientForCompensation(
    createdClientId: string,
    clientId: string
  ): Promise<void> {
    try {
      // Compensation must remain available after the repair failure opens the
      // normal request circuit, while retaining normal transient-failure retries.
      await this.executeWithRetryPolicy<void>(
        {
          method: 'DELETE',
          path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(createdClientId)}`,
          operation: 'delete_client',
        },
        false
      );
    } catch (error) {
      if (!(error instanceof KeycloakAdminRequestError) || error.statusCode !== 404) {
        logKeycloakWriteFailure(
          'delete_client_failed',
          { operation: 'delete_client', realm: this.realm, client_id: clientId },
          error
        );
        throw error;
      }
    }
    // A successful authenticated cleanup, including an already deleted client,
    // proves Keycloak is reachable again and keeps outer compensation usable.
    this.markSuccess();
    logKeycloakWriteSuccess('delete_client', {
      operation: 'delete_client',
      realm: this.realm,
      client_id: clientId,
    });
  }

  private async rotateOidcClientSecret(
    client: KeycloakClientRepresentation,
    input: Pick<EnsureOidcClientInput, 'clientId' | 'clientSecret' | 'rotateClientSecret'>
  ): Promise<void> {
    const logEvent = input.rotateClientSecret ? 'rotate_client_secret' : 'sync_client_secret';
    const logFailureEvent = input.rotateClientSecret
      ? 'rotate_client_secret_failed'
      : 'sync_client_secret_failed';
    try {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/client-secret`,
        operation: 'rotate_client_secret',
        body: JSON.stringify({
          type: 'secret',
          ...(input.clientSecret !== undefined ? { value: input.clientSecret } : {}),
        }),
      });
      logKeycloakWriteSuccess(logEvent, {
        operation: 'rotate_client_secret',
        realm: this.realm,
        client_id: input.clientId,
      });
    } catch (error) {
      logKeycloakWriteFailure(
        logFailureEvent,
        { operation: 'rotate_client_secret', realm: this.realm, client_id: input.clientId },
        error
      );
      throw error;
    }
  }
}
