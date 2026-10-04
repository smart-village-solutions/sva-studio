import { type IamUserGroupAssignment } from '@sva/core';
import { sanitizeAuthReturnTo } from './auth-return-to.js';
import { getAuthConfig, resolveAuthConfigForRequest } from './config.js';
import { readCookieFromRequest } from './cookies.js';
import { decodeLoginStateCookie } from './login-state-cookie.js';
import { getScopeFromAuthConfig } from './scope.js';
import { hasActiveMockAuthSession, isMockAuthEnabled } from './mock-auth.js';
import type { AccountActionIntent } from './types.js';

export const DEFAULT_POST_LOGIN_REDIRECT = '/';

const LOGOUT_INTENT_HEADER = 'x-sva-logout-intent';

const LOGOUT_INTENT_VALUE = 'user';

const LOGOUT_INTENT_FORM_FIELD = 'logoutIntent';

type KeycloakAccountAction = 'UPDATE_PASSWORD' | 'UPDATE_EMAIL';

export const mapAccountActionToKeycloakAction = (action: string | null): KeycloakAccountAction | null => {
  if (action === 'update-password') {
    return 'UPDATE_PASSWORD';
  }

  if (action === 'update-email') {
    return 'UPDATE_EMAIL';
  }

  return null;
};

export const mapKeycloakActionToAccountActionIntent = (
  action: string | null | undefined
): AccountActionIntent | null => {
  if (action === 'UPDATE_PASSWORD') {
    return 'update-password';
  }

  if (action === 'UPDATE_EMAIL') {
    return 'update-email';
  }

  return null;
};

export const mapAccountActionIntentToStatus = (
  accountActionIntent: AccountActionIntent,
  callbackInput?: ReturnType<typeof resolveCallbackInput>
): string | null => {
  if (accountActionIntent === 'update-password') {
    return callbackInput?.kcAction === 'UPDATE_PASSWORD' &&
      callbackInput.kcActionStatus === 'success'
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

export const appendAccountActionStatusToRedirectTarget = (
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

export const resolveCallbackInput = (request: Request) => {
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

export const hasExplicitLogoutIntent = async (request: Request): Promise<boolean> => {
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

export const sanitizeReturnTo = async (
  request: Request,
  value: string | null | undefined
): Promise<string> => {
  return sanitizeAuthReturnTo(request, value, { defaultPath: DEFAULT_POST_LOGIN_REDIRECT });
};

export const isActiveDevAuthRequest = (request: Request): boolean =>
  isMockAuthEnabled() && hasActiveMockAuthSession(request);

export const resolveCookieLoginState = async (request: Request, state: string) => {
  const { loginStateCookieName, loginStateSecret } = getAuthConfig();
  const payload = decodeLoginStateCookie(
    readCookieFromRequest(request, loginStateCookieName),
    loginStateSecret
  );

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
    ...(payload.kind === 'instance'
      ? { kind: 'instance' as const, instanceId: payload.instanceId }
      : { kind: 'platform' as const }),
  };
};

export const isExpiredLoginState = (createdAt: number) => Date.now() - createdAt > 10 * 60 * 1000;

export const isSilentSsoSuppressed = (request: Request): boolean => {
  const { silentSsoSuppressCookieName } = getAuthConfig();
  const suppressUntil = Number(readCookieFromRequest(request, silentSsoSuppressCookieName) ?? '');
  return Number.isFinite(suppressUntil) && suppressUntil > Date.now();
};

export type AuthScope = ReturnType<typeof getScopeFromAuthConfig>;

export type CallbackDependencies = {
  readonly authConfig: Awaited<ReturnType<typeof resolveAuthConfigForRequest>>;
  readonly authScope: AuthScope;
  readonly cookieLoginState: Awaited<ReturnType<typeof resolveCookieLoginState>>;
  readonly hadSessionCookieOnCallback: boolean;
  readonly callbackInput: ReturnType<typeof resolveCallbackInput>;
};

export type AuthMeResolution = {
  readonly instanceDisplayName?: string;
  readonly permissionActions: string[];
  readonly permissionStatus: 'ok' | 'degraded';
  readonly assignedModules: string[];
  readonly moduleAccessPending: boolean;
  readonly groups: readonly IamUserGroupAssignment[];
};
