import { emitAuthAuditEvent } from './audit-events.js';
import { buildLogContext } from './log-context.js';
import { getWorkspaceIdForScope } from './scope.js';
import type { AccountActionIntent } from './types.js';
import { logger, createRedirectResponse } from './auth-route-responses.js';
import { getSetCookieValues, attachDeletedCookie, createSilentSsoResponse } from './auth-route-cookies.js';
import { DEFAULT_POST_LOGIN_REDIRECT, mapKeycloakActionToAccountActionIntent, mapAccountActionIntentToStatus, appendAccountActionStatusToRedirectTarget, resolveCallbackInput, resolveCookieLoginState, isExpiredLoginState, type AuthScope, type CallbackDependencies } from './auth-route-state.js';

export const logCallbackCookieCleanup = (
  message:
    | 'Callback cookie cleanup prepared'
    | 'Expired callback cookie cleanup prepared'
    | 'Failed callback cookie cleanup prepared',
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

export const emitCallbackFailureAuditEvent = async (input: {
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

export const createCallbackFailureResponse = (isSilent: boolean, location = '/?auth=error') =>
  isSilent ? createSilentSsoResponse('failure') : createRedirectResponse(location);

export const handleCallbackErrorResponse = async (
  dependencies: CallbackDependencies
): Promise<Response | null> => {
  if (!dependencies.callbackInput.error) {
    return null;
  }

  const response = createCallbackFailureResponse(dependencies.cookieLoginState?.silent === true);
  const loginStateDeleteStrategy = attachDeletedCookie(
    response,
    dependencies.authConfig.loginStateCookieName
  );
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

export const handleCancelledAccountActionResponse = async (
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
  const loginStateDeleteStrategy = attachDeletedCookie(
    response,
    dependencies.authConfig.loginStateCookieName
  );
  logCallbackCookieCleanup(
    'Callback cookie cleanup prepared',
    response,
    loginStateDeleteStrategy,
    dependencies.hadSessionCookieOnCallback,
    dependencies.cookieLoginState ?? dependencies.authScope
  );
  return response;
};

export const resolveSuccessfulCallbackRedirectTarget = (
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

  const accountAction = mapAccountActionIntentToStatus(
    effectiveLoginState.accountActionIntent,
    callbackInput
  );
  if (!accountAction) {
    return redirectTargetBase;
  }

  return appendAccountActionStatusToRedirectTarget(request, redirectTargetBase, {
    accountAction,
  });
};

export const handleExpiredCallbackState = async (
  dependencies: CallbackDependencies
): Promise<Response | null> => {
  if (
    !dependencies.cookieLoginState ||
    !isExpiredLoginState(dependencies.cookieLoginState.createdAt)
  ) {
    return null;
  }

  const response = createRedirectResponse('/?auth=state-expired');
  const loginStateDeleteStrategy = attachDeletedCookie(
    response,
    dependencies.authConfig.loginStateCookieName
  );
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
