import type { RuntimeDependencyHealth, RuntimeHealthResponse } from '@sva/core';
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

type RuntimeDependencyCheck = {
  readonly ready: boolean;
  readonly error?: string;
  readonly reasonCode?: string;
};

const toDependencyStatus = (check: RuntimeDependencyCheck): RuntimeDependencyHealth['status'] =>
  check.ready ? 'ready' : 'not_ready';

const createRuntimeHealthServices = (
  database: RuntimeDependencyCheck,
  redis: RuntimeDependencyCheck,
  keycloak: RuntimeDependencyCheck
): RuntimeHealthResponse['checks']['services'] => ({
  authorizationCache: {
    reasonCode: 'authorization_cache_unavailable',
    status: 'unknown',
  },
  database: {
    reasonCode: database.reasonCode,
    status: toDependencyStatus(database),
  },
  keycloak: {
    reasonCode: keycloak.reasonCode,
    status: toDependencyStatus(keycloak),
  },
  redis: {
    reasonCode: redis.reasonCode,
    status: toDependencyStatus(redis),
  },
});

const checkDatabase = async (): Promise<RuntimeDependencyCheck> => {
  const pool = resolvePool();
  if (!pool) {
    return { ready: false, error: 'IAM database not configured', reasonCode: 'database_not_configured' };
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
      reasonCode: 'database_connection_failed',
    };
  }
};

const checkRedis = async (): Promise<RuntimeDependencyCheck> => {
  try {
    const ready = await isRedisAvailable();
    return ready
      ? { ready: true }
      : {
          ready: false,
          error: getLastRedisError() ?? 'Redis ping failed',
          reasonCode: 'redis_ping_failed',
        };
  } catch (error) {
    return {
      ready: false,
      error: error instanceof Error ? error.message : String(error),
      reasonCode: 'redis_ping_failed',
    };
  }
};

const checkKeycloak = async (): Promise<RuntimeDependencyCheck> => {
  const idp = resolveIdentityProvider();
  if (!idp) {
    return {
      ready: false,
      error: 'Keycloak admin client not configured',
      reasonCode: 'keycloak_admin_not_configured',
    };
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
      reasonCode: 'keycloak_dependency_failed',
    };
  }
};

export const healthReadyHandler = async (request: Request): Promise<Response> =>
  withHealthRequestContext(request, async () => {
    const requestContext = getWorkspaceContext();
    const [database, redis, keycloak] = await Promise.all([checkDatabase(), checkRedis(), checkKeycloak()]);
    const ready = database.ready && redis.ready && keycloak.ready;
    const services = createRuntimeHealthServices(database, redis, keycloak);
    const diagnostics = {
      ...(database.ready ? {} : { db: { reason_code: database.reasonCode } }),
      ...(redis.ready ? {} : { redis: { reason_code: redis.reasonCode } }),
      ...(keycloak.ready ? {} : { keycloak: { reason_code: keycloak.reasonCode } }),
    };

    return jsonResponse(ready ? 200 : 503, {
      status: ready ? 'ready' : 'not_ready',
      checks: {
        authorizationCache: {
          coldStart: false,
          consecutiveRedisFailures: 0,
          recomputePerMinute: 0,
          status: 'empty',
        },
        auth: {},
        db: database.ready,
        redis: redis.ready,
        keycloak: keycloak.ready,
        diagnostics,
        errors: {
          ...(database.ready ? {} : { db: database.error }),
          ...(redis.ready ? {} : { redis: redis.error }),
          ...(keycloak.ready ? {} : { keycloak: keycloak.error }),
        },
        services,
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
