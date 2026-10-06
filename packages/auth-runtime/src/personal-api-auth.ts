import { errors, jwtVerify, type JWTPayload } from 'jose';
import { getWorkspaceContext } from '@sva/server-runtime';

import { resolvePersonalApiAuthBinding } from './config-request.js';
import { createApiError } from './api-error.js';
import { buildSessionUser } from './auth-server/shared.js';
import { enrichSessionUserWithEffectiveRoles } from './effective-session-roles.js';
import { isServiceIdentityProviderUnavailable, getRemoteServiceJwks } from './service-token.js';
import { resolveSessionUser } from './middleware-hosts.js';
import { markPersonalApiRequestAuthenticated } from './personal-api-request-state.js';

const PERSONAL_MCP_CLIENT_ID = 'sva-studio-mcp-personal';

const unauthorized = () =>
  createApiError(
    401,
    'unauthorized',
    'Persönliche API-Anmeldung ungültig.',
    getWorkspaceContext().requestId,
    {
      reason_code: 'personal_api_token_invalid',
    }
  );

export const authenticatePersonalApiRequest = async (
  request: Request
): Promise<
  | { readonly user: Awaited<ReturnType<typeof resolveSessionUser>>; readonly expiresAt: number }
  | Response
> => {
  const authorization = request.headers.get('authorization');
  const match = authorization && /^Bearer ([^\s]+)$/u.exec(authorization);
  if (!match?.[1]) return unauthorized();

  try {
    const binding = await resolvePersonalApiAuthBinding(request);
    const { payload } = await jwtVerify(match[1], getRemoteServiceJwks(binding.issuer), {
      issuer: binding.issuer,
      audience: binding.audience,
      algorithms: ['RS256'],
    });
    if (
      payload.azp !== PERSONAL_MCP_CLIENT_ID ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      typeof payload.exp !== 'number'
    ) {
      return unauthorized();
    }

    const claims: JWTPayload = { ...payload };
    const rawUser = buildSessionUser({
      claims,
      clientId: binding.audience,
      scope: binding.scope,
    });
    const hostBoundUser = await resolveSessionUser(request, rawUser);
    const user = await enrichSessionUserWithEffectiveRoles(hostBoundUser);
    markPersonalApiRequestAuthenticated(request);
    return { user, expiresAt: payload.exp * 1000 };
  } catch (error) {
    if (isServiceIdentityProviderUnavailable(error) || error instanceof TypeError) {
      return createApiError(
        503,
        'identity_provider_unavailable',
        'Anmeldedienst ist vorübergehend nicht erreichbar.',
        getWorkspaceContext().requestId,
        {
          reason_code: 'personal_api_identity_provider_unavailable',
        }
      );
    }
    if (error instanceof errors.JOSEError) {
      return unauthorized();
    }
    throw error;
  }
};
