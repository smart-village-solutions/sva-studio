import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';
import type { RuntimeDependencyHealth, RuntimeHealthServices } from '@sva/core';

import { getPermissionCacheHealth } from '../iam-authorization/shared.js';
import { bootstrapAcceptanceAppDbUserIfNeeded } from '../postgres-app-user-bootstrap.server.js';
import { getLastRedisError, isRedisAvailable } from '../redis.server.js';
import { jsonResponse } from '../shared/db-helpers.js';

import {
  isKeycloakIdentityProvider,
  resolveIdentityProvider,
  resolvePool,
  trackKeycloakCall,
} from './shared.js';
import { addActiveSpanEvent, annotateActiveSpan } from './diagnostics.js';
import { runCriticalIamSchemaGuard, summarizeSchemaGuardFailures } from './schema-guard.js';

const logger = createSdkLogger({ component: 'iam-platform-readiness', level: 'info' });

const toDependencyStatus = (input: { failed: boolean; ready?: boolean }): RuntimeDependencyHealth['status'] => {
  if (input.failed) {
    return 'not_ready';
  }
  if (input.ready === true) {
    return 'ready';
  }
  return 'unknown';
};

const toAuthorizationCacheStatus = (status: 'degraded' | 'failed' | 'ready'): RuntimeDependencyHealth['status'] => {
  if (status === 'failed') {
    return 'not_ready';
  }
  if (status === 'degraded') {
    return 'degraded';
  }
  return 'ready';
};

