import { parse as parseCookie } from 'cookie-es';
import { createSdkLogger } from '@sva/server-runtime';

import { createApiError } from './api-error.js';
import { shouldEnforceLegalTextCompliance } from './middleware-compliance.js';
import { withLegalTextCompliance } from './legal-text-enforcement.js';
import {
  resolveSessionUser as resolveRuntimeSessionUser,
  validateTenantHost,
} from './middleware-hosts.js';
import { resolveSessionUser as resolveStoredSessionUser } from './auth-server/session.js';
import { getAuthConfig } from './config.js';
import { buildLogContext } from './log-context.js';
import { createMockSessionUser, isMockAuthEnabled } from './mock-auth.js';
import { SessionStoreUnavailableError, SessionUserHydrationError } from './runtime-errors.js';
import type { SessionUser } from './types.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

export type AuthenticatedRequestContext = {
  sessionId: string;
  sessionExpiresAt?: number;
  user: SessionUser;
};

type SessionResolution =
  | { kind: 'authenticated'; sessionId: string; sessionExpiresAt?: number; user: SessionUser }
  | { kind: 'response'; response: Response };

const readSessionId = (request: Request) => {
  const { sessionCookieName } = getAuthConfig();
  const cookies = parseCookie(request.headers.get('cookie') ?? '');
  return cookies[sessionCookieName];
};

const PROFILE_DIAGNOSTIC_PATHS = new Set(['/auth/me', '/api/v1/iam/users/me/profile']);

const isProfileDiagnosticsEnabled = (): boolean => process.env.IAM_DEBUG_PROFILE_ERRORS === 'true';

const shouldLogProfileDiagnostics = (request: Request): boolean => {
  if (!isProfileDiagnosticsEnabled()) {
    return false;
  }

  const pathname = new URL(request.url).pathname;
  return PROFILE_DIAGNOSTIC_PATHS.has(pathname);
};

const createAuthenticatedContext = async (request: Request): Promise<SessionResolution> => {
  const tenantHostError = await validateTenantHost(request);
  if (tenantHostError) {
    return { kind: 'response', response: tenantHostError };
  }

  if (isMockAuthEnabled()) {
    return {
      kind: 'authenticated',
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
    sessionId,
    sessionExpiresAt: sessionResolution.expiresAt,
    user: await resolveRuntimeSessionUser(request, sessionResolution.user),
  };
};

const logProfileDiagnosticsIfEnabled = (request: Request, user: SessionUser): void => {
  if (!shouldLogProfileDiagnostics(request)) {
    return;
  }

  logger.info('Auth middleware resolved session user for self-service diagnostics', {
    endpoint: request.url,
    operation: 'auth_middleware',
    auth_state: 'authenticated',
    user_id: user.id,
    session_id_present: true,
    session_instance_id: user.instanceId ?? null,
    session_roles: user.roles,
    session_roles_count: user.roles.length,
    ...buildLogContext(user.instanceId, { includeTraceId: true }),
  });
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
  if (shouldLogProfileDiagnostics(request)) {
    logger.info('Auth middleware enforcing legal text compliance for self-service request', {
      endpoint: request.url,
      operation: 'auth_middleware',
      user_id: ctx.user.id,
      session_instance_id: ctx.user.instanceId,
      ...buildLogContext(ctx.user.instanceId, { includeTraceId: true }),
    });
  }

  return withLegalTextCompliance(ctx.user.instanceId, ctx.user.id, runHandler, {
    returnTo: `${requestUrl.pathname}${requestUrl.search}`,
  });
};

const logUnexpectedMiddlewareError = (request: Request, error: unknown): Response => {
  const logContext = buildLogContext(undefined, { includeTraceId: true });
  if (error instanceof SessionStoreUnavailableError) {
    logger.error('Auth middleware dependency failed', {
      endpoint: request.url,
      operation: 'auth_middleware',
      dependency: 'redis',
      dependency_operation: error.operation,
      error_type: error.name,
      error_message: error.message,
      ...logContext,
    });

    return createApiError(
      503,
      'internal_error',
      'Authentifizierung ist momentan nicht verfügbar, weil der Sitzungsspeicher nicht erreichbar ist.',
      logContext.request_id,
      {
        dependency: 'redis',
        reason_code: 'session_store_unavailable',
      }
    );
  }

  if (error instanceof SessionUserHydrationError) {
    logger.warn(
      'Auth middleware rejected request because the session user is missing required tenant context',
      {
        endpoint: request.url,
        operation: 'auth_middleware',
        reason_code: 'missing_session_instance_id',
        request_host: error.requestHost,
        ...logContext,
      }
    );

    return createApiError(
      401,
      'unauthorized',
      'Die Sitzung enthält keinen gültigen Instanzkontext.',
      logContext.request_id,
      {
        reason_code: 'missing_session_instance_id',
        request_host: error.requestHost,
      }
    );
  }

  logger.error('Auth middleware failed unexpectedly', {
    endpoint: request.url,
    operation: 'auth_middleware',
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error_message: error instanceof Error ? error.message : String(error),
    ...logContext,
  });

  return createApiError(500, 'internal_error', 'Authentifizierungsfehler.', logContext.request_id, {
    reason_code: 'auth_resolution_failed',
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
      user: resolution.user,
    };
    logProfileDiagnosticsIfEnabled(request, ctx.user);
    return await runWithLegalTextComplianceIfRequired(request, ctx, handler);
  } catch (error) {
    return logUnexpectedMiddlewareError(request, error);
  }
};
