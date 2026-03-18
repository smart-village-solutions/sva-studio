import { getWorkspaceContext } from '@sva/sdk/server';

import { getPermissionCacheHealth } from '../iam-authorization/shared';
import { isRedisAvailable } from '../redis.server';
import { jsonResponse } from '../shared/db-helpers';

import {
  isKeycloakIdentityProvider,
  resolveIdentityProvider,
  resolvePool,
  trackKeycloakCall,
} from './shared';

export const readyInternal = async (request: Request): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const dbReady = await (async () => {
    try {
      const pool = resolvePool();
      if (!pool) {
        return false;
      }
      const client = await pool.connect();
      try {
        await client.query('SELECT 1;');
        return true;
      } finally {
        client.release();
      }
    } catch {
      return false;
    }
  })();

  const redisReady = await isRedisAvailable();

  const keycloakReady = await (async () => {
    const idp = resolveIdentityProvider();
    if (!idp) {
      return false;
    }
    if (isKeycloakIdentityProvider(idp.provider)) {
      try {
        await trackKeycloakCall('readiness_list_roles', () => idp.provider.listRoles());
        return true;
      } catch {
        return false;
      }
    }
    return true;
  })();

  const authorizationCache = getPermissionCacheHealth();
  const allReady = dbReady && redisReady && keycloakReady;
  const failed = !allReady || authorizationCache.status === 'failed';

  return jsonResponse(failed ? 503 : 200, {
    status: failed ? 'not_ready' : authorizationCache.status === 'degraded' ? 'degraded' : 'ready',
    checks: {
      db: dbReady,
      redis: redisReady,
      keycloak: keycloakReady,
      authorizationCache,
    },
    ...(requestContext.requestId ? { requestId: requestContext.requestId } : {}),
    timestamp: new Date().toISOString(),
    path: new URL(request.url).pathname,
  });
};

export const liveInternal = async (request: Request): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  return jsonResponse(200, {
    status: 'alive',
    timestamp: new Date().toISOString(),
    path: new URL(request.url).pathname,
    ...(requestContext.requestId ? { requestId: requestContext.requestId } : {}),
  });
};
