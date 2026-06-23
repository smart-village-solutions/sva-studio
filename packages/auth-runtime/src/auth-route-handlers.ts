import { serialize as serializeCookie } from 'cookie-es';
import type { IamUserGroupAssignment } from '@sva/core';
import {
  createSdkLogger,
  getWorkspaceContext,
  initializeOtelSdk,
  toJsonErrorResponse,
  withRequestContext,
} from '@sva/server-runtime';

import { emitAuthAuditEvent } from './audit-events.js';
import { sanitizeAuthReturnTo } from './auth-return-to.js';
import { getAuthConfig, resolveAuthConfigForRequest } from './config.js';
import { handleCallback } from './auth-server/callback.js';
import { createLoginUrl } from './auth-server/login.js';
import { logoutSession } from './auth-server/logout.js';
import { isUpdateEmailActionSupported } from './keycloak-account-action-support.js';
import { withAuthenticatedUser } from './middleware.js';
import { getSession } from './redis-session.js';
import { resolveEffectivePermissions } from './iam-authorization/permission-store.js';
import { filterTenantEffectivePermissions } from './iam-authorization/root-only-permissions.js';
import { withInstanceScopedDb } from './iam-authorization/shared.js';
import { withRegistryRepository } from './iam-instance-registry/repository.js';
import { appendSetCookie, deleteCookieHeader, readCookieFromRequest } from './cookies.js';
import { decodeLoginStateCookie, encodeLoginStateCookie, type LoginStateCookiePayload } from './login-state-cookie.js';
import { buildLogContext } from './log-context.js';
import {
  DEFAULT_WORKSPACE_ID,
  PLATFORM_WORKSPACE_ID,
  getScopeFromAuthConfig,
  getWorkspaceIdForScope,
} from './scope.js';
import { isTokenErrorLike } from './error-guards.js';
import {
  DEV_AUTH_COOKIE_NAME,
  createMockSessionUser,
  hasActiveMockAuthSession,
  isMockAuthEnabled,
} from './mock-auth.js';
import { buildRequestOriginFromHeaders, resolveEffectiveRequestHost } from './request-hosts.js';
import { validateCsrf } from './shared/request-security.js';
import { SessionStoreUnavailableError, TenantAuthResolutionError, TenantScopeConflictError } from './runtime-errors.js';
import type { AccountActionIntent } from './types.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const shouldAttachDebugAuthHeaders = (): boolean => process.env.SVA_AUTH_DEBUG_HEADERS === 'true';

void initializeOtelSdk().catch((error: unknown) => {
  logger.error('Fehler bei OTEL SDK Initialisierung im Auth-Modul', {
    component: 'iam-auth',
    dependency: 'otel',
    error_type: error instanceof Error ? error.name : typeof error,
    reason_code: 'otel_init_failed',
    ...buildLogContext(DEFAULT_WORKSPACE_ID),
  });
});

const createRedirectResponse = (location: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: location },
  });

const createAuthMeHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
});

const createNotFoundResponse = () =>
  new Response(null, {
    status: 404,
  });

const collectEffectivePermissionActions = (
  permissions: readonly {
    action?: string;
    effect?: string;
  }[]
): string[] => {
  const byAction = new Map<string, 'allow' | 'deny'>();

  for (const permission of permissions) {
    const action = typeof permission.action === 'string' ? permission.action.trim() : '';
    if (action.length === 0) {
      continue;
    }
    let normalizedEffect: 'allow' | 'deny' | null = null;
    if (permission.effect === 'deny') {
      normalizedEffect = 'deny';
    } else if (permission.effect === 'allow') {
      normalizedEffect = 'allow';
    }
    if (!normalizedEffect) {
      continue;
    }
    if (normalizedEffect === 'deny') {
      byAction.set(action, 'deny');
      continue;
    }
    if (byAction.get(action) !== 'deny') {
      byAction.set(action, 'allow');
    }
  }

  return [...byAction.entries()]
    .filter(([, effect]) => effect === 'allow')
    .map(([action]) => action)
    .sort((left, right) => left.localeCompare(right));
};

const summarizeRequestUrl = (request: Request): { endpoint_path: string; has_sensitive_query: boolean } => {
  const url = new URL(request.url);
  return {
    endpoint_path: url.pathname,
    has_sensitive_query:
      url.searchParams.has('code') ||
      url.searchParams.has('state') ||
      url.searchParams.has('id_token_hint') ||
      url.searchParams.has('iss'),
  };
};

const createAuthDependencyErrorResponse = (
  request: Request,
  operation: 'auth_callback' | 'auth_login' | 'auth_logout',
  error: unknown
): Response => {
  const requestId = getWorkspaceContext().requestId;

  if (error instanceof TenantAuthResolutionError) {
    logger.error('Auth route failed during tenant auth resolution', {
      ...summarizeRequestUrl(request),
      operation,
      error_type: error.name,
      reason_code: 'scope_resolution_failed',
      reason: error.reason,
      tenant_host: error.host,
      request_id: requestId,
      ...buildLogContext(),
    });
    return toJsonErrorResponse(error.statusCode, 'internal_error', error.publicMessage, { requestId });
  }

  if (error instanceof SessionStoreUnavailableError) {
    logger.error('Auth route failed because session storage is unavailable', {
      ...summarizeRequestUrl(request),
      operation,
      error_type: error.name,
      reason_code: 'session_store_unavailable',
      request_id: requestId,
      ...buildLogContext(),
    });
    return toJsonErrorResponse(
      503,
      'internal_error',
      'Authentifizierung ist momentan nicht verfügbar, weil der Sitzungsspeicher nicht erreichbar ist.',
      { requestId }
    );
  }

  logger.error('Auth route failed unexpectedly', {
    ...summarizeRequestUrl(request),
    operation,
    error_type: error instanceof Error ? error.name : typeof error,
    reason_code: 'internal_auth_route_failure',
    request_id: requestId,
    ...buildLogContext(),
  });
  return toJsonErrorResponse(500, 'internal_error', 'Authentifizierung ist momentan nicht verfügbar.', {
    requestId,
  });
};

