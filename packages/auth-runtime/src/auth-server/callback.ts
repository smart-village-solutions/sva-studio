import { randomUUID } from 'node:crypto';
import { createSdkLogger } from '@sva/server-runtime';
import { z } from 'zod';

import { getAuthConfig } from '../config.js';
import { buildLogContext } from '../log-context.js';
import { client, getOidcConfig, invalidateOidcConfig } from '../oidc.js';
import { consumeLoginState, createSession, getSessionControlState } from '../redis-session.js';
import { isRetryableTokenExchangeError } from '../error-guards.js';
import { getScopeFromAuthConfig } from '../scope.js';
import type { AuthConfig, InstanceScopeRef, LoginState, PlatformScopeRef, ScopeKind } from '../types.js';
import { runPostLoginTasks } from './post-login-tasks.js';
import { buildSessionUser, resolveSessionExpiry } from './shared.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

type UntrustedLoginState = {
  codeVerifier: string;
  nonce: string;
  createdAt: number;
  returnTo?: string;
  silent?: boolean;
  freshReauthRequested?: boolean;
  kind: ScopeKind;
  instanceId?: string;
};

const nonNegativeFiniteNumberSchema = z.number().refine(
  (value) => Number.isFinite(value) && value >= 0,
  'expected non-negative finite number'
);

const baseLoginStateSchema = z.object({
  codeVerifier: z.string().trim().min(1),
  nonce: z.string().trim().min(1),
  createdAt: nonNegativeFiniteNumberSchema,
  returnTo: z.string().trim().min(1).optional(),
  silent: z.boolean().optional(),
  freshReauthRequested: z.boolean().optional(),
});

const AUTH_TIME_SKEW_MS = 1_000;

const untrustedLoginStateSchema = z.discriminatedUnion('kind', [
  baseLoginStateSchema.extend({ kind: z.literal('platform') }),
  baseLoginStateSchema.extend({
    kind: z.literal('instance'),
    instanceId: z.string().trim().min(1),
  }),
]);

const readClaimSubject = (claims: Record<string, unknown>): string => {
  const subject = claims.sub;
  return typeof subject === 'string' ? subject : '';
};

const isLoginBlocked = (state: Awaited<ReturnType<typeof getSessionControlState>>): boolean => state?.loginBlocked === true;

const normalizeLoginState = (loginState: UntrustedLoginState): LoginState => {
  if (loginState.kind === 'instance' && typeof loginState.instanceId !== 'string') {
    throw new Error('Invalid login state: missing instanceId for instance scope');
  }

  const parsedLoginState = untrustedLoginStateSchema.safeParse(loginState);
  if (!parsedLoginState.success) {
    throw new Error('Invalid login state payload');
  }

  const normalizedState = parsedLoginState.data;

  if (normalizedState.kind === 'platform') {
    const { ...rest } = normalizedState;
    return {
      ...rest,
      kind: 'platform',
    } satisfies PlatformScopeRef & Omit<LoginState, 'kind' | 'instanceId'>;
  }

  const instanceId = normalizedState.instanceId.trim();
  if (!instanceId) {
    throw new Error('Invalid login state: missing instanceId for instance scope');
  }

  return {
    ...normalizedState,
    kind: 'instance',
    instanceId,
  } satisfies InstanceScopeRef & Omit<LoginState, 'kind' | 'instanceId'>;
};

const assertLoginStateMatchesAuthConfig = (authConfig: AuthConfig, loginState: LoginState): void => {
  const authScope = getScopeFromAuthConfig(authConfig);

  if (authScope.kind !== loginState.kind) {
    throw new Error('Invalid login state: scope mismatch');
  }

  if (
    authScope.kind === 'instance' &&
    loginState.kind === 'instance' &&
    loginState.instanceId !== authScope.instanceId
  ) {
    throw new Error('Invalid login state: instance mismatch');
  }
};

const readFreshReauthAt = (input: {
  claims: Record<string, unknown>;
  loginState: LoginState;
  issuedAt: number;
}): number | undefined => {
  if (input.loginState.silent === true || input.loginState.freshReauthRequested !== true) {
    return undefined;
  }

  const authTimeClaim = input.claims.auth_time;
  if (typeof authTimeClaim !== 'number' || !Number.isFinite(authTimeClaim) || authTimeClaim < 0) {
    return undefined;
  }

  const authTimeMs = authTimeClaim * 1_000;
  if (authTimeMs + AUTH_TIME_SKEW_MS < input.loginState.createdAt) {
    return undefined;
  }

  if (authTimeMs - AUTH_TIME_SKEW_MS > input.issuedAt) {
    return undefined;
  }

  return authTimeMs;
};

