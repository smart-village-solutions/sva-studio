import { getWorkspaceContext, toJsonErrorResponse, toSafeLogPath, withRequestContext } from '@sva/server-runtime';
import { getAuthConfig, resolveAuthConfigForRequest } from './config.js';
import { createLoginUrl } from './auth-server/login.js';
import { isUpdateEmailActionSupported } from './keycloak-account-action-support.js';
import { appendSetCookie } from './cookies.js';
import { buildLogContext } from './log-context.js';
import { getScopeFromAuthConfig } from './scope.js';
import { isMockAuthEnabled } from './mock-auth.js';
import { validateCsrf } from './shared/request-security.js';
import { logger, createRedirectResponse, createNotFoundResponse, summarizeRequestUrl, createAuthDependencyErrorResponse, attachDebugAuthHeaders } from './auth-route-responses.js';
import { createDevAuthCookie, getSetCookieValues, attachLoginStateCookie, createSilentSsoResponse } from './auth-route-cookies.js';
import { DEFAULT_POST_LOGIN_REDIRECT, mapAccountActionToKeycloakAction, appendAccountActionStatusToRedirectTarget, sanitizeReturnTo, isSilentSsoSuppressed } from './auth-route-state.js';

const resolveLoginRequestContext = async (request?: Request) => {
  const url = request ? new URL(request.url) : null;
  const isSilent = url?.searchParams.get('silent') === '1';
  const isFreshReauth = url?.searchParams.get('reauth') === '1';
  const returnTo = request
    ? await sanitizeReturnTo(
        request,
        url?.searchParams.get('returnTo') ?? url?.searchParams.get('redirect')
      )
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
      const {
        url: authorizationUrl,
        state,
        loginState,
      } = await createLoginUrl({
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
        ...(request
          ? summarizeRequestUrl(request)
          : { endpoint_path: '/auth/login', has_sensitive_query: false }),
        auth_instance_id: authConfig.kind === 'instance' ? authConfig.instanceId : null,
        auth_realm: authConfig.authRealm ?? null,
        auth_client_id: authConfig.clientId,
        auth_redirect_path: toSafeLogPath(authConfig.redirectUri),
        auth_issuer_path: toSafeLogPath(authConfig.issuer),
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
        auth_redirect_path: toSafeLogPath(authConfig.redirectUri),
        auth_issuer_path: toSafeLogPath(authConfig.issuer),
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
      if (
        kcAction === 'UPDATE_EMAIL' &&
        !(await isUpdateEmailActionSupported(authConfig.authRealm))
      ) {
        return createRedirectResponse(
          appendAccountActionStatusToRedirectTarget(request, returnTo, {
            accountAction: 'email-update-unavailable',
            accountActionType: 'update-email',
          })
        );
      }

      const {
        url: authorizationUrl,
        state,
        loginState,
      } = await createLoginUrl({
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
