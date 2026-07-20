import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { buildLogContext } from '../log-context.js';

import type { RegistryActionId, RegistryServiceContext } from './auth-context.js';

const DEFAULT_CLIENT_ID = 'sva-studio-mcp';
const PLATFORM_ROLE = 'instance_registry_admin';

export type ServiceTokenConfig = {
  readonly issuer: string;
  readonly audience: string;
  readonly clientId: string;
};

type ServiceTokenVerifier = (
  token: string,
  config: ServiceTokenConfig
) => Promise<JWTPayload>;

const remoteJwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const authenticatedServiceRequests = new WeakSet<Request>();

export const markAuthenticatedRegistryServiceRequest = (request: Request): void => {
  authenticatedServiceRequests.add(request);
};

export const isAuthenticatedRegistryServiceRequest = (request: Request): boolean =>
  authenticatedServiceRequests.has(request);

const getRemoteJwks = (issuer: string): ReturnType<typeof createRemoteJWKSet> => {
  const existing = remoteJwksByIssuer.get(issuer);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(new URL(`${issuer.replace(/\/$/u, '')}/protocol/openid-connect/certs`));
  remoteJwksByIssuer.set(issuer, jwks);
  return jwks;
};

export const verifyRegistryServiceJwt = async (
  token: string,
  config: ServiceTokenConfig,
  getKey: JWTVerifyGetKey = getRemoteJwks(config.issuer)
): Promise<JWTPayload> => {
  const result = await jwtVerify(token, getKey, {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ['RS256'],
  });
  if (typeof result.payload.exp !== 'number') {
    throw new Error('service_token_exp_required');
  }
  return result.payload;
};

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

const readStringArray = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const createAuthError = (status: number, code: string, reasonCode: string): Response => {
  const requestId = buildLogContext('platform', { includeTraceId: true }).request_id;
  return createApiError(status, code as Parameters<typeof createApiError>[1], 'Service-Authentisierung fehlgeschlagen.', requestId, {
    reason_code: reasonCode,
  });
};

const isIdentityProviderUnavailable = (error: unknown): boolean =>
  error instanceof TypeError || error instanceof errors.JWKSTimeout;

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
    return { kind: 'response', response: createAuthError(503, 'identity_provider_unavailable', 'service_token_not_configured') };
  }

  try {
    const payload = await verifier(token, config);
    if (payload.azp !== config.clientId || typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return { kind: 'response', response: createAuthError(401, 'invalid_service_token', 'invalid_service_token') };
    }

    const realmRoles = readStringArray((payload.realm_access as { roles?: unknown } | undefined)?.roles);
    if (!realmRoles.includes(PLATFORM_ROLE)) {
      return { kind: 'response', response: createAuthError(403, 'missing_platform_role', 'missing_platform_role') };
    }

    const clientRoles = readStringArray(
      (payload.resource_access as Record<string, { roles?: unknown }> | undefined)?.[config.clientId]?.roles
    );
    if (!clientRoles.includes(actionId)) {
      return { kind: 'response', response: createAuthError(403, 'missing_action_scope', 'missing_action_scope') };
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
      response: isIdentityProviderUnavailable(error)
        ? createAuthError(503, 'identity_provider_unavailable', 'identity_provider_unavailable')
        : createAuthError(401, 'invalid_service_token', 'invalid_service_token'),
    };
  }
};

export const readBearerToken = (request: Request): string | null | undefined => {
  const authorization = request.headers.get('authorization');
  if (authorization === null) return undefined;
  const match = /^Bearer ([^\s]+)$/u.exec(authorization);
  return match?.[1] ?? null;
};
