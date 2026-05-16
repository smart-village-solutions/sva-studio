import type { RuntimeDependencyHealth, RuntimeHealthResponse } from '@sva/core';
import { getPermissionCacheHealth } from './iam-authorization/shared.js';
import { resolveTenantAuthClientSecret } from './config-tenant-secret.js';

export type RuntimeDependencyCheck = {
  readonly ready: boolean;
  readonly error?: string;
  readonly reasonCode?: string;
};

export type TenantLoginContractCheck = {
  readonly checkedActiveInstanceCount: number;
  readonly error?: string;
  readonly invalidConfigInstanceIds: readonly string[];
  readonly invalidSecretInstanceIds: readonly string[];
  readonly ready: boolean;
  readonly reasonCode?: string;
};

export type ActiveInstanceLoginRow = {
  auth_client_id: string | null;
  auth_realm: string | null;
  id: string;
  primary_hostname: string | null;
};

export type RuntimeHealthDbClient = {
  query<T>(sql: string): Promise<{ rowCount: number; rows: T[] }>;
  release(): void;
};

export const toDependencyStatus = (check: RuntimeDependencyCheck): RuntimeDependencyHealth['status'] =>
  check.ready ? 'ready' : 'not_ready';

export const toAuthorizationCacheServiceStatus = (
  status: ReturnType<typeof getPermissionCacheHealth>['status']
): RuntimeDependencyHealth['status'] => (status === 'failed' ? 'not_ready' : status);

export const hasMissingTenantLoginConfig = (row: ActiveInstanceLoginRow): boolean =>
  !row.primary_hostname?.trim() || !row.auth_realm?.trim() || !row.auth_client_id?.trim();

export const isValidTenantSecretState = (
  secret: Awaited<ReturnType<typeof resolveTenantAuthClientSecret>>
): boolean => secret.source === 'tenant' && secret.configured && secret.readable && Boolean(secret.secret);

export const resolveTenantLoginContractReasonCode = (
  invalidConfigInstanceIds: readonly string[],
  invalidSecretInstanceIds: readonly string[]
): string | undefined =>
  invalidConfigInstanceIds.length > 0
    ? 'tenant_login_contract_incomplete'
    : invalidSecretInstanceIds.length > 0
      ? 'tenant_auth_client_secret_missing'
      : undefined;

export const createHealthDiagnostics = (
  database: RuntimeDependencyCheck,
  redis: RuntimeDependencyCheck,
  keycloak: RuntimeDependencyCheck,
  tenantLoginContract: TenantLoginContractCheck,
  authorizationCache: ReturnType<typeof getPermissionCacheHealth>
): RuntimeHealthResponse['checks']['diagnostics'] => ({
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
});

export const createHealthErrors = (
  database: RuntimeDependencyCheck,
  redis: RuntimeDependencyCheck,
  keycloak: RuntimeDependencyCheck,
  tenantLoginContract: TenantLoginContractCheck
): RuntimeHealthResponse['checks']['errors'] => ({
  ...(tenantLoginContract.ready ? {} : { auth: resolveTenantAuthError(tenantLoginContract) }),
  ...(database.ready ? {} : { db: database.error }),
  ...(redis.ready ? {} : { redis: redis.error }),
  ...(keycloak.ready ? {} : { keycloak: keycloak.error }),
});

const resolveTenantAuthError = (tenantLoginContract: TenantLoginContractCheck): string =>
  tenantLoginContract.reasonCode === 'database_not_configured'
    ? 'Tenant login contract check requires IAM database configuration.'
    : tenantLoginContract.reasonCode === 'tenant_login_contract_probe_failed'
      ? (tenantLoginContract.error ?? 'Tenant login contract check failed.')
      : tenantLoginContract.invalidConfigInstanceIds.length > 0
        ? 'Active tenant login contract is incomplete for at least one instance.'
        : 'Active tenant auth secrets are unavailable for at least one instance.';

export const createRuntimeHealthServices = (
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
  database: { reasonCode: database.reasonCode, status: toDependencyStatus(database) },
  keycloak: { reasonCode: keycloak.reasonCode, status: toDependencyStatus(keycloak) },
  redis: { reasonCode: redis.reasonCode, status: toDependencyStatus(redis) },
});
