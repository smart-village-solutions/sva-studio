import { parse as parseCookie } from 'cookie-es';
import { createSdkLogger } from '@sva/server-runtime';

import { createApiError } from './api-error.js';
import { shouldEnforceLegalTextCompliance } from './middleware-compliance.js';
import {
  ensureAccountLifecycleAllowsAccess,
  logComplianceDiagnosticsIfEnabled,
  logProfileDiagnosticsIfEnabled,
  logUnexpectedMiddlewareError,
} from './middleware-guards.js';
import { withLegalTextCompliance } from './legal-text-enforcement.js';
import {
  resolveSessionUser as resolveRuntimeSessionUser,
  validateTenantHost,
} from './middleware-hosts.js';
import { resolveSessionUser as resolveStoredSessionUser } from './auth-server/session.js';
import { getAuthConfig } from './config.js';
import { buildLogContext } from './log-context.js';
import { createMockSessionUser, hasActiveMockAuthSession, isMockAuthEnabled } from './mock-auth.js';
import type { SessionUser } from './types.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

export type AuthenticatedRequestContext = {
  sessionId: string;
  sessionExpiresAt?: number;
  freshReauthAt?: number;
  isLocalDevelopmentAuth?: boolean;
  user: SessionUser;
};

type SessionResolution =
  | {
      kind: 'authenticated';
      sessionId: string;
      sessionExpiresAt?: number;
      freshReauthAt?: number;
      isLocalDevelopmentAuth?: boolean;
      user: SessionUser;
    }
  | { kind: 'response'; response: Response };

const readSessionId = (request: Request) => {
  const { sessionCookieName } = getAuthConfig();
  const cookies = parseCookie(request.headers.get('cookie') ?? '');
  return cookies[sessionCookieName];
};

const createAuthenticatedContext = async (request: Request): Promise<SessionResolution> => {
  const tenantHostError = await validateTenantHost(request);
  if (tenantHostError) {
    return { kind: 'response', response: tenantHostError };
  }

  if (isMockAuthEnabled() && hasActiveMockAuthSession(request)) {
    return {
      kind: 'authenticated',
      isLocalDevelopmentAuth: true,
      sessionId: 'mock-auth-session',
      user: createMockSessionUser(),
    };
  }

  const sessionId = readSessionId(request);
  if (!sessionId) {
    const requestId = buildLogContext(undefined, { includeTraceId: true }).request_id;
    logger.debug('Auth middleware rejected request without session cookie', {
      endpoint: request.url,
      auth_state: 'unauthenticated',
      operation: 'auth_middleware',
      reason_code: 'missing_session_cookie',
      request_id: requestId,
      ...buildLogContext(undefined, { includeTraceId: true }),
    });
    return {
      kind: 'response',
      response: createApiError(401, 'unauthorized', 'Anmeldung erforderlich.', requestId, {
        reason_code: 'missing_session_cookie',
      }),
    };
  }

  const sessionResolution = await resolveStoredSessionUser(sessionId);
  if (sessionResolution.kind === 'invalid') {
    const logContext = buildLogContext(undefined, { includeTraceId: true });
    const invalidSessionMessage =
      sessionResolution.reason === 'forced_reauth'
        ? 'Auth middleware rejected request because the session requires reauthentication'
        : 'Auth middleware rejected request with invalid session';
    logger.warn(invalidSessionMessage, {
      endpoint: request.url,
      auth_state: 'invalid_session',
      session_exists: true,
      user_exists: false,
      operation: 'auth_middleware',
      reason_code: sessionResolution.reason,
      ...logContext,
    });
    return {
      kind: 'response',
      response: createApiError(
        401,
        'unauthorized',
        'Die Sitzung ist nicht mehr gültig.',
        logContext.request_id,
        {
          reason_code: sessionResolution.reason,
        }
      ),
    };
  }

  if (!sessionResolution.user) {
    const logContext = buildLogContext(undefined, { includeTraceId: true });
    logger.warn('Auth middleware rejected request with unresolved session user', {
      endpoint: request.url,
      auth_state: 'invalid_session',
      operation: 'auth_middleware',
      reason_code: 'invalid_session',
      ...logContext,
    });
    return {
      kind: 'response',
      response: createApiError(
        401,
        'unauthorized',
        'Die Sitzung ist nicht mehr gültig.',
        logContext.request_id,
        {
          reason_code: 'invalid_session',
        }
      ),
    };
  }

  return {
    kind: 'authenticated',
    freshReauthAt: sessionResolution.freshReauthAt,
    sessionId,
    sessionExpiresAt: sessionResolution.expiresAt,
    user: await resolveRuntimeSessionUser(request, sessionResolution.user),
  };
};

const createProtectedHandler =
  (
    ctx: AuthenticatedRequestContext,
    handler: (ctx: AuthenticatedRequestContext) => Promise<Response> | Response
  ): (() => Promise<Response>) =>
  async () =>
    handler(ctx);

const runWithLegalTextComplianceIfRequired = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  handler: (ctx: AuthenticatedRequestContext) => Promise<Response> | Response
): Promise<Response> => {
  const runHandler = createProtectedHandler(ctx, handler);
  if (!ctx.user.instanceId || !(await shouldEnforceLegalTextCompliance(request))) {
    return runHandler();
  }

  const requestUrl = new URL(request.url);
  logComplianceDiagnosticsIfEnabled(request, ctx.user);

  return withLegalTextCompliance(ctx.user.instanceId, ctx.user.id, runHandler, {
    returnTo: `${requestUrl.pathname}${requestUrl.search}`,
  });
};

/**
 * Middleware helper that resolves an authenticated user from the current request.
 */
export const withAuthenticatedUser = async (
  request: Request,
  handler: (ctx: AuthenticatedRequestContext) => Promise<Response> | Response
): Promise<Response> => {
  try {
    const resolution = await createAuthenticatedContext(request);
    if (resolution.kind === 'response') {
      return resolution.response;
    }

    const ctx = {
      sessionId: resolution.sessionId,
      sessionExpiresAt: resolution.sessionExpiresAt,
      freshReauthAt: resolution.freshReauthAt,
      isLocalDevelopmentAuth: resolution.isLocalDevelopmentAuth,
      user: resolution.user,
    };
    const lifecycleResponse = await ensureAccountLifecycleAllowsAccess(request, ctx.user, {
      isLocalDevelopmentAuth: ctx.isLocalDevelopmentAuth,
    });
    if (lifecycleResponse) {
      return lifecycleResponse;
    }
    logProfileDiagnosticsIfEnabled(request, ctx.user);
    return await runWithLegalTextComplianceIfRequired(request, ctx, handler);
  } catch (error) {
    return logUnexpectedMiddlewareError(request, error);
  }
};
