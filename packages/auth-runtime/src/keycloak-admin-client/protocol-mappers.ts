import { KeycloakTenantAdminAccessOperations } from './tenant-admin-access.js';
import { KeycloakAdminRequestError } from './errors.js';
import { encodePathSegment } from './helpers.js';
import type {
  KeycloakProtocolMapperEvaluationRepresentation,
  KeycloakProtocolMapperRepresentation,
} from './internal-models.js';

export class KeycloakProtocolMapperOperations extends KeycloakTenantAdminAccessOperations {
  async listClientProtocolMappers(
    clientId: string
  ): Promise<readonly KeycloakProtocolMapperRepresentation[]> {
    const client = await this.getOidcClientByClientId(clientId);
    if (!client) {
      return [];
    }

    return this.executeWithResilience<KeycloakProtocolMapperRepresentation[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/protocol-mappers/models`,
      operation: 'list_protocol_mappers',
    });
  }

  async listEffectiveClientProtocolMappers(
    clientId: string
  ): Promise<readonly KeycloakProtocolMapperRepresentation[]> {
    const client = await this.getOidcClientByClientId(clientId);
    if (!client) return [];
    const evaluatedMappers = await this.executeWithResilience<
      KeycloakProtocolMapperEvaluationRepresentation[]
    >({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/evaluate-scopes/protocol-mappers`,
      operation: 'list_effective_protocol_mappers',
    });
    const directMappers = await this.executeWithResilience<KeycloakProtocolMapperRepresentation[]>({
      method: 'GET',
      path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/protocol-mappers/models`,
      operation: 'list_protocol_mappers',
    });
    const mappersById = new Map(directMappers.map((mapper) => [mapper.id, mapper]));
    const clientScopeIds = new Set(
      evaluatedMappers.flatMap((mapper) =>
        mapper.containerType === 'client-scope' && mapper.containerId ? [mapper.containerId] : []
      )
    );

    for (const clientScopeId of clientScopeIds) {
      const clientScopeMappers = await this.executeWithResilience<
        KeycloakProtocolMapperRepresentation[]
      >({
        method: 'GET',
        path: `/admin/realms/${encodePathSegment(this.realm)}/client-scopes/${encodePathSegment(clientScopeId)}/protocol-mappers/models`,
        operation: 'list_client_scope_protocol_mappers',
      });
      for (const mapper of clientScopeMappers) mappersById.set(mapper.id, mapper);
    }

    return evaluatedMappers.map((evaluatedMapper) => {
      const mapper = evaluatedMapper.mapperId
        ? mappersById.get(evaluatedMapper.mapperId)
        : undefined;
      if (!mapper) {
        throw new KeycloakAdminRequestError({
          message: 'Keycloak effective protocol mapper could not be resolved.',
          statusCode: 502,
          code: 'effective_protocol_mapper_unresolved',
          retryable: false,
        });
      }
      return mapper;
    });
  }

  async ensureUserAttributeProtocolMapper(input: {
    clientId: string;
    name: string;
    userAttribute: string;
    claimName: string;
    multivalued?: boolean;
    exclusiveClaim?: boolean;
  }): Promise<void> {
    await this.ensureProtocolMapper(
      input.clientId,
      {
        name: input.name,
        protocol: 'openid-connect',
        protocolMapper: 'oidc-usermodel-attribute-mapper',
        config: {
          'user.attribute': input.userAttribute,
          'claim.name': input.claimName,
          'jsonType.label': 'String',
          multivalued: input.multivalued ? 'true' : 'false',
          'id.token.claim': 'true',
          'access.token.claim': 'true',
          'userinfo.token.claim': 'true',
        },
      },
      input.exclusiveClaim
    );
  }

  async ensureAudienceProtocolMapper(input: {
    clientId: string;
    name: string;
    audience: string;
  }): Promise<void> {
    await this.ensureProtocolMapper(input.clientId, {
      name: input.name,
      protocol: 'openid-connect',
      protocolMapper: 'oidc-audience-mapper',
      config: {
        'included.client.audience': input.audience,
        'included.custom.audience': '',
        'id.token.claim': 'false',
        'access.token.claim': 'true',
        'lightweight.claim': 'false',
        'introspection.token.claim': 'true',
      },
    });
  }

  private async ensureProtocolMapper(
    clientId: string,
    payload: {
      name: string;
      protocol: string;
      protocolMapper: string;
      config: Readonly<Record<string, string>>;
    },
    exclusiveClaim = false
  ): Promise<void> {
    await this.assertWriteAvailability();
    const client = await this.getOidcClientByClientId(clientId);
    if (!client) {
      throw new KeycloakAdminRequestError({
        message: `Keycloak client ${clientId} is missing.`,
        statusCode: 404,
        code: 'client_not_found',
        retryable: false,
      });
    }

    const existingMappers = await this.listClientProtocolMappers(clientId);
    if (exclusiveClaim && payload.config['claim.name']) {
      for (const mapper of existingMappers) {
        if (
          mapper.name !== payload.name &&
          mapper.config?.['claim.name'] === payload.config['claim.name']
        ) {
          await this.executeWithResilience<void>({
            method: 'DELETE',
            path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/protocol-mappers/models/${encodePathSegment(mapper.id)}`,
            operation: 'delete_conflicting_claim_mapper',
          });
        }
      }
    }
    const existingMapper = existingMappers.find((mapper) => mapper.name === payload.name);

    if (!existingMapper) {
      await this.executeWithResilience<void>({
        method: 'POST',
        path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/protocol-mappers/models`,
        operation: 'create_protocol_mapper',
        body: JSON.stringify(payload),
      });
      return;
    }

    const existingConfig = existingMapper.config ?? {};
    const needsUpdate =
      existingMapper.protocol !== payload.protocol ||
      existingMapper.protocolMapper !== payload.protocolMapper ||
      Object.entries(payload.config).some(([key, value]) => existingConfig[key] !== value);

    if (!needsUpdate) {
      return;
    }

    await this.executeWithResilience<void>({
      method: 'PUT',
      path: `/admin/realms/${encodePathSegment(this.realm)}/clients/${encodePathSegment(client.id)}/protocol-mappers/models/${encodePathSegment(existingMapper.id)}`,
      operation: 'update_protocol_mapper',
      body: JSON.stringify({
        ...existingMapper,
        ...payload,
      }),
    });
  }
}
