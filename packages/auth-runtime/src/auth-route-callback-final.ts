import { toSafeLogPath } from '@sva/server-runtime';
import { emitAuthAuditEvent } from './audit-events.js';
import { resolveAuthConfigForRequest } from './config.js';
import { handleCallback } from './auth-server/callback.js';
import { buildLogContext } from './log-context.js';
import { PLATFORM_WORKSPACE_ID, getWorkspaceIdForScope } from './scope.js';
import { isTokenErrorLike } from './error-guards.js';
import { TenantScopeConflictError } from './runtime-errors.js';
import { logger, createRedirectResponse } from './auth-route-responses.js';
import { getSetCookieValues, describeTokenError, attachSessionCookie, attachDeletedCookie, createSilentSsoResponse } from './auth-route-cookies.js';
import { resolveCookieLoginState, type AuthScope, type CallbackDependencies } from './auth-route-state.js';
import { logCallbackCookieCleanup, emitCallbackFailureAuditEvent, createCallbackFailureResponse, resolveSuccessfulCallbackRedirectTarget } from './auth-route-callback-errors.js';

const logSuccessfulCallback = (input: {
  readonly user: Awaited<ReturnType<typeof handleCallback>>['user'];
  readonly authConfig: Awaited<ReturnType<typeof resolveAuthConfigForRequest>>;
  readonly authScope: AuthScope;
  readonly redirectTarget: string;
  readonly isSilent: boolean;
  readonly retryPerformed: boolean;
  readonly iss: string | null;
}) => {
  const successScope = input.user.instanceId
    ? { kind: 'instance' as const, instanceId: input.user.instanceId }
    : input.authScope;
  logger.info('tenant_auth_callback_result', {
    operation: 'tenant_auth_callback',
    scope_kind: input.user.instanceId ? 'instance' : input.authScope.kind,
    instance_id:
      input.user.instanceId ??
      (input.authConfig.kind === 'instance' ? input.authConfig.instanceId : undefined),
    auth_realm: input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
    client_id: input.authConfig.clientId,
    issuer_path: toSafeLogPath(input.authConfig.issuer),
    redirect_path: toSafeLogPath(input.authConfig.redirectUri),
    is_silent: input.isSilent,
    retry_performed: input.retryPerformed,
    result: 'success',
    auth_scope_kind: input.authScope.kind,
    ...buildLogContext(successScope),
  });
};

const finalizeSuccessfulCallback = async (input: {
  readonly response: Response;
  readonly user: Awaited<ReturnType<typeof handleCallback>>['user'];
  readonly authConfig: Awaited<ReturnType<typeof resolveAuthConfigForRequest>>;
  readonly authScope: AuthScope;
  readonly hadSessionCookieOnCallback: boolean;
  readonly sessionId: string;
  readonly expiresAt?: number;
  readonly isSilent: boolean;
}) => {
  const loginStateDeleteStrategy = attachDeletedCookie(
    input.response,
    input.authConfig.loginStateCookieName
  );
  const sessionCookieStrategy = attachSessionCookie(
    input.response,
    input.authConfig.sessionCookieName,
    input.sessionId,
    input.expiresAt
  );
  const silentSsoDeleteStrategy = attachDeletedCookie(
    input.response,
    input.authConfig.silentSsoSuppressCookieName
  );
  const successScope = input.user.instanceId
    ? { kind: 'instance' as const, instanceId: input.user.instanceId }
    : input.authScope;

  logger.info('Callback cookies prepared', {
    operation: 'login_callback_cookies',
    login_state_delete_strategy: loginStateDeleteStrategy,
    session_cookie_strategy: sessionCookieStrategy,
    silent_sso_delete_strategy: silentSsoDeleteStrategy,
    response_set_cookie_count: getSetCookieValues(input.response.headers).length,
    had_session_cookie_on_callback: input.hadSessionCookieOnCallback,
    ...buildLogContext(successScope),
  });
  await emitAuthAuditEvent({
    eventType: input.isSilent ? 'silent_reauth_success' : 'login',
    actorUserId: input.user.id,
    scope: successScope,
    workspaceId: input.user.instanceId ?? getWorkspaceIdForScope(input.authScope),
    outcome: 'success',
  });
  return input.response;
};