const persistSession = async (input: {
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  claims: Record<string, unknown>;
  clientId: string;
  authConfig: AuthConfig;
  loginState: LoginState;
  expiresAt?: number;
}) => {
  const sessionId = randomUUID();
  const issuedAt = Date.now();
  const { sessionTtlMs } = input.authConfig;
  const sessionControlState = await getSessionControlState(readClaimSubject(input.claims));
  if (isLoginBlocked(sessionControlState)) {
    throw new Error('Account is blocked from starting new sessions');
  }
  const sessionVersion = Math.max(sessionControlState?.minimumSessionVersion ?? 1, 1);
  const expiresAt = resolveSessionExpiry({
    expiresInSeconds: undefined,
    issuedAt,
    sessionTtlMs,
    fallback: input.expiresAt,
  });
  const user = buildSessionUser({
    accessToken: input.accessToken,
    claims: input.claims,
    clientId: input.clientId,
    scope: getScopeFromAuthConfig(input.authConfig),
  });

  await createSession(sessionId, {
    id: sessionId,
    userId: user.id,
    user,
    auth: {
      ...getScopeFromAuthConfig(input.authConfig),
      issuer: input.authConfig.issuer,
      clientId: input.authConfig.clientId,
      authRealm: input.authConfig.authRealm,
      redirectUri: input.authConfig.redirectUri,
      postLogoutRedirectUri: input.authConfig.postLogoutRedirectUri,
    },
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    idToken: input.idToken,
    expiresAt,
    createdAt: issuedAt,
    freshReauthAt: readFreshReauthAt({
      claims: input.claims,
      loginState: input.loginState,
      issuedAt,
    }),
    issuedAt,
    sessionVersion,
  });

  return { sessionId, user, expiresAt };
};

const exchangeAuthorizationCode = async (input: {
  authConfig: AuthConfig;
  callbackUrl: URL;
  loginState: LoginState;
  state: string;
}) => {
  const grant = async () => {
    const config = await getOidcConfig(input.authConfig);
    return client.authorizationCodeGrant(config, input.callbackUrl, {
      pkceCodeVerifier: input.loginState.codeVerifier,
      expectedState: input.state,
      expectedNonce: input.loginState.nonce,
    });
  };

  try {
    return {
      tokenSet: await grant(),
      retryPerformed: false,
    };
  } catch (error) {
    if (!isRetryableTokenExchangeError(error)) {
      throw error;
    }

    invalidateOidcConfig(input.authConfig);
    logger.warn('OIDC config cache invalidated after token exchange failure; retrying once', {
      operation: 'token_validate_retry',
      issuer: input.authConfig.issuer,
      client_id: input.authConfig.clientId,
      ...buildLogContext(getScopeFromAuthConfig(input.authConfig)),
    });
    return {
      tokenSet: await grant(),
      retryPerformed: true,
    };
  }
};

export const handleCallback = async (params: {
  code: string;
  state: string;
  iss?: string | null;
  loginState?: UntrustedLoginState | null;
  authConfig?: AuthConfig;
}) => {
  const authConfig = params.authConfig ?? getAuthConfig();
  const loginState = params.loginState ?? (await consumeLoginState(params.state));

  if (!loginState) {
    throw new Error('Invalid login state');
  }
  const normalizedLoginState = normalizeLoginState(loginState);
  assertLoginStateMatchesAuthConfig(authConfig, normalizedLoginState);

  const callbackUrl = new URL(authConfig.redirectUri);
  callbackUrl.searchParams.set('code', params.code);
  callbackUrl.searchParams.set('state', params.state);
  if (params.iss) {
    callbackUrl.searchParams.set('iss', params.iss);
  }

  const { tokenSet, retryPerformed } = await exchangeAuthorizationCode({
    authConfig,
    callbackUrl,
    loginState: normalizedLoginState,
    state: params.state,
  });
  const claims = (tokenSet.claims() ?? {}) as Record<string, unknown>;

  const persisted = await persistSession({
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    idToken: tokenSet.id_token,
    claims,
    clientId: authConfig.clientId,
    authConfig,
    loginState: normalizedLoginState,
    expiresAt: resolveSessionExpiry({
      expiresInSeconds: tokenSet.expiresIn(),
      issuedAt: Date.now(),
      sessionTtlMs: authConfig.sessionTtlMs,
    }),
  });

  await runPostLoginTasks(persisted.user.instanceId, persisted.user.id);

  logger.debug('Session created for authenticated user', {
    operation: 'session_create',
    user_id: persisted.user.id,
    has_refresh_token: Boolean(tokenSet.refresh_token),
    ...buildLogContext(persisted.user.instanceId),
  });

  return { ...persisted, loginState: normalizedLoginState, retryPerformed };
};
