import { randomUUID } from 'node:crypto';
import { createSdkLogger } from '@sva/server-runtime';
import { z } from 'zod';

import {
  buildLogContext,
  getAuthConfig,
  getScopeFromAuthConfig,
  isRetryableTokenExchangeError,
  jitProvisionAccount,
  type AuthConfig,
  type InstanceScopeRef,
  type LoginState,
  type PlatformScopeRef,
  type ScopeKind,
} from '@sva/auth/server';

import { client, getOidcConfig, invalidateOidcConfig } from '../oidc.js';
import { consumeLoginState, createSession, getSessionControlState } from '../redis-session.js';
import { buildSessionUser, resolveSessionExpiry } from './shared.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

type UntrustedLoginState = {
  codeVerifier: string;
  nonce: string;
  createdAt: number;
  returnTo?: string;
  silent?: boolean;
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
});

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

const persistSession = async (input: {
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  claims: Record<string, unknown>;
  clientId: string;
  authConfig: AuthConfig;
  expiresAt?: number;
}) => {
  const sessionId = randomUUID();
  const issuedAt = Date.now();
  const { sessionTtlMs } = input.authConfig;
  const sessionControlState = await getSessionControlState(readClaimSubject(input.claims));
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
      postLogoutRedirectUri: input.authConfig.postLogoutRedirectUri,
    },
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    idToken: input.idToken,
    expiresAt,
    createdAt: issuedAt,
    issuedAt,
    sessionVersion,
  });

  return { sessionId, user, expiresAt };
};

const syncJitProvisioning = async (instanceId: string | undefined, keycloakSubject: string) => {
  try {
    await jitProvisionAccount({ instanceId, keycloakSubject });
  } catch (error) {
    logger.error('JIT provisioning failed after callback', {
      operation: 'jit_provision',
      user_id: keycloakSubject,
      instance_id: instanceId,
      error: error instanceof Error ? error.message : String(error),
      ...buildLogContext(instanceId),
    });
  }
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
    expiresAt: resolveSessionExpiry({
      expiresInSeconds: tokenSet.expiresIn(),
      issuedAt: Date.now(),
      sessionTtlMs: authConfig.sessionTtlMs,
    }),
  });

  await syncJitProvisioning(persisted.user.instanceId, persisted.user.id);

  logger.debug('Session created for authenticated user', {
    operation: 'session_create',
    user_id: persisted.user.id,
    has_refresh_token: Boolean(tokenSet.refresh_token),
    ...buildLogContext(persisted.user.instanceId),
  });

  return { ...persisted, loginState: normalizedLoginState, retryPerformed };
};
