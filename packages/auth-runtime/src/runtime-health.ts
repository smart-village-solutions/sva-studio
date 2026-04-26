import { getWorkspaceContext, withRequestContext } from '@sva/server-runtime';

import { jsonResponse, resolvePool } from './db.js';
import {
  isKeycloakIdentityProvider,
  resolveIdentityProvider,
  trackKeycloakCall,
} from './iam-account-management/shared.js';
import { getLastRedisError, isRedisAvailable } from './redis.js';

const withHealthRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

const checkDatabase = async (): Promise<{ ready: boolean; error?: string }> => {
  const pool = resolvePool();
  if (!pool) {
    return { ready: false, error: 'IAM database not configured' };
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1;');
      return { ready: true };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      ready: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const checkRedis = async (): Promise<{ ready: boolean; error?: string }> => {
  try {
    const ready = await isRedisAvailable();
    return ready
      ? { ready: true }
      : {
          ready: false,
          error: getLastRedisError() ?? 'Redis ping failed',
        };
  } catch (error) {
    return {
      ready: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const checkKeycloak = async (): Promise<{ ready: boolean; error?: string }> => {
  const idp = resolveIdentityProvider();
  if (!idp) {
    return { ready: false, error: 'Keycloak admin client not configured' };
  }

  if (!isKeycloakIdentityProvider(idp.provider)) {
    return { ready: true };
  }

  try {
    await trackKeycloakCall('readiness_list_roles', () => idp.provider.listRoles());
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const healthReadyHandler = async (request: Request): Promise<Response> =>
  withHealthRequestContext(request, async () => {
    const requestContext = getWorkspaceContext();
    const [database, redis, keycloak] = await Promise.all([checkDatabase(), checkRedis(), checkKeycloak()]);
    const ready = database.ready && redis.ready && keycloak.ready;

    return jsonResponse(ready ? 200 : 503, {
      status: ready ? 'ready' : 'not_ready',
      checks: {
        db: database.ready,
        redis: redis.ready,
        keycloak: keycloak.ready,
        errors: {
          ...(database.ready ? {} : { db: database.error }),
          ...(redis.ready ? {} : { redis: redis.error }),
          ...(keycloak.ready ? {} : { keycloak: keycloak.error }),
        },
      },
      ...(requestContext.requestId ? { requestId: requestContext.requestId } : {}),
      timestamp: new Date().toISOString(),
      path: new URL(request.url).pathname,
    });
  });

export const healthLiveHandler = async (request: Request): Promise<Response> =>
  withHealthRequestContext(request, async () => {
    const requestContext = getWorkspaceContext();
    return jsonResponse(200, {
      status: 'alive',
      timestamp: new Date().toISOString(),
      path: new URL(request.url).pathname,
      ...(requestContext.requestId ? { requestId: requestContext.requestId } : {}),
    });
  });
