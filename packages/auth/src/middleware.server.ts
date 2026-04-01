import { parse as parseCookie } from 'cookie-es';
import { createSdkLogger, parseInstanceIdFromHost, toJsonErrorResponse } from '@sva/sdk/server';

import { getSessionUser } from './auth.server.js';
import { getAuthConfig } from './config.js';
import { withLegalTextCompliance } from './legal-text-enforcement.server.js';
import { createMockSessionUser, isMockAuthEnabled } from './mock-auth.server.js';
import { buildLogContext } from './shared/log-context.js';
import type { SessionUser } from './types.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

export type AuthenticatedRequestContext = {
  sessionId: string;
  user: SessionUser;
};

type SessionResolution =
  | { kind: 'authenticated'; sessionId: string; user: SessionUser }
  | { kind: 'response'; response: Response };

const readSessionId = (request: Request) => {
  const { sessionCookieName } = getAuthConfig();
  const cookies = parseCookie(request.headers.get('cookie') ?? '');
  return cookies[sessionCookieName];
};

const unauthorized = () =>
  new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });

const LEGAL_TEXT_PROTECTED_PATHS = new Set(['/iam/authorize', '/iam/me/permissions']);
const LEGAL_TEXT_PROTECTED_PREFIXES = ['/api/v1/iam/'];
const LEGAL_TEXT_EXEMPT_AUTH_PATHS = new Set(['/auth/login', '/auth/callback', '/auth/logout', '/auth/me']);
const LEGAL_TEXT_EXEMPT_IAM_PREFIXES = ['/api/v1/iam/legal-texts'];
const LEGAL_TEXT_EXEMPT_SELF_SERVICE_PREFIXES = ['/iam/me/legal-texts'];
const LEGAL_TEXT_EXEMPT_GOVERNANCE_OPERATIONS = new Set(['accept_legal_text', 'revoke_legal_acceptance']);
const PROFILE_DIAGNOSTIC_PATHS = new Set(['/auth/me', '/api/v1/iam/users/me/profile']);

const isProfileDiagnosticsEnabled = (): boolean => process.env.IAM_DEBUG_PROFILE_ERRORS === 'true';

const shouldLogProfileDiagnostics = (request: Request): boolean => {
  if (!isProfileDiagnosticsEnabled()) {
    return false;
  }

  const pathname = new URL(request.url).pathname;
  return PROFILE_DIAGNOSTIC_PATHS.has(pathname);
};

const readWorkflowOperation = async (request: Request): Promise<string | undefined> => {
  try {
    const payload = await request.clone().json();
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }
    const operation = (payload as { operation?: unknown }).operation;
    return typeof operation === 'string' ? operation : undefined;
  } catch {
    return undefined;
  }
};

const shouldEnforceLegalTextCompliance = async (request: Request): Promise<boolean> => {
  const pathname = new URL(request.url).pathname;
  if (LEGAL_TEXT_EXEMPT_AUTH_PATHS.has(pathname)) {
    return false;
  }

  if (LEGAL_TEXT_EXEMPT_SELF_SERVICE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (LEGAL_TEXT_EXEMPT_IAM_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (pathname === '/api/v1/iam/governance/workflows') {
    const operation = await readWorkflowOperation(request);
    return !LEGAL_TEXT_EXEMPT_GOVERNANCE_OPERATIONS.has(operation ?? '');
  }

  if (LEGAL_TEXT_PROTECTED_PATHS.has(pathname)) {
    return true;
  }

  return LEGAL_TEXT_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

const resolveSessionUser = (request: Request, user: SessionUser): SessionUser => {
  if (user.instanceId) {
    return user;
  }

  const derivedInstanceId = parseInstanceIdFromHost(new URL(request.url).host);
  if (!derivedInstanceId) {
    return user;
  }

  logger.warn('Auth middleware derived missing session instance from request host', {
    endpoint: request.url,
    operation: 'auth_middleware',
    auth_state: 'authenticated',
    user_id: user.id,
    derived_instance_id: derivedInstanceId,
    ...buildLogContext(derivedInstanceId, { includeTraceId: true }),
  });

  return {
    ...user,
    instanceId: derivedInstanceId,
  };
};

const createAuthenticatedContext = async (request: Request): Promise<SessionResolution> => {
  if (isMockAuthEnabled()) {
    return {
      kind: 'authenticated',
      sessionId: 'mock-auth-session',
      user: createMockSessionUser(),
    };
  }

  const sessionId = readSessionId(request);
  if (!sessionId) {
    logger.debug('Auth middleware rejected request without session cookie', {
      endpoint: request.url,
      auth_state: 'unauthenticated',
      operation: 'auth_middleware',
      ...buildLogContext(undefined, { includeTraceId: true }),
    });
    return { kind: 'response', response: unauthorized() };
  }

  const sessionUser = await getSessionUser(sessionId);
  if (!sessionUser) {
    logger.warn('Auth middleware rejected request with invalid session', {
      endpoint: request.url,
      auth_state: 'invalid_session',
      session_exists: true,
      user_exists: false,
      operation: 'auth_middleware',
      ...buildLogContext(undefined, { includeTraceId: true }),
    });
    return { kind: 'response', response: unauthorized() };
  }

  return {
    kind: 'authenticated',
    sessionId,
    user: resolveSessionUser(request, sessionUser),
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

const createProtectedHandler = (
  ctx: AuthenticatedRequestContext,
  handler: (ctx: AuthenticatedRequestContext) => Promise<Response> | Response
): (() => Promise<Response>) => async () => handler(ctx);

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
  logger.error('Auth middleware failed unexpectedly', {
    endpoint: request.url,
    operation: 'auth_middleware',
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error_message: error instanceof Error ? error.message : String(error),
    ...logContext,
  });

  return toJsonErrorResponse(500, 'internal_error', 'Authentifizierungsfehler.', {
    requestId: logContext.request_id,
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

    const ctx = { sessionId: resolution.sessionId, user: resolution.user };
    logProfileDiagnosticsIfEnabled(request, ctx.user);
    return await runWithLegalTextComplianceIfRequired(request, ctx, handler);
  } catch (error) {
    return logUnexpectedMiddlewareError(request, error);
  }
};
