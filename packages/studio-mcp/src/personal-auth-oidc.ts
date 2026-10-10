import { personalSessionBinding, persistPersonalSession } from './personal-session-store.js';
import { ServerResponse } from 'node:http';
import * as oidc from 'openid-client';
import type { PersonalMcpContext } from './config.js';
import { PersonalMcpAuthError } from './personal-auth-errors.js';

export const CALLBACK_HOST = '127.0.0.1';
export const CALLBACK_PORT = 8765;
export const CALLBACK_PATH = '/callback';
const LOGIN_TIMEOUT_MS = 5 * 60_000;

export const callbackUri = (port: number): string =>
  `http://${CALLBACK_HOST}:${port}${CALLBACK_PATH}`;

export const writeCallbackPage = (
  response: ServerResponse,
  status: number,
  message: string
): void => {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy':
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  });
  response.end(
    `<!doctype html><meta charset="utf-8"><title>SVA Studio MCP</title><p>${message}</p>`
  );
};

export const isLoopback = (address: string | undefined): boolean =>
  address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';

const assertIssuerEndpoints = (
  context: PersonalMcpContext,
  configuration: oidc.Configuration
): void => {
  const issuer = new URL(context.issuer);
  const metadata = configuration.serverMetadata();
  if (metadata.issuer !== context.issuer.replace(/\/$/u, ''))
    throw new PersonalMcpAuthError('oidc_provider_unavailable');
  for (const endpoint of [
    metadata.authorization_endpoint,
    metadata.token_endpoint,
    metadata.userinfo_endpoint,
    metadata.revocation_endpoint,
    metadata.jwks_uri,
  ]) {
    if (!endpoint) continue;
    const url = new URL(endpoint);
    if (url.origin !== issuer.origin || url.protocol !== issuer.protocol) {
      throw new PersonalMcpAuthError('oidc_provider_unavailable');
    }
  }
  if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.userinfo_endpoint) {
    throw new PersonalMcpAuthError('oidc_provider_unavailable');
  }
};

export const discoverConfiguration = async (
  context: PersonalMcpContext,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<oidc.Configuration> => {
  const issuer = new URL(context.issuer);
  const configuration = await oidc.discovery(issuer, context.clientId, undefined, undefined, {
    [oidc.customFetch]: async (input, init) => {
      const url = new URL(input.toString());
      if (url.origin !== issuer.origin || url.protocol !== issuer.protocol) {
        throw new PersonalMcpAuthError('oidc_provider_unavailable');
      }
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      return fetchImpl(
        input as unknown as Parameters<typeof fetchImpl>[0],
        { ...init, signal, redirect: 'error' } as unknown as RequestInit
      );
    },
  });
  assertIssuerEndpoints(context, configuration);
  return configuration;
};

export const refreshPersonalSession = async (
  context: PersonalMcpContext,
  session: import('./personal-auth-callback.js').PersonalSession,
  configuration: oidc.Configuration
): Promise<import('./personal-auth-callback.js').PersonalSession> => {
  assertIssuerEndpoints(context, configuration);
  const response = await oidc.refreshTokenGrant(configuration, session.refreshToken as string);
  if (typeof response.access_token !== 'string')
    throw new PersonalMcpAuthError('oidc_token_refresh_failed');
  const identity = await oidc.fetchUserInfo(configuration, response.access_token, session.subject);
  if (
    identity.sub !== session.subject ||
    (response.claims()?.sub && response.claims()?.sub !== session.subject)
  ) {
    throw new PersonalMcpAuthError('oidc_token_refresh_failed');
  }
  return {
    ...session,
    account:
      typeof identity.preferred_username === 'string'
        ? identity.preferred_username
        : session.account,
    accessToken: response.access_token,
    accessTokenExpiresAt: Date.now() + (response.expiresIn() ?? 60) * 1000,
    refreshToken: response.refresh_token ?? session.refreshToken,
  };
};

export const restorePersonalSession = async (
  context: PersonalMcpContext,
  store: import('./personal-session-store.js').PersonalSessionStore,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<import('./personal-auth-callback.js').PersonalSession | undefined> => {
  const stored = await store.load(context);
  if (!stored) return undefined;
  try {
    if (stored.binding !== personalSessionBinding(context))
      throw new PersonalMcpAuthError('context_login_required');
    const session = await refreshPersonalSession(
      context,
      {
        contextId: context.id,
        subject: stored.subject,
        account: stored.account,
        accessToken: '',
        accessTokenExpiresAt: 0,
        refreshToken: stored.refreshToken,
      },
      await discoverConfiguration(context, fetchImpl, timeoutMs)
    );
    await persistPersonalSession(context, session, store);
    return session;
  } catch (error) {
    await store.delete(context);
    if (error instanceof PersonalMcpAuthError && error.code === 'personal_session_store_unavailable') throw error;
    throw new PersonalMcpAuthError('context_login_required');
  }
};

export const createPersonalLogin = async (
  context: PersonalMcpContext,
  configuration: oidc.Configuration,
  port: number,
  loginTimeoutMs: number | undefined,
  onTimeout: (state: string) => void
): Promise<{
  pending: import('./personal-auth-callback.js').PendingPersonalLogin;
  loginUrl: string;
}> => {
  const timeoutMs = loginTimeoutMs ?? LOGIN_TIMEOUT_MS;
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const redirectUri = callbackUri(port);
  const loginUrl = oidc.buildAuthorizationUrl(configuration, {
    client_id: context.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: 'openid profile',
    prompt: 'login',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  const timeout = setTimeout(() => onTimeout(state), timeoutMs);
  timeout.unref();
  const pending = {
    context,
    configuration,
    state,
    nonce,
    codeVerifier,
    expiresAt: Date.now() + timeoutMs,
    timeout,
  };
  return { pending, loginUrl: loginUrl.href };
};

export const revokePersonalSession = async (
  context: PersonalMcpContext,
  refreshToken: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<void> => {
  try {
    const configuration = await discoverConfiguration(context, fetchImpl, timeoutMs);
    if (!configuration.serverMetadata().revocation_endpoint)
      throw new PersonalMcpAuthError('oidc_logout_revocation_failed');
    await oidc.tokenRevocation(configuration, refreshToken, { token_type_hint: 'refresh_token' });
  } catch {
    throw new PersonalMcpAuthError('oidc_logout_revocation_failed');
  }
};

export const revokePersonalSessions = async (
  sessions: readonly [string, import('./personal-auth-callback.js').PersonalSession][],
  contexts: ReadonlyMap<string, PersonalMcpContext>,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<void> => {
  await Promise.all(
    sessions.map(async ([contextId, session]) => {
      const context = contexts.get(contextId);
      if (!context || !session.refreshToken) return;
      try {
        await revokePersonalSession(context, session.refreshToken, fetchImpl, timeoutMs);
      } catch {
        /* Shutdown remains local and best-effort; no credential detail is emitted. */
      }
    })
  );
};
