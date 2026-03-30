import { randomUUID } from 'node:crypto';
import { createSdkLogger } from '@sva/sdk/server';

import { getAuthConfig } from '../config.js';
import { jitProvisionAccount } from '../jit-provisioning.server.js';
import { client, getOidcConfig } from '../oidc.server.js';
import { consumeLoginState, createSession, getSessionControlState } from '../redis-session.server.js';
import type { LoginState } from '../types.js';
import { buildLogContext } from '../shared/log-context.js';
import { buildSessionUser, resolveSessionExpiry } from './shared.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const readClaimSubject = (claims: Record<string, unknown>): string => {
  const subject = claims.sub;
  return typeof subject === 'string' ? subject : '';
};

const persistSession = async (input: {
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  claims: Record<string, unknown>;
  clientId: string;
  expiresAt?: number;
}) => {
  const sessionId = randomUUID();
  const issuedAt = Date.now();
  const { sessionTtlMs } = getAuthConfig();
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
  });

  await createSession(sessionId, {
    id: sessionId,
    userId: user.id,
    user,
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

export const handleCallback = async (params: {
  code: string;
  state: string;
  iss?: string | null;
  loginState?: LoginState | null;
}) => {
  const authConfig = getAuthConfig();
  const config = await getOidcConfig();
  const loginState = params.loginState ?? (await consumeLoginState(params.state));

  if (!loginState) {
    throw new Error('Invalid login state');
  }

  const callbackUrl = new URL(authConfig.redirectUri);
  callbackUrl.searchParams.set('code', params.code);
  callbackUrl.searchParams.set('state', params.state);
  if (params.iss) {
    callbackUrl.searchParams.set('iss', params.iss);
  }

  const tokenSet = await client.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: loginState.codeVerifier,
    expectedState: params.state,
    expectedNonce: loginState.nonce,
  });
  const claims = (tokenSet.claims() ?? {}) as Record<string, unknown>;

  const persisted = await persistSession({
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    idToken: tokenSet.id_token,
    claims,
    clientId: authConfig.clientId,
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

  return { ...persisted, loginState };
};