const attachDebugAuthHeaders = (
  response: Response,
  input: {
    request: Request;
    authConfig: {
      kind: 'platform' | 'instance';
      instanceId?: string;
      authRealm?: string;
      clientId: string;
      redirectUri: string;
    };
  }
): void => {
  if (!shouldAttachDebugAuthHeaders()) {
    return;
  }

  response.headers.set('x-sva-debug-request-host', resolveEffectiveRequestHost(input.request));
  response.headers.set('x-sva-debug-request-origin', buildRequestOriginFromHeaders(input.request));
  response.headers.set('x-sva-debug-auth-scope-kind', input.authConfig.kind);
  const debugInstanceId =
    input.authConfig.kind === 'instance'
      ? (input.authConfig.instanceId ?? PLATFORM_WORKSPACE_ID)
      : PLATFORM_WORKSPACE_ID;
  response.headers.set(
    'x-sva-debug-auth-instance-id',
    debugInstanceId
  );
  response.headers.set('x-sva-debug-auth-realm', input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID);
  response.headers.set('x-sva-debug-auth-client-id', input.authConfig.clientId);
  response.headers.set('x-sva-debug-auth-redirect-uri', input.authConfig.redirectUri);
};

const summarizeRedirectTarget = (
  value: string
): { redirect_target_origin?: string; redirect_target_path: string; has_sensitive_query: boolean } => {
  try {
    const url = new URL(value);
    return {
      redirect_target_origin: url.origin,
      redirect_target_path: url.pathname,
      has_sensitive_query: url.searchParams.has('id_token_hint') || url.searchParams.has('code'),
    };
  } catch {
    const [path] = value.split('?');
    return {
      redirect_target_path: path || value,
      has_sensitive_query: value.includes('id_token_hint=') || value.includes('code='),
    };
  }
};

const createAuthCookieOptions = () => {
  const isBuilderDevAuth = process.env.BUILDER_DEV_AUTH === 'true';

  return {
    httpOnly: true,
    secure: isBuilderDevAuth || process.env.NODE_ENV === 'production',
    sameSite: isBuilderDevAuth ? ('none' as const) : ('lax' as const),
    path: '/',
  };
};

const createTimedCookieOptions = (expiresAt: number | undefined) => {
  if (typeof expiresAt !== 'number') {
    return createAuthCookieOptions();
  }

  const maxAgeSeconds = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
  return {
    ...createAuthCookieOptions(),
    maxAge: maxAgeSeconds,
    expires: new Date(Date.now() + maxAgeSeconds * 1000),
  };
};

const createSessionCookie = (name: string, sessionId: string, expiresAt?: number) =>
  serializeCookie(name, sessionId, createTimedCookieOptions(expiresAt));

const createLoginStateCookie = (input: { name: string; secret: string; payload: LoginStateCookiePayload }) =>
  serializeCookie(input.name, encodeLoginStateCookie(input.payload, input.secret), createAuthCookieOptions());

const createSilentSsoSuppressCookie = (name: string, suppressUntil: number) =>
  serializeCookie(name, String(suppressUntil), createTimedCookieOptions(suppressUntil));

const createDevAuthCookie = () =>
  serializeCookie(DEV_AUTH_COOKIE_NAME, '1', createAuthCookieOptions());

const getSetCookieValues = (headers: Headers): string[] => {
  const candidate = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof candidate.getSetCookie === 'function') {
    return candidate.getSetCookie();
  }

  const combined = headers.get('set-cookie');
  return combined ? [combined] : [];
};

const describeTokenError = (error: unknown): Record<string, unknown> => {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const typed = error as {
    error?: unknown;
    error_description?: unknown;
    code?: unknown;
    cause?: unknown;
    response?: { status?: unknown };
  };
  const cause =
    typed.cause && typeof typed.cause === 'object'
      ? (typed.cause as {
          error?: unknown;
          error_description?: unknown;
          code?: unknown;
          response?: { status?: unknown };
        })
      : null;

  const readString = (value: unknown): string | undefined => (typeof value === 'string' && value.length > 0 ? value : undefined);
  const readStatus = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);

  return {
    oauth_error: readString(typed.error) ?? readString(cause?.error),
    oauth_error_description:
      readString(typed.error_description) ?? readString(cause?.error_description),
    oauth_code: readString(typed.code) ?? readString(cause?.code),
    oauth_status: readStatus(typed.response?.status) ?? readStatus(cause?.response?.status),
  };
};

const attachLoginStateCookie = (
  response: Response,
  input: { name: string; secret: string; payload: LoginStateCookiePayload }
) => {
  appendSetCookie(response, createLoginStateCookie(input));
  return 'response';
};

const attachSessionCookie = (response: Response, name: string, sessionId: string, expiresAt?: number) => {
  appendSetCookie(response, createSessionCookie(name, sessionId, expiresAt));
  return 'response';
};

const attachSilentSsoSuppressCookie = (response: Response, name: string, suppressUntil: number) => {
  appendSetCookie(response, createSilentSsoSuppressCookie(name, suppressUntil));
  return 'response';
};

const attachDeletedCookie = (response: Response, name: string) => {
  appendSetCookie(response, deleteCookieHeader(name));
  return 'response';
};