export const readyInternal = async (request: Request): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const dbStatus = await (async () => {
    try {
      const pool = resolvePool();
      if (!pool) {
        return { ready: false, error: 'IAM database not configured' };
      }
      let client;
      try {
        client = await pool.connect();
      } catch (error) {
        const bootstrapped = await bootstrapAcceptanceAppDbUserIfNeeded(error);
        if (!bootstrapped) {
          throw error;
        }
        client = await pool.connect();
      }
      try {
        await client.query('SELECT 1;');
        const schemaGuard = await runCriticalIamSchemaGuard(client);
        if (!schemaGuard.ok) {
          return {
            ready: false,
            error: summarizeSchemaGuardFailures(schemaGuard) ?? 'critical_schema_drift',
            diagnostics: {
              dependency: 'database',
              reason_code: 'schema_drift',
              schema_guard: schemaGuard,
            },
          };
        }
        return {
          ready: true as const,
          diagnostics: {
            dependency: 'database',
            reason_code: 'ready',
            schema_guard: schemaGuard,
          },
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        ready: false,
        error: error instanceof Error ? error.message : String(error),
        diagnostics: {
          dependency: 'database',
          reason_code: 'database_connection_failed',
        },
      };
    }
  })();

  const redisStatus = await (async () => {
    try {
      const redisReady = await isRedisAvailable();
      return redisReady
        ? {
            ready: true as const,
            diagnostics: {
              dependency: 'redis',
              reason_code: 'ready',
            },
          }
        : {
            ready: false,
            error: getLastRedisError() ?? 'Redis ping failed',
            diagnostics: {
              dependency: 'redis',
              reason_code: 'redis_ping_failed',
            },
          };
    } catch (error) {
      return {
        ready: false,
        error: error instanceof Error ? error.message : String(error),
        diagnostics: {
          dependency: 'redis',
          reason_code: 'redis_ping_failed',
        },
      };
    }
  })();

  const keycloakStatus = await (async () => {
    const idp = resolveIdentityProvider();
    if (!idp) {
      return {
        ready: false,
        error: 'Keycloak admin client not configured',
        diagnostics: {
          dependency: 'keycloak',
          reason_code: 'keycloak_admin_not_configured',
        },
      };
    }
    if (isKeycloakIdentityProvider(idp.provider)) {
      try {
        await trackKeycloakCall('readiness_list_roles', () => idp.provider.listRoles());
        return {
          ready: true as const,
          diagnostics: {
            dependency: 'keycloak',
            reason_code: 'ready',
          },
        };
      } catch (error) {
        return {
          ready: false,
          error: error instanceof Error ? error.message : String(error),
          diagnostics: {
            dependency: 'keycloak',
            reason_code: 'keycloak_dependency_failed',
          },
        };
      }
    }
    return {
      ready: true as const,
      diagnostics: {
        dependency: 'keycloak',
        reason_code: 'ready',
      },
    };
  })();

  const authorizationCache = getPermissionCacheHealth();
  const allReady = dbStatus.ready && redisStatus.ready && keycloakStatus.ready;
  const failed = !allReady || authorizationCache.status === 'failed';
  const diagnostics = {
    ...(dbStatus.ready ? {} : { db: dbStatus.diagnostics }),
    ...(redisStatus.ready ? {} : { redis: redisStatus.diagnostics }),
    ...(keycloakStatus.ready ? {} : { keycloak: keycloakStatus.diagnostics }),
  };
  const services: RuntimeHealthServices = {
    authorizationCache: {
      reasonCode:
        authorizationCache.status === 'ready'
          ? undefined
          : authorizationCache.status === 'degraded'
            ? 'authorization_cache_degraded'
            : 'authorization_cache_failed',
      status: toAuthorizationCacheStatus(authorizationCache.status),
    },
    database: {
      reasonCode: dbStatus.ready ? undefined : dbStatus.diagnostics?.reason_code,
      status: toDependencyStatus({ failed: !dbStatus.ready, ready: dbStatus.ready }),
    },
    keycloak: {
      reasonCode: keycloakStatus.ready ? undefined : keycloakStatus.diagnostics?.reason_code,
      status: toDependencyStatus({ failed: !keycloakStatus.ready, ready: keycloakStatus.ready }),
    },
    redis: {
      reasonCode: redisStatus.ready ? undefined : redisStatus.diagnostics?.reason_code,
      status: toDependencyStatus({ failed: !redisStatus.ready, ready: redisStatus.ready }),
    },
  };

  annotateActiveSpan({
    'dependency.database.status': dbStatus.ready ? 'ready' : 'not_ready',
    'dependency.redis.status': redisStatus.ready ? 'ready' : 'not_ready',
    'dependency.keycloak.status': keycloakStatus.ready ? 'ready' : 'not_ready',
    'db.schema_guard_result':
      dbStatus.ready || dbStatus.diagnostics?.reason_code !== 'schema_drift' ? 'ok' : 'drift',
  });
  addActiveSpanEvent('iam.readiness_evaluated', {
    'dependency.database.status': dbStatus.ready ? 'ready' : 'not_ready',
    'dependency.redis.status': redisStatus.ready ? 'ready' : 'not_ready',
    'dependency.keycloak.status': keycloakStatus.ready ? 'ready' : 'not_ready',
  });

  const status = failed ? 'not_ready' : authorizationCache.status === 'degraded' ? 'degraded' : 'ready';
  if (!dbStatus.ready) {
    logger.error('iam_readiness_dependency_failed', {
      operation: 'ready_internal',
      dependency: 'database',
      reason_code: dbStatus.diagnostics?.reason_code,
      error: dbStatus.error,
      request_id: requestContext.requestId,
    });
  }
  if (!redisStatus.ready) {
    logger.error('iam_readiness_dependency_failed', {
      operation: 'ready_internal',
      dependency: 'redis',
      reason_code: redisStatus.diagnostics?.reason_code,
      error: redisStatus.error,
      request_id: requestContext.requestId,
    });
  }
  if (!keycloakStatus.ready) {
    logger.error('iam_readiness_dependency_failed', {
      operation: 'ready_internal',
      dependency: 'keycloak',
      reason_code: keycloakStatus.diagnostics?.reason_code,
      error: keycloakStatus.error,
      request_id: requestContext.requestId,
    });
  }
  if (authorizationCache.status === 'degraded') {
    logger.warn('iam_readiness_degraded', {
      operation: 'ready_internal',
      dependency: 'authorization_cache',
      reason_code: 'authorization_cache_degraded',
      request_id: requestContext.requestId,
    });
  }

  return jsonResponse(failed ? 503 : 200, {
    status,
    checks: {
      db: dbStatus.ready,
      redis: redisStatus.ready,
      keycloak: keycloakStatus.ready,
      errors: {
        ...(dbStatus.ready ? {} : { db: dbStatus.error }),
        ...(redisStatus.ready ? {} : { redis: redisStatus.error }),
        ...(keycloakStatus.ready ? {} : { keycloak: keycloakStatus.error }),
      },
      diagnostics,
      authorizationCache,
      services,
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
