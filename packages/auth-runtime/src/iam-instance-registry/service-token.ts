import type { JWTPayload, JWTVerifyGetKey } from 'jose';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { buildLogContext } from '../log-context.js';
import {
  getRemoteServiceJwks,
  isServiceIdentityProviderUnavailable,
  readBearerToken,
  readServiceTokenClientActions,
  readServiceTokenStringArray,
  verifyServiceJwt,
  type ServiceTokenVerificationConfig,
} from '../service-token.js';

import type { RegistryActionId, RegistryServiceContext } from './auth-context.js';

const DEFAULT_CLIENT_ID = 'sva-studio-mcp';
const PLATFORM_ROLE = 'instance_registry_admin';

export type ServiceTokenConfig = ServiceTokenVerificationConfig;

type ServiceTokenVerifier = (token: string, config: ServiceTokenConfig) => Promise<JWTPayload>;

const authenticatedServiceRequests = new WeakSet<Request>();

export const markAuthenticatedRegistryServiceRequest = (request: Request): void => {
  authenticatedServiceRequests.add(request);
};

export const isAuthenticatedRegistryServiceRequest = (request: Request): boolean =>
  authenticatedServiceRequests.has(request);

export const verifyRegistryServiceJwt = async (
  token: string,
  config: ServiceTokenConfig,
  getKey: JWTVerifyGetKey = getRemoteServiceJwks(config.issuer)
): Promise<JWTPayload> => verifyServiceJwt(token, config, getKey);

const verifyServiceToken: ServiceTokenVerifier = verifyRegistryServiceJwt;

const readConfig = (): ServiceTokenConfig | null => {
  if (process.env.SVA_STUDIO_MCP_ENABLED !== 'true') return null;
  const issuer = process.env.SVA_STUDIO_MCP_ISSUER?.replace(/\/$/u, '');
  if (!issuer) return null;
  return {
    issuer,
    audience: process.env.SVA_STUDIO_MCP_AUDIENCE ?? DEFAULT_CLIENT_ID,
    clientId: process.env.SVA_STUDIO_MCP_CLIENT_ID ?? DEFAULT_CLIENT_ID,
  };
};

const createAuthError = (status: number, code: string, reasonCode: string): Response => {
  const requestId = buildLogContext('platform', { includeTraceId: true }).request_id;
  return createApiError(
    status,
    code as Parameters<typeof createApiError>[1],
    'Service-Authentisierung fehlgeschlagen.',
    requestId,
    {
      reason_code: reasonCode,
    }
  );
};

export type RegistryServiceTokenResolution =
  | { readonly kind: 'authenticated'; readonly context: RegistryServiceContext }
  | { readonly kind: 'response'; readonly response: Response };

export const authenticateRegistryServiceToken = async (
  token: string,
  actionId: RegistryActionId,
  verifier: ServiceTokenVerifier = verifyServiceToken
): Promise<RegistryServiceTokenResolution> => {
  const config = readConfig();
  if (!config) {
    return {
      kind: 'response',
      response: createAuthError(
        503,
        'identity_provider_unavailable',
        'service_token_not_configured'
      ),
    };
  }

  try {
    const payload = await verifier(token, config);
    if (
      payload.azp !== config.clientId ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0
    ) {
      return {
        kind: 'response',
        response: createAuthError(401, 'invalid_service_token', 'invalid_service_token'),
      };
    }

    const realmRoles = readServiceTokenStringArray(
      (payload.realm_access as { roles?: unknown } | undefined)?.roles
    );
    if (!realmRoles.includes(PLATFORM_ROLE)) {
      return {
        kind: 'response',
        response: createAuthError(403, 'missing_platform_role', 'missing_platform_role'),
      };
    }

    const clientRoles = readServiceTokenClientActions(payload, config.clientId);
    if (!clientRoles.includes(actionId)) {
      return {
        kind: 'response',
        response: createAuthError(403, 'missing_action_scope', 'missing_action_scope'),
      };
    }

    return {
      kind: 'authenticated',
      context: {
        authKind: 'keycloak_service',
        actionId,
        user: { id: `keycloak-service:${payload.sub}`, roles: [...realmRoles] },
      },
    };
  } catch (error) {
    return {
      kind: 'response',
      response: isServiceIdentityProviderUnavailable(error)
        ? createAuthError(503, 'identity_provider_unavailable', 'identity_provider_unavailable')
        : createAuthError(401, 'invalid_service_token', 'invalid_service_token'),
    };
  }
};

export { readBearerToken };
