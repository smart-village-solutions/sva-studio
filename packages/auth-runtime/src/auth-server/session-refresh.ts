import { createSdkLogger } from '@sva/server-runtime';

import { getAuthConfig, resolveAuthConfigForInstance, resolveAuthConfigFromSessionAuth } from '../config.js';
import type { Session, SessionUser } from '../types.js';

import { client, getOidcConfig } from '../oidc.js';
import { updateSession } from '../redis-session.js';
import { buildSessionUser, resolveSessionExpiry } from './shared.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const resolveRefreshAuthConfig = async (session: Session) => {
  if (session.auth?.kind === 'instance') {
    const originSource = session.auth.redirectUri ?? session.auth.postLogoutRedirectUri;

    if (!session.auth.redirectUri) {
      logger.warn('Instance session refresh fell back to post-logout redirect URI because redirect URI is missing', {
        instance_id: session.auth.instanceId,
        post_logout_redirect_uri: session.auth.postLogoutRedirectUri,
      });
    }

    let origin: string | undefined;
    try {
      origin = new URL(originSource).origin;
    } catch (error) {
      logger.warn('Instance session refresh ignored invalid redirect URI', {
        instance_id: session.auth.instanceId,
        redirect_uri: session.auth.redirectUri,
        post_logout_redirect_uri: session.auth.postLogoutRedirectUri,
        error_message: error instanceof Error ? error.message : String(error),
      });
      origin = undefined;
    }

    return resolveAuthConfigForInstance(session.auth.instanceId, origin ? { origin } : {});
  }

  return session.auth
    ? resolveAuthConfigFromSessionAuth(session.auth)
    : getAuthConfig();
};

export const refreshSession = async (
  sessionId: string,
  session: Session
): Promise<SessionUser> => {
  const authConfig = await resolveRefreshAuthConfig(session);
  const config = await getOidcConfig(authConfig);
  const refreshed = await client.refreshTokenGrant(config, session.refreshToken ?? '');
  const updatedUser = buildSessionUser({
    accessToken: refreshed.access_token,
    claims: (refreshed.claims() ?? {}) as Record<string, unknown>,
    clientId: authConfig.clientId,
    scope: session.auth,
  });

  await updateSession(sessionId, {
    user: updatedUser,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? session.refreshToken,
    idToken: refreshed.id_token,
    expiresAt: resolveSessionExpiry({
      expiresInSeconds: refreshed.expiresIn(),
      issuedAt: session.issuedAt ?? session.createdAt,
      sessionTtlMs: authConfig.sessionTtlMs,
      fallback: session.expiresAt,
    }),
  });

  return updatedUser;
};
