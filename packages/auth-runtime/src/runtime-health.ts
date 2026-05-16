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
import {
  createHealthDiagnostics,
  createHealthErrors,
  createRuntimeHealthServices,
  hasMissingTenantLoginConfig,
  isValidTenantSecretState,
  resolveTenantLoginContractReasonCode,
  type ActiveInstanceLoginRow,
  type RuntimeDependencyCheck,
  type RuntimeHealthDbClient,
  type TenantLoginContractCheck,
} from './runtime-health.shared.js';

const withHealthRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

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
      error: 'IAM database not configured',
      invalidConfigInstanceIds: [],
      invalidSecretInstanceIds: [],
      ready: false,
      reasonCode: 'database_not_configured',
    };
  }
  let client: RuntimeHealthDbClient | null = null;
  try {
    client = await pool.connect();
    const result = await client.query<ActiveInstanceLoginRow>(
      `SELECT id, primary_hostname, auth_realm, auth_client_id FROM iam.instances WHERE status = 'active' ORDER BY id`
    );

    const invalidConfigInstanceIds = result.rows.filter(hasMissingTenantLoginConfig).map((row: ActiveInstanceLoginRow) => row.id);

    const secretCandidateIds = result.rows
      .map((row: ActiveInstanceLoginRow) => row.id)
      .filter((id: string) => !invalidConfigInstanceIds.includes(id));

    const secretChecks = await Promise.all(
      secretCandidateIds.map(async (instanceId: string) => ({
        instanceId,
        secret: await resolveTenantAuthClientSecret(instanceId, { allowGlobalFallback: false }),
      }))
    );

    const invalidSecretInstanceIds = secretChecks
      .filter(({ secret }: { secret: Awaited<ReturnType<typeof resolveTenantAuthClientSecret>> }) =>
        !isValidTenantSecretState(secret)
      )
      .map(({ instanceId }: { instanceId: string }) => instanceId);

    return {
      checkedActiveInstanceCount: result.rows.length,
      invalidConfigInstanceIds,
      invalidSecretInstanceIds,
      ready: invalidConfigInstanceIds.length === 0 && invalidSecretInstanceIds.length === 0,
      reasonCode: resolveTenantLoginContractReasonCode(
        invalidConfigInstanceIds,
        invalidSecretInstanceIds
      ),
    };
  } catch (error) {
    return {
      checkedActiveInstanceCount: 0,
      error: error instanceof Error ? error.message : String(error),
      invalidConfigInstanceIds: [],
      invalidSecretInstanceIds: [],
      ready: false,
      reasonCode: 'tenant_login_contract_probe_failed',
    };
  } finally {
    client?.release();
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
        diagnostics: createHealthDiagnostics(
          database,
          redis,
          keycloak,
          tenantLoginContract,
          authorizationCache
        ),
        errors: createHealthErrors(database, redis, keycloak, tenantLoginContract),
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