const createSilentSsoResponse = (status: 'success' | 'failure') =>
  new Response(
    `<!doctype html><html><body><script>
window.parent.postMessage({ type: 'sva-auth:silent-sso', status: '${status}' }, window.location.origin);
</script></body></html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );

const DEFAULT_POST_LOGIN_REDIRECT = '/';
const LOGOUT_INTENT_HEADER = 'x-sva-logout-intent';
const LOGOUT_INTENT_VALUE = 'user';
const LOGOUT_INTENT_FORM_FIELD = 'logoutIntent';

type KeycloakAccountAction = 'UPDATE_PASSWORD' | 'UPDATE_EMAIL';

const mapAccountActionToKeycloakAction = (action: string | null): KeycloakAccountAction | null => {
  if (action === 'update-password') {
    return 'UPDATE_PASSWORD';
  }

  if (action === 'update-email') {
    return 'UPDATE_EMAIL';
  }

  return null;
};

const mapKeycloakActionToAccountActionIntent = (action: string | null | undefined): AccountActionIntent | null => {
  if (action === 'UPDATE_PASSWORD') {
    return 'update-password';
  }

  if (action === 'UPDATE_EMAIL') {
    return 'update-email';
  }

  return null;
};

const mapAccountActionIntentToStatus = (
  accountActionIntent: AccountActionIntent,
  callbackInput?: ReturnType<typeof resolveCallbackInput>
): string | null => {
  if (accountActionIntent === 'update-password') {
    return callbackInput?.kcAction === 'UPDATE_PASSWORD' && callbackInput.kcActionStatus === 'success'
      ? 'password-updated'
      : null;
  }

  if (callbackInput?.kcAction !== 'UPDATE_EMAIL') {
    return 'email-update-unavailable';
  }

  return 'email-update-finished';
};

const formatRedirectTarget = (url: URL, request: Request): string => {
  const requestUrl = new URL(request.url);
  if (url.origin === requestUrl.origin) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  return url.toString();
};

const appendAccountActionStatusToRedirectTarget = (
  request: Request,
  redirectTarget: string,
  input: {
    readonly accountAction: string;
    readonly accountActionType?: AccountActionIntent;
  }
): string => {
  const redirectUrl = new URL(redirectTarget, request.url);
  redirectUrl.searchParams.set('accountAction', input.accountAction);
  if (input.accountActionType) {
    redirectUrl.searchParams.set('accountActionType', input.accountActionType);
  }
  return formatRedirectTarget(redirectUrl, request);
};

const resolveCallbackInput = (request: Request) => {
  const url = new URL(request.url);
  return {
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    error: url.searchParams.get('error'),
    iss: url.searchParams.get('iss'),
    kcAction: url.searchParams.get('kc_action'),
    kcActionStatus: url.searchParams.get('kc_action_status'),
  };
};

const hasExplicitLogoutIntent = async (request: Request): Promise<boolean> => {
  if (request.headers.get(LOGOUT_INTENT_HEADER) === LOGOUT_INTENT_VALUE) {
    return true;
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    return false;
  }

  try {
    const formData = await request.clone().formData();
    return formData.get(LOGOUT_INTENT_FORM_FIELD) === LOGOUT_INTENT_VALUE;
  } catch {
    return false;
  }
};

const sanitizeReturnTo = async (request: Request, value: string | null | undefined): Promise<string> => {
  return sanitizeAuthReturnTo(request, value, { defaultPath: DEFAULT_POST_LOGIN_REDIRECT });
};

const isActiveDevAuthRequest = (request: Request): boolean =>
  isMockAuthEnabled() && hasActiveMockAuthSession(request);

const resolveCookieLoginState = async (request: Request, state: string) => {
  const { loginStateCookieName, loginStateSecret } = getAuthConfig();
  const payload = decodeLoginStateCookie(readCookieFromRequest(request, loginStateCookieName), loginStateSecret);

  if (payload?.state !== state) {
    return null;
  }

  return {
    codeVerifier: payload.codeVerifier,
    nonce: payload.nonce,
    createdAt: payload.createdAt,
    returnTo: await sanitizeReturnTo(request, payload.returnTo),
    silent: payload.silent === true,
    freshReauthRequested: payload.freshReauthRequested === true,
    accountActionIntent: payload.accountActionIntent,
    ...(payload.kind === 'instance' ? { kind: 'instance' as const, instanceId: payload.instanceId } : { kind: 'platform' as const }),
  };
};

const isExpiredLoginState = (createdAt: number) => Date.now() - createdAt > 10 * 60 * 1000;

const isSilentSsoSuppressed = (request: Request): boolean => {
  const { silentSsoSuppressCookieName } = getAuthConfig();
  const suppressUntil = Number(readCookieFromRequest(request, silentSsoSuppressCookieName) ?? '');
  return Number.isFinite(suppressUntil) && suppressUntil > Date.now();
};

type AuthScope = ReturnType<typeof getScopeFromAuthConfig>;

type CallbackDependencies = {
  readonly authConfig: Awaited<ReturnType<typeof resolveAuthConfigForRequest>>;
  readonly authScope: AuthScope;
  readonly cookieLoginState: Awaited<ReturnType<typeof resolveCookieLoginState>>;
  readonly hadSessionCookieOnCallback: boolean;
  readonly callbackInput: ReturnType<typeof resolveCallbackInput>;
};

type AuthMeResolution = {
  readonly permissionActions: string[];
  readonly permissionStatus: 'ok' | 'degraded';
  readonly assignedModules: string[];
  readonly groups: readonly IamUserGroupAssignment[];
};

const logCallbackCookieCleanup = (
  message: 'Callback cookie cleanup prepared' | 'Expired callback cookie cleanup prepared' | 'Failed callback cookie cleanup prepared',
  response: Response,
  strategy: string,
  hadSessionCookieOnCallback: boolean,
  scope: AuthScope | NonNullable<Awaited<ReturnType<typeof resolveCookieLoginState>>>
) => {
  logger.info(message, {
    operation: 'login_callback_cookie_cleanup',
    strategy,
    response_set_cookie_count: getSetCookieValues(response.headers).length,
    had_session_cookie_on_callback: hadSessionCookieOnCallback,
    ...buildLogContext(scope),
  });
};

const emitCallbackFailureAuditEvent = async (input: {
  readonly eventType: 'login' | 'login_state_expired' | 'silent_reauth_failed';
  readonly scope: AuthScope | NonNullable<Awaited<ReturnType<typeof resolveCookieLoginState>>>;
}) => {
  await emitAuthAuditEvent({
    eventType: input.eventType,
    scope: input.scope,
    workspaceId: getWorkspaceIdForScope(input.scope),
    outcome: 'failure',
  });
};

const createCallbackFailureResponse = (
  isSilent: boolean,
  location = '/?auth=error'
) => (isSilent ? createSilentSsoResponse('failure') : createRedirectResponse(location));

const handleCallbackErrorResponse = async (dependencies: CallbackDependencies): Promise<Response | null> => {
  if (!dependencies.callbackInput.error) {
    return null;
  }

  const response = createCallbackFailureResponse(dependencies.cookieLoginState?.silent === true);
  const loginStateDeleteStrategy = attachDeletedCookie(response, dependencies.authConfig.loginStateCookieName);
  logCallbackCookieCleanup(
    'Callback cookie cleanup prepared',
    response,
    loginStateDeleteStrategy,
    dependencies.hadSessionCookieOnCallback,
    dependencies.authScope
  );
  await emitCallbackFailureAuditEvent({
    eventType: dependencies.cookieLoginState?.silent ? 'silent_reauth_failed' : 'login',
    scope: dependencies.cookieLoginState ?? dependencies.authScope,
  });
  return response;
};

const handleCancelledAccountActionResponse = async (
  request: Request,
  dependencies: CallbackDependencies
): Promise<Response | null> => {
  if (dependencies.callbackInput.kcActionStatus !== 'cancelled') {
    return null;
  }

  const accountActionIntent =
    dependencies.cookieLoginState?.accountActionIntent ??
    mapKeycloakActionToAccountActionIntent(dependencies.callbackInput.kcAction);
  const redirectTarget = appendAccountActionStatusToRedirectTarget(
    request,
    dependencies.cookieLoginState?.returnTo ?? DEFAULT_POST_LOGIN_REDIRECT,
    {
      accountAction: 'cancelled',
      ...(accountActionIntent ? { accountActionType: accountActionIntent } : {}),
    }
  );
  const response = createRedirectResponse(redirectTarget);
  const loginStateDeleteStrategy = attachDeletedCookie(response, dependencies.authConfig.loginStateCookieName);
  logCallbackCookieCleanup(
    'Callback cookie cleanup prepared',
    response,
    loginStateDeleteStrategy,
    dependencies.hadSessionCookieOnCallback,
    dependencies.cookieLoginState ?? dependencies.authScope
  );
  return response;
};

const resolveSuccessfulCallbackRedirectTarget = (
  request: Request,
  callbackInput: ReturnType<typeof resolveCallbackInput>,
  effectiveLoginState:
    | {
        readonly returnTo?: string;
        readonly accountActionIntent?: AccountActionIntent;
      }
    | null
    | undefined
): string => {
  const redirectTargetBase = effectiveLoginState?.returnTo ?? DEFAULT_POST_LOGIN_REDIRECT;
  if (!effectiveLoginState?.accountActionIntent) {
    return redirectTargetBase;
  }

  const accountAction = mapAccountActionIntentToStatus(effectiveLoginState.accountActionIntent, callbackInput);
  if (!accountAction) {
    return redirectTargetBase;
  }

  return appendAccountActionStatusToRedirectTarget(request, redirectTargetBase, {
    accountAction,
  });
};

const handleExpiredCallbackState = async (dependencies: CallbackDependencies): Promise<Response | null> => {
  if (!dependencies.cookieLoginState || !isExpiredLoginState(dependencies.cookieLoginState.createdAt)) {
    return null;
  }

  const response = createRedirectResponse('/?auth=state-expired');
  const loginStateDeleteStrategy = attachDeletedCookie(response, dependencies.authConfig.loginStateCookieName);
  logCallbackCookieCleanup(
    'Expired callback cookie cleanup prepared',
    response,
    loginStateDeleteStrategy,
    dependencies.hadSessionCookieOnCallback,
    dependencies.cookieLoginState
  );
  await emitCallbackFailureAuditEvent({
    eventType: 'login_state_expired',
    scope: dependencies.cookieLoginState,
  });
  return response;
};

const logSuccessfulCallback = (input: {
  readonly user: Awaited<ReturnType<typeof handleCallback>>['user'];
  readonly authConfig: Awaited<ReturnType<typeof resolveAuthConfigForRequest>>;
  readonly authScope: AuthScope;
  readonly redirectTarget: string;
  readonly isSilent: boolean;
  readonly retryPerformed: boolean;
  readonly iss: string | null;
}) => {
  const successScope = input.user.instanceId ? { kind: 'instance' as const, instanceId: input.user.instanceId } : input.authScope;
  logger.info('tenant_auth_callback_result', {
    operation: 'tenant_auth_callback',
    scope_kind: input.user.instanceId ? 'instance' : input.authScope.kind,
    instance_id: input.user.instanceId ?? (input.authConfig.kind === 'instance' ? input.authConfig.instanceId : undefined),
    auth_realm: input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
    client_id: input.authConfig.clientId,
    issuer: input.authConfig.issuer,
    redirect_uri: input.authConfig.redirectUri,
    is_silent: input.isSilent,
    retry_performed: input.retryPerformed,
    result: 'success',
    auth_scope_kind: input.authScope.kind,
    ...buildLogContext(successScope),
  });

  logger.info('Auth callback successful', {
    auth_flow: 'callback',
    operation: 'login_callback',
    is_silent: input.isSilent,
    session_created: true,
    ...summarizeRedirectTarget(input.redirectTarget),
    has_code: true,
    has_state: true,
    has_iss: Boolean(input.iss),
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
  const loginStateDeleteStrategy = attachDeletedCookie(input.response, input.authConfig.loginStateCookieName);
  const sessionCookieStrategy = attachSessionCookie(
    input.response,
    input.authConfig.sessionCookieName,
    input.sessionId,
    input.expiresAt
  );
  const silentSsoDeleteStrategy = attachDeletedCookie(input.response, input.authConfig.silentSsoSuppressCookieName);
  const successScope = input.user.instanceId ? { kind: 'instance' as const, instanceId: input.user.instanceId } : input.authScope;

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
    logger.error('Tenant scope conflict in callback', {
      operation: 'tenant_scope_validate',
      is_silent: input.isSilent,
      error_type: input.error.name,
      reason_code: input.error.reason,
      expected_instance_id: input.error.expectedInstanceId,
      token_instance_id: input.error.actualInstanceId,
      auth_realm: input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
      client_id: input.authConfig.clientId,
      issuer: input.authConfig.issuer,
      ...buildLogContext(callbackScope),
    });
    logger.error('tenant_auth_callback_result', {
      operation: 'tenant_auth_callback',
      scope_kind: callbackScope.kind,
      instance_id: callbackScope.kind === 'instance' ? callbackScope.instanceId : undefined,
      auth_realm: input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
      client_id: input.authConfig.clientId,
      issuer: input.authConfig.issuer,
      redirect_uri: input.authConfig.redirectUri,
      is_silent: input.isSilent,
      retry_performed: false,
      result: 'failure',
      error_type: input.error.name,
      reason_code: input.error.reason,
      auth_scope_kind: input.authScope.kind,
      ...buildLogContext(callbackScope),
    });
    return;
  }

  if (isTokenErrorLike(input.error)) {
    logger.warn('Token validation failed in callback', {
      operation: 'token_validate',
      is_silent: input.isSilent,
      error_type: input.error instanceof Error ? input.error.constructor.name : typeof input.error,
      reason_code: 'token_validate_failed',
      has_refresh_token: false,
      ...describeTokenError(input.error),
      ...buildLogContext(callbackScope),
    });
    logger.warn('tenant_auth_callback_result', {
      operation: 'tenant_auth_callback',
      scope_kind: callbackScope.kind,
      instance_id: callbackScope.kind === 'instance' ? callbackScope.instanceId : undefined,
      auth_realm: input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
      client_id: input.authConfig.clientId,
      issuer: input.authConfig.issuer,
      redirect_uri: input.authConfig.redirectUri,
      is_silent: input.isSilent,
      retry_performed: false,
      result: 'failure',
      auth_scope_kind: input.authScope.kind,
      ...describeTokenError(input.error),
      ...buildLogContext(callbackScope),
    });
    return;
  }

  logger.error('Auth callback failed', {
    auth_flow: 'callback',
    operation: 'login_callback',
    is_silent: input.isSilent,
    error_type: input.error instanceof Error ? input.error.constructor.name : typeof input.error,
    reason_code: 'callback_failed',
    has_code: true,
    has_state: true,
    has_iss: Boolean(input.iss),
    ...buildLogContext(callbackScope),
  });
  logger.error('tenant_auth_callback_result', {
    operation: 'tenant_auth_callback',
    scope_kind: callbackScope.kind,
    instance_id: callbackScope.kind === 'instance' ? callbackScope.instanceId : undefined,
    auth_realm: input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID,
    client_id: input.authConfig.clientId,
    issuer: input.authConfig.issuer,
    redirect_uri: input.authConfig.redirectUri,
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
  const loginStateDeleteStrategy = attachDeletedCookie(response, input.authConfig.loginStateCookieName);
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

const loadAuthMePermissionState = async (user: { id: string; instanceId?: string }): Promise<Pick<AuthMeResolution, 'permissionActions' | 'permissionStatus'>> => {
  if (!user.instanceId) {
    return {
      permissionActions: [],
      permissionStatus: 'ok',
    };
  }

  try {
    const resolvedPermissions = await resolveEffectivePermissions({
      instanceId: user.instanceId,
      keycloakSubject: user.id,
    });

    if (resolvedPermissions.ok) {
      const filteredPermissions = filterTenantEffectivePermissions(resolvedPermissions.permissions);
      return {
        permissionActions: collectEffectivePermissionActions(filteredPermissions),
        permissionStatus: 'ok',
      };
    }

    logger.warn('Auth me resolved user but permission snapshot failed', {
      endpoint: '/auth/me',
      operation: 'get_current_user',
      reason_code: 'permission_snapshot_unavailable',
      ...buildLogContext({ kind: 'instance', instanceId: user.instanceId }),
    });
  } catch (error) {
    logger.error('Auth me permission action lookup failed', {
      endpoint: '/auth/me',
      operation: 'get_current_user',
      error_type: error instanceof Error ? error.name : typeof error,
      reason_code: 'permission_action_lookup_failed',
      ...buildLogContext({ kind: 'instance', instanceId: user.instanceId }),
    });
  }

  return {
    permissionActions: [],
    permissionStatus: 'degraded',
  };
};

const loadAssignedModulesForAuthMe = async (user: { instanceId?: string }): Promise<string[]> => {
  if (!user.instanceId) {
    return [];
  }
  const instanceId = user.instanceId;

  try {
    return Array.from(await withRegistryRepository((repository) => repository.listAssignedModules(instanceId)));
  } catch (error) {
    logger.error('Auth me assigned module lookup failed', {
      endpoint: '/auth/me',
      operation: 'get_current_user',
      error_type: error instanceof Error ? error.name : typeof error,
      reason_code: 'assigned_module_lookup_failed',
      ...buildLogContext({ kind: 'instance', instanceId }),
    });
    return [];
  }
};

type AuthMeGroupRow = {
  readonly group_id: string;
  readonly group_key: string;
  readonly display_name: string;
  readonly group_type: IamUserGroupAssignment['groupType'];
  readonly origin: IamUserGroupAssignment['origin'];
  readonly valid_from: string | null;
  readonly valid_until: string | null;
};

const loadGroupsForAuthMe = async (user: {
  id: string;
  instanceId?: string;
}): Promise<readonly IamUserGroupAssignment[]> => {
  if (!user.instanceId) {
    return [];
  }

  try {
    const rows = await withInstanceScopedDb(user.instanceId, async (client) => {
      const result = await client.query<AuthMeGroupRow>(
        `
SELECT
  g.id AS group_id,
  g.group_key,
  g.display_name,
  g.group_type,
  ag.origin,
  ag.valid_from,
  ag.valid_until
FROM iam.accounts a
JOIN iam.account_groups ag
  ON ag.instance_id = a.instance_id
 AND ag.account_id = a.id
JOIN iam.groups g
  ON g.instance_id = ag.instance_id
 AND g.id = ag.group_id
WHERE a.instance_id = $1
  AND a.keycloak_subject = $2
  AND g.is_active = true
  AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
  AND (ag.valid_until IS NULL OR ag.valid_until > NOW())
ORDER BY g.display_name ASC, g.group_key ASC
        `,
        [user.instanceId, user.id]
      );

      return result.rows;
    });

    return rows.map((row) => ({
      groupId: row.group_id,
      groupKey: row.group_key,
      displayName: row.display_name,
      groupType: row.group_type,
      origin: row.origin,
      validFrom: row.valid_from ?? undefined,
      validTo: row.valid_until ?? undefined,
    }));
  } catch (error) {
    logger.error('Auth me group lookup failed', {
      reason_code: 'group_lookup_failed',
      error_type: error instanceof Error ? error.name : typeof error,
      ...buildLogContext(user.instanceId ? { kind: 'instance', instanceId: user.instanceId } : undefined),
    });
    return [];
  }
};

const resolveAuthMeState = async (user: { id: string; instanceId?: string }): Promise<AuthMeResolution> => {
  const permissionState = await loadAuthMePermissionState(user);
  const assignedModules = await loadAssignedModulesForAuthMe(user);
  const groups = await loadGroupsForAuthMe(user);

  return {
    ...permissionState,
    assignedModules,
    groups,
  };
};

const createAuthMeResponse = (
  user: Record<string, unknown>,
  resolution: AuthMeResolution,
  expiresAt?: number
) => {
  const permissionStatus =
    user.permissionStatus === 'degraded' || resolution.permissionStatus === 'degraded' ? 'degraded' : 'ok';

  return new Response(
    JSON.stringify({
      ...(typeof expiresAt === 'number' ? { expiresAt } : {}),
      user: {
        ...user,
        assignedModules: resolution.assignedModules,
        groups: resolution.groups,
        permissionActions: resolution.permissionActions,
        permissionStatus,
      },
    }),
    {
      status: 200,
      headers: createAuthMeHeaders(),
    }
  );
};

const resolveLoginRequestContext = async (request?: Request) => {
  const url = request ? new URL(request.url) : null;
  const isSilent = url?.searchParams.get('silent') === '1';
  const isFreshReauth = url?.searchParams.get('reauth') === '1';
  const returnTo = request
    ? await sanitizeReturnTo(request, url?.searchParams.get('returnTo') ?? url?.searchParams.get('redirect'))
    : DEFAULT_POST_LOGIN_REDIRECT;

  return { url, isSilent, isFreshReauth, returnTo };
};

const handleMockLogin = async (request?: Request): Promise<Response> => {
  const { isSilent, returnTo } = await resolveLoginRequestContext(request);
  if (isSilent) {
    return createSilentSsoResponse('failure');
  }

  return createRedirectResponse(`/?auth=dev-login&returnTo=${encodeURIComponent(returnTo)}`);
};

const resolveLoginAuthConfig = async (request?: Request) => {
  const authConfig = request ? await resolveAuthConfigForRequest(request) : getAuthConfig();
  return { authConfig, authScope: getScopeFromAuthConfig(authConfig) };
};

const createLoginErrorResponse = (request: Request | undefined, error: unknown): Response =>
  request
    ? createAuthDependencyErrorResponse(request, 'auth_login', error)
    : toJsonErrorResponse(500, 'internal_error', 'Authentifizierung ist momentan nicht verfügbar.');

const resolveLogoutUrl = async ({
  request,
  authConfig,
  authScope,
}: {
  readonly request: Request;
  readonly authConfig: Awaited<ReturnType<typeof resolveAuthConfigForRequest>>;
  readonly authScope: ReturnType<typeof getScopeFromAuthConfig>;
}): Promise<string> => {
  const { sessionCookieName, postLogoutRedirectUri } = authConfig;
  const sessionId = readCookieFromRequest(request, sessionCookieName);
  if (!sessionId) {
    logger.debug('Logout without session', {
      endpoint: '/auth/logout',
      operation: 'logout',
      session_exists: false,
      ...buildLogContext(authScope),
    });
    return postLogoutRedirectUri;
  }

  try {
    const sessionBeforeLogout = await getSession(sessionId);
    const logoutUrl = await logoutSession(sessionId, authConfig);

    logger.info('Logout successful', {
      endpoint: '/auth/logout',
      operation: 'logout',
      ...summarizeRedirectTarget(logoutUrl),
      ...buildLogContext(
        sessionBeforeLogout?.user?.instanceId ? { kind: 'instance', instanceId: sessionBeforeLogout.user.instanceId } : authScope
      ),
      workspaceId: sessionBeforeLogout?.user?.instanceId ?? getWorkspaceIdForScope(authScope),
      outcome: 'success',
    });

    await emitAuthAuditEvent({
      eventType: 'logout',
      actorUserId: sessionBeforeLogout?.user?.id ?? sessionBeforeLogout?.userId,
      scope: sessionBeforeLogout?.user?.instanceId ? { kind: 'instance', instanceId: sessionBeforeLogout.user.instanceId } : authScope,
      workspaceId: sessionBeforeLogout?.user?.instanceId ?? getWorkspaceIdForScope(authScope),
      outcome: 'success',
    });

    return logoutUrl;
  } catch (error) {
    if (error instanceof SessionStoreUnavailableError) {
      throw error;
    }
    logger.error('Logout failed', {
      endpoint: '/auth/logout',
      operation: 'logout',
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      reason_code: 'logout_failed',
      ...buildLogContext(authScope),
    });
    return postLogoutRedirectUri;
  }
};

const createLogoutResponse = ({
  logoutUrl,
  sessionCookieName,
  silentSsoSuppressCookieName,
  silentSsoSuppressAfterLogoutMs,
  authScope,
}: {
  readonly logoutUrl: string;
  readonly sessionCookieName: string;
  readonly silentSsoSuppressCookieName: string;
  readonly silentSsoSuppressAfterLogoutMs: number;
  readonly authScope: ReturnType<typeof getScopeFromAuthConfig>;
}) => {
  const response = createRedirectResponse(logoutUrl);
  const sessionDeleteStrategy = attachDeletedCookie(response, sessionCookieName);
  const silentSsoSuppressStrategy = attachSilentSsoSuppressCookie(
    response,
    silentSsoSuppressCookieName,
    Date.now() + silentSsoSuppressAfterLogoutMs
  );
  logger.info('Logout cookies prepared', {
    endpoint: '/auth/logout',
    operation: 'logout_cookie_cleanup',
    session_delete_strategy: sessionDeleteStrategy,
    silent_sso_suppress_strategy: silentSsoSuppressStrategy,
    response_set_cookie_count: getSetCookieValues(response.headers).length,
    ...buildLogContext(authScope),
  });
  return response;
};

export const loginHandler = async (request?: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isMockAuthEnabled()) {
      return handleMockLogin(request);
    }

    try {
      const { isSilent, isFreshReauth, returnTo } = await resolveLoginRequestContext(request);
      if (request && isSilent && isSilentSsoSuppressed(request)) {
        return createSilentSsoResponse('failure');
      }

      const { authConfig, authScope } = await resolveLoginAuthConfig(request);
      const { loginStateCookieName, loginStateSecret } = authConfig;
      const { url: authorizationUrl, state, loginState } = await createLoginUrl({
        returnTo,
        silent: isSilent,
        reauth: isFreshReauth,
        authConfig,
      });
      const response = createRedirectResponse(authorizationUrl);
      if (request) {
        attachDebugAuthHeaders(response, { request, authConfig });
      }

      logger.info('Login auth config resolved', {
        operation: 'login_auth_config_resolved',
        scope_kind: authScope.kind,
        ...(request ? summarizeRequestUrl(request) : { endpoint_path: '/auth/login', has_sensitive_query: false }),
        auth_instance_id: authConfig.kind === 'instance' ? authConfig.instanceId : null,
        auth_realm: authConfig.authRealm ?? null,
        auth_client_id: authConfig.clientId,
        auth_redirect_uri: authConfig.redirectUri,
        auth_issuer: authConfig.issuer,
        auth_scope_kind: authScope.kind,
        resolution_result: authScope.kind,
        ...buildLogContext(authScope),
      });

      logger.info('Login-Flow initiiert', {
        operation: 'login_init',
        scope_kind: authScope.kind,
        idp: 'keycloak',
        is_silent: isSilent,
        state: `${state.substring(0, 8)}...`,
        nonce: `${loginState.nonce.substring(0, 8)}...`,
        auth_instance_id: authConfig.kind === 'instance' ? authConfig.instanceId : null,
        auth_realm: authConfig.authRealm ?? null,
        auth_client_id: authConfig.clientId,
        auth_redirect_uri: authConfig.redirectUri,
        auth_issuer: authConfig.issuer,
        auth_scope_kind: authScope.kind,
        ...buildLogContext(authScope),
      });

      const loginStateCookieStrategy = attachLoginStateCookie(response, {
        name: loginStateCookieName,
        secret: loginStateSecret,
        payload: { state, ...loginState },
      });

      logger.info('Login state cookie prepared', {
        operation: 'login_init_cookie',
        strategy: loginStateCookieStrategy,
        response_set_cookie_count: getSetCookieValues(response.headers).length,
        is_silent: isSilent,
        ...buildLogContext(authScope),
      });

      return response;
    } catch (error) {
      return createLoginErrorResponse(request, error);
    }
  });
};

export const accountActionHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    try {
      const url = new URL(request.url);
      const kcAction = mapAccountActionToKeycloakAction(url.searchParams.get('action'));
      if (!kcAction) {
        return toJsonErrorResponse(400, 'invalid_request', 'Unbekannte Account-Aktion.');
      }

      const returnTo = await sanitizeReturnTo(request, url.searchParams.get('returnTo'));
      const { authConfig } = await resolveLoginAuthConfig(request);
      if (kcAction === 'UPDATE_EMAIL' && !(await isUpdateEmailActionSupported(authConfig.authRealm))) {
        return createRedirectResponse(
          appendAccountActionStatusToRedirectTarget(request, returnTo, {
            accountAction: 'email-update-unavailable',
            accountActionType: 'update-email',
          })
        );
      }

      const { url: authorizationUrl, state, loginState } = await createLoginUrl({
        returnTo,
        reauth: true,
        kcAction,
        authConfig,
      });
      const response = createRedirectResponse(authorizationUrl);
      attachDebugAuthHeaders(response, { request, authConfig });

      const loginStateCookieStrategy = attachLoginStateCookie(response, {
        name: authConfig.loginStateCookieName,
        secret: authConfig.loginStateSecret,
        payload: { state, ...loginState },
      });

      logger.info('Account action login state cookie prepared', {
        operation: 'account_action_init_cookie',
        strategy: loginStateCookieStrategy,
        response_set_cookie_count: getSetCookieValues(response.headers).length,
        account_action: kcAction,
        ...buildLogContext(getScopeFromAuthConfig(authConfig)),
      });

      return response;
    } catch (error) {
      return createAuthDependencyErrorResponse(request, 'auth_login', error);
    }
  });
};

export const callbackHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isMockAuthEnabled()) {
      return createRedirectResponse('/?auth=mock-callback');
    }

    try {
      const callbackInput = resolveCallbackInput(request);
      const { code, state, iss } = callbackInput;
      const authConfig = await resolveAuthConfigForRequest(request);
      const authScope = getScopeFromAuthConfig(authConfig);
      const { sessionCookieName } = authConfig;
      const cookieLoginState = state ? await resolveCookieLoginState(request, state) : null;
      const hadSessionCookieOnCallback = Boolean(readCookieFromRequest(request, sessionCookieName));
      const dependencies: CallbackDependencies = {
        authConfig,
        authScope,
        cookieLoginState,
        hadSessionCookieOnCallback,
        callbackInput,
      };

      const cancelledAccountActionResponse = await handleCancelledAccountActionResponse(request, dependencies);
      if (cancelledAccountActionResponse) {
        return cancelledAccountActionResponse;
      }

      const callbackErrorResponse = await handleCallbackErrorResponse(dependencies);
      if (callbackErrorResponse) {
        return callbackErrorResponse;
      }

      if (!code || !state) {
        return createRedirectResponse('/auth/login');
      }

      const expiredCallbackResponse = await handleExpiredCallbackState(dependencies);
      if (expiredCallbackResponse) {
        return expiredCallbackResponse;
      }

      try {
        const { sessionId, user, expiresAt, loginState, retryPerformed } = await handleCallback({
          code,
          state,
          iss,
          loginState: cookieLoginState,
          authConfig,
        });
        const effectiveLoginState = loginState ?? cookieLoginState;
        const redirectTarget = resolveSuccessfulCallbackRedirectTarget(request, callbackInput, effectiveLoginState);
        const isSilent = effectiveLoginState?.silent === true;
        const response = isSilent ? createSilentSsoResponse('success') : createRedirectResponse(redirectTarget);
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
    } catch (error) {
      return createAuthDependencyErrorResponse(request, 'auth_callback', error);
    }
  });
};

export const meHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isActiveDevAuthRequest(request)) {
      return new Response(JSON.stringify({ user: createMockSessionUser() }), {
        status: 200,
        headers: createAuthMeHeaders(),
      });
    }

    logger.info('Auth me request received', {
      endpoint: '/auth/me',
      operation: 'get_current_user',
      cookie_header_present: Boolean(request.headers.get('cookie')),
      session_cookie_present: Boolean(readCookieFromRequest(request, getAuthConfig().sessionCookieName)),
      ...buildLogContext(),
    });

    return withAuthenticatedUser(request, async ({ user, sessionExpiresAt, sessionId }) => {
      const resolution = await resolveAuthMeState(user);

      logger.debug('Auth check successful', {
        endpoint: '/auth/me',
        auth_state: 'authenticated',
        operation: 'get_current_user',
        roles_count: user.roles?.length ?? 0,
        groups_count: resolution.groups.length,
        permission_actions_count: resolution.permissionActions.length,
        permission_status: resolution.permissionStatus,
        ...buildLogContext(user.instanceId ? { kind: 'instance', instanceId: user.instanceId } : undefined),
      });

      const response = createAuthMeResponse(user, resolution, sessionExpiresAt);
      attachSessionCookie(
        response,
        getAuthConfig().sessionCookieName,
        sessionId,
        sessionExpiresAt
      );
      return response;
    });
  });
};

export const devLoginHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (!isMockAuthEnabled()) {
      return createNotFoundResponse();
    }

    const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
    if (csrfError) {
      return csrfError;
    }

    const url = new URL(request.url);
    const returnTo = await sanitizeReturnTo(request, url.searchParams.get('returnTo'));
    const response = createRedirectResponse(returnTo);
    appendSetCookie(response, createDevAuthCookie());
    return response;
  });
};

export const devLogoutHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (!isMockAuthEnabled()) {
      return createNotFoundResponse();
    }

    const url = new URL(request.url);
    const returnTo = await sanitizeReturnTo(request, url.searchParams.get('returnTo'));
    const response = createRedirectResponse(returnTo);
    appendSetCookie(response, deleteCookieHeader(DEV_AUTH_COOKIE_NAME));
    return response;
  });
};

export const logoutHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    if (isActiveDevAuthRequest(request)) {
      const response = createRedirectResponse('/');
      appendSetCookie(response, deleteCookieHeader(DEV_AUTH_COOKIE_NAME));
      return response;
    }

    try {
      if (!(await hasExplicitLogoutIntent(request))) {
        logger.warn('Logout rejected without explicit user intent', {
          endpoint: '/auth/logout',
          operation: 'logout',
          reason_code: 'missing_logout_intent',
          ...buildLogContext(undefined),
        });

        return toJsonErrorResponse(400, 'logout_intent_required', 'Logout requires explicit user intent.', {
          requestId: getWorkspaceContext().requestId,
        });
      }

      const authConfig = await resolveAuthConfigForRequest(request);
      const authScope = getScopeFromAuthConfig(authConfig);
      const { sessionCookieName, postLogoutRedirectUri, silentSsoSuppressCookieName, silentSsoSuppressAfterLogoutMs } =
        authConfig;
      const logoutUrl = await resolveLogoutUrl({ request, authConfig, authScope });
      return createLogoutResponse({
        logoutUrl: logoutUrl || postLogoutRedirectUri,
        sessionCookieName,
        silentSsoSuppressCookieName,
        silentSsoSuppressAfterLogoutMs,
        authScope,
      });
    } catch (error) {
      return createAuthDependencyErrorResponse(request, 'auth_logout', error);
    }
  });
};