const logFailedCallback = (input: {
  readonly error: unknown;
  readonly authConfig: Awaited<ReturnType<typeof resolveAuthConfigForRequest>>;
  readonly authScope: AuthScope;
  readonly cookieLoginState: Awaited<ReturnType<typeof resolveCookieLoginState>>;
  readonly isSilent: boolean;
  readonly iss: string | null;
}) => {
  const callbackScope = input.cookieLoginState ?? input.authScope;
  if (input.error instanceof TenantScopeConflictError) {
    logger.error('tenant_auth_callback_result', {
      operation: 'tenant_auth_callback',
      scope_kind: callbackScope.kind,
      instance_id: callbackScope.kind === 'instance' ? callbackScope.instanceId : undefined,
      auth_realm: input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
      client_id: input.authConfig.clientId,
      issuer_path: toSafeLogPath(input.authConfig.issuer),
      redirect_path: toSafeLogPath(input.authConfig.redirectUri),
      is_silent: input.isSilent,
      retry_performed: false,
      result: 'failure',
      error_type: input.error.name,
      reason_code: input.error.reason,
      expected_instance_id: input.error.expectedInstanceId,
      token_instance_id: input.error.actualInstanceId,
      auth_scope_kind: input.authScope.kind,
      ...buildLogContext(callbackScope),
    });
    return;
  }

  if (isTokenErrorLike(input.error)) {
    logger.warn('tenant_auth_callback_result', {
      operation: 'tenant_auth_callback',
      scope_kind: callbackScope.kind,
      instance_id: callbackScope.kind === 'instance' ? callbackScope.instanceId : undefined,
      auth_realm: input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
      client_id: input.authConfig.clientId,
      issuer_path: toSafeLogPath(input.authConfig.issuer),
      redirect_path: toSafeLogPath(input.authConfig.redirectUri),
      is_silent: input.isSilent,
      retry_performed: false,
      result: 'failure',
      auth_scope_kind: input.authScope.kind,
      reason_code: 'token_validate_failed',
      ...describeTokenError(input.error),
      ...buildLogContext(callbackScope),
    });
    return;
  }

  logger.error('tenant_auth_callback_result', {
    operation: 'tenant_auth_callback',
    scope_kind: callbackScope.kind,
    instance_id: callbackScope.kind === 'instance' ? callbackScope.instanceId : undefined,
    auth_realm: input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
    client_id: input.authConfig.clientId,
    issuer_path: toSafeLogPath(input.authConfig.issuer),
    redirect_path: toSafeLogPath(input.authConfig.redirectUri),
    is_silent: input.isSilent,
    retry_performed: false,
    result: 'failure',
    error_type: input.error instanceof Error ? input.error.constructor.name : typeof input.error,
    reason_code: 'callback_failed',
    auth_scope_kind: input.authScope.kind,
    ...buildLogContext(callbackScope),
  });
};

const finalizeFailedCallback = async (input: {
  readonly authConfig: Awaited<ReturnType<typeof resolveAuthConfigForRequest>>;
  readonly authScope: AuthScope;
  readonly cookieLoginState: Awaited<ReturnType<typeof resolveCookieLoginState>>;
  readonly hadSessionCookieOnCallback: boolean;
  readonly isSilent: boolean;
}) => {
  const response = createCallbackFailureResponse(input.isSilent);
  const loginStateDeleteStrategy = attachDeletedCookie(
    response,
    input.authConfig.loginStateCookieName
  );
  logCallbackCookieCleanup(
    'Failed callback cookie cleanup prepared',
    response,
    loginStateDeleteStrategy,
    input.hadSessionCookieOnCallback,
    input.cookieLoginState ?? input.authScope
  );
  await emitCallbackFailureAuditEvent({
    eventType: input.isSilent ? 'silent_reauth_failed' : 'login',
    scope: input.cookieLoginState ?? input.authScope,
  });
  return response;
};

export const completeCallbackExchange = async (input: {
  readonly request: Request;
  readonly dependencies: CallbackDependencies;
  readonly code: string;
  readonly state: string;
}): Promise<Response> => {
  const { request, dependencies, code, state } = input;
  const { iss } = dependencies.callbackInput;
  const { authConfig, authScope, cookieLoginState, hadSessionCookieOnCallback } = dependencies;

  try {
    const { sessionId, user, expiresAt, loginState, retryPerformed } = await handleCallback({
      code,
      state,
      iss,
      loginState: cookieLoginState,
      authConfig,
    });
    const effectiveLoginState = loginState ?? cookieLoginState;
    const redirectTarget = resolveSuccessfulCallbackRedirectTarget(
      request,
      dependencies.callbackInput,
      effectiveLoginState
    );
    const isSilent = effectiveLoginState?.silent === true;
    const response = isSilent
      ? createSilentSsoResponse('success')
      : createRedirectResponse(redirectTarget);
    logSuccessfulCallback({
      user,
      authConfig,
      authScope,
      redirectTarget,
      isSilent,
      retryPerformed,
      iss,
    });

    return finalizeSuccessfulCallback({
      response,
      user,
      authConfig,
      authScope,
      hadSessionCookieOnCallback,
      sessionId,
      expiresAt,
      isSilent,
    });
  } catch (error) {
    const isSilent = cookieLoginState?.silent === true;
    logFailedCallback({
      error,
      authConfig,
      authScope,
      cookieLoginState,
      isSilent,
      iss,
    });
    return finalizeFailedCallback({
      authConfig,
      authScope,
      cookieLoginState,
      hadSessionCookieOnCallback,
      isSilent,
    });
  }
};
