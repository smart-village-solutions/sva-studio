import type { RuntimeDependencyHealth, RuntimeHealthResponse } from '@sva/core';
import { getWorkspaceContext, withRequestContext } from '@sva/server-runtime';

import { resolveTenantAuthClientSecret } from './config-tenant-secret.js';
import { jsonResponse, resolvePool } from './db.js';
import {
  isKeycloakIdentityProvider,
  resolveIdentityProvider,
  trackKeycloakCall,
} from './iam-account-management/shared.js';
import { getPermissionCacheHealth } from './iam-authorization/shared.js';
import { getLastRedisError, isRedisAvailable } from './redis.js';

const withHealthRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

type RuntimeDependencyCheck = {
  readonly ready: boolean;
  readonly error?: string;
  readonly reasonCode?: string;
};

type TenantLoginContractCheck = {
  readonly checkedActiveInstanceCount: number;
  readonly invalidConfigInstanceIds: readonly string[];
  readonly invalidSecretInstanceIds: readonly string[];
  readonly ready: boolean;
  readonly reasonCode?: string;
};

const toDependencyStatus = (check: RuntimeDependencyCheck): RuntimeDependencyHealth['status'] =>
  check.ready ? 'ready' : 'not_ready';

const toAuthorizationCacheServiceStatus = (
  status: ReturnType<typeof getPermissionCacheHealth>['status']
): RuntimeDependencyHealth['status'] => {
  if (status === 'failed') {
    return 'not_ready';
  }
  return status;
};

const createRuntimeHealthServices = (
  database: RuntimeDependencyCheck,
  redis: RuntimeDependencyCheck,
  keycloak: RuntimeDependencyCheck,
  authorizationCache: ReturnType<typeof getPermissionCacheHealth>
): RuntimeHealthResponse['checks']['services'] => ({
  authorizationCache: {
    reasonCode:
      authorizationCache.status === 'ready'
        ? undefined
        : authorizationCache.status === 'degraded'
          ? 'authorization_cache_degraded'
          : 'authorization_cache_failed',
    status: toAuthorizationCacheServiceStatus(authorizationCache.status),
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

const checkTenantLoginContract = async (): Promise<TenantLoginContractCheck> => {
  const pool = resolvePool();
  if (!pool) {
    return {
      checkedActiveInstanceCount: 0,
      invalidConfigInstanceIds: [],
      invalidSecretInstanceIds: [],
      ready: false,
      reasonCode: 'database_not_configured',
    };
  }

  const client = await pool.connect();
  try {
    const result = await client.query<{
      auth_client_id: string | null;
      auth_realm: string | null;
      id: string;
      primary_hostname: string | null;
    }>(`SELECT id, primary_hostname, auth_realm, auth_client_id FROM iam.instances WHERE status = 'active' ORDER BY id`);

    const invalidConfigInstanceIds = result.rows
      .filter(
        (row) =>
          !row.primary_hostname?.trim() ||
          !row.auth_realm?.trim() ||
          !row.auth_client_id?.trim()
      )
      .map((row) => row.id);

    const secretCandidateIds = result.rows
      .map((row) => row.id)
      .filter((id) => !invalidConfigInstanceIds.includes(id));

    const secretChecks = await Promise.all(
      secretCandidateIds.map(async (instanceId) => ({
        instanceId,
        secret: await resolveTenantAuthClientSecret(instanceId, { allowGlobalFallback: false }),
      }))
    );

    const invalidSecretInstanceIds = secretChecks
      .filter(
        ({ secret }) => secret.source !== 'tenant' || !secret.configured || !secret.readable || !secret.secret
      )
      .map(({ instanceId }) => instanceId);

    const reasonCode =
      invalidConfigInstanceIds.length > 0
        ? 'tenant_login_contract_incomplete'
        : invalidSecretInstanceIds.length > 0
          ? 'tenant_auth_client_secret_missing'
          : undefined;

    return {
      checkedActiveInstanceCount: result.rows.length,
      invalidConfigInstanceIds,
      invalidSecretInstanceIds,
      ready: invalidConfigInstanceIds.length === 0 && invalidSecretInstanceIds.length === 0,
      reasonCode,
    };
  } finally {
    client.release();
  }
};

export const healthReadyHandler = async (request: Request): Promise<Response> =>
  withHealthRequestContext(request, async () => {
    const requestContext = getWorkspaceContext();
    const [database, redis, keycloak, tenantLoginContract] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkKeycloak(),
      checkTenantLoginContract(),
    ]);
    const authorizationCache = getPermissionCacheHealth();
    const ready =
      database.ready &&
      redis.ready &&
      keycloak.ready &&
      tenantLoginContract.ready &&
      authorizationCache.status !== 'failed';
    const services = createRuntimeHealthServices(database, redis, keycloak, authorizationCache);
    const diagnostics = {
      ...(database.ready ? {} : { db: { reason_code: database.reasonCode } }),
      ...(redis.ready ? {} : { redis: { reason_code: redis.reasonCode } }),
      ...(keycloak.ready ? {} : { keycloak: { reason_code: keycloak.reasonCode } }),
      ...(tenantLoginContract.ready
        ? {}
        : {
            auth: {
              checked_active_instance_count: tenantLoginContract.checkedActiveInstanceCount,
              invalid_config_instance_ids: tenantLoginContract.invalidConfigInstanceIds,
              invalid_secret_instance_ids: tenantLoginContract.invalidSecretInstanceIds,
              reason_code: tenantLoginContract.reasonCode,
            },
          }),
      ...(authorizationCache.status === 'degraded'
        ? { authorizationCache: { reason_code: 'authorization_cache_degraded' } }
        : {}),
      ...(authorizationCache.status === 'failed'
        ? { authorizationCache: { reason_code: 'authorization_cache_failed' } }
        : {}),
    };

    return jsonResponse(ready ? 200 : 503, {
      status: ready ? 'ready' : 'not_ready',
      checks: {
        authorizationCache: {
          coldStart: authorizationCache.coldStart,
          consecutiveRedisFailures: authorizationCache.consecutiveRedisFailures,
          lastRedisLatencyMs: authorizationCache.lastRedisLatencyMs,
          recomputePerMinute: authorizationCache.recomputePerMinute,
          status: authorizationCache.status,
        },
        auth: {},
        db: database.ready,
        redis: redis.ready,
        keycloak: keycloak.ready,
        diagnostics,
        errors: {
          ...(tenantLoginContract.ready
            ? {}
            : {
                auth:
                  tenantLoginContract.invalidConfigInstanceIds.length > 0
                    ? 'Active tenant login contract is incomplete for at least one instance.'
                    : 'Active tenant auth secrets are unavailable for at least one instance.',
              }),
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
