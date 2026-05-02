import { metrics } from '@opentelemetry/api';
import { createSdkLogger } from '@sva/server-runtime';
import type { IdentityProviderPort } from '../identity-provider-port.js';
import {
  KeycloakAdminClient,
  getKeycloakAdminClientConfigFromEnv,
} from '../keycloak-admin-client.js';
import { loadInstanceById } from '@sva/data-repositories/server';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import { createPoolResolver, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { resolveTenantAdminClientSecret } from '../config-tenant-secret.js';

export const resolvePool = createPoolResolver(getIamDatabaseUrl);
const logger = createSdkLogger({ component: 'iam-account-management', level: 'info' });

let identityProviderCache:
  | IdentityProviderResolution
  | null
  | undefined;

export type IdentityProviderResolution = {
  provider: IdentityProviderPort;
  realm: string;
  source: 'global' | 'instance';
  clientId: string;
  adminRealm: string;
  executionMode: 'platform_admin' | 'tenant_admin' | 'break_glass';
  getCircuitBreakerState?: () => number;
};

export const resolveIdentityProvider = () => {
  if (identityProviderCache !== undefined) {
    return identityProviderCache;
  }

  try {
    const config = getKeycloakAdminClientConfigFromEnv();
    const client = new KeycloakAdminClient(config);
    identityProviderCache = {
      provider: client,
      realm: config.realm,
      source: 'global',
      clientId: config.clientId,
      adminRealm: config.adminRealm ?? config.realm,
      executionMode: 'platform_admin',
      getCircuitBreakerState: () => client.getCircuitBreakerState(),
    };
  } catch (error) {
    logger.warn('Global identity provider resolution failed', {
      reason_code: 'identity_provider_resolution_failed',
      error_type: error instanceof Error ? error.constructor.name : typeof error,
    });
    identityProviderCache = null;
  }

  return identityProviderCache;
};

const requireTenantAdminBaseUrl = (): string => {
  const baseUrl = process.env.KEYCLOAK_ADMIN_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error('Missing required env: KEYCLOAK_ADMIN_BASE_URL');
  }
  return baseUrl;
};

export const resolveIdentityProviderForInstance = async (
  instanceId: string,
  options: {
    executionMode?: 'tenant_admin' | 'break_glass';
  } = {}
): Promise<
  | IdentityProviderResolution
  | null
> => {
  const executionMode = options.executionMode ?? 'tenant_admin';
  const instance = await loadInstanceById(instanceId).catch((error: unknown) => {
    logger.warn('Instance identity provider resolution failed while loading instance metadata', {
      instance_id: instanceId,
      reason_code: 'instance_lookup_failed',
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      execution_mode: executionMode,
    });
    return null;
  });
  if (!instance) {
    logger.warn('Instance identity provider resolution returned no instance metadata', {
      instance_id: instanceId,
      reason_code: 'instance_not_found',
      execution_mode: executionMode,
    });
    return null;
  }

  if (executionMode === 'break_glass') {
    try {
      const config = getKeycloakAdminClientConfigFromEnv(instance.authRealm);
      const client = new KeycloakAdminClient(config);
      return {
        provider: client,
        realm: config.realm,
        source: 'instance',
        clientId: config.clientId,
        adminRealm: config.adminRealm ?? config.realm,
        executionMode,
        getCircuitBreakerState: () => client.getCircuitBreakerState(),
      };
    } catch (error) {
      logger.warn('Instance identity provider resolution failed in break-glass mode', {
        instance_id: instanceId,
        reason_code: 'break_glass_resolution_failed',
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        execution_mode: executionMode,
      });
      return null;
    }
  }

  try {
    const tenantSecret = await resolveTenantAdminClientSecret(instanceId);
    const resolvedSecret = tenantSecret.secret;
    const resolvedClientId = instance.tenantAdminClient?.clientId;
    if (!resolvedSecret || !resolvedClientId) {
      logger.warn('Instance identity provider resolution returned incomplete tenant admin credentials', {
        instance_id: instanceId,
        reason_code: 'tenant_admin_credentials_incomplete',
        execution_mode: executionMode,
        has_client_id: Boolean(resolvedClientId),
        has_client_secret: Boolean(resolvedSecret),
      });
      return null;
    }
    const config = {
      baseUrl: requireTenantAdminBaseUrl(),
      realm: instance.authRealm,
      adminRealm: instance.authRealm,
      clientId: resolvedClientId,
      clientSecret: resolvedSecret,
    } as const;
    const client = new KeycloakAdminClient(config);
    return {
      provider: client,
      realm: config.realm,
      source: 'instance',
      clientId: config.clientId,
      adminRealm: config.adminRealm,
      executionMode,
      getCircuitBreakerState: () => client.getCircuitBreakerState(),
    };
  } catch (error) {
    logger.warn('Instance identity provider resolution failed while loading tenant admin credentials', {
      instance_id: instanceId,
      reason_code: 'tenant_admin_resolution_failed',
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      execution_mode: executionMode,
    });
    return null;
  }
};

export const isKeycloakIdentityProvider = (
  provider: IdentityProviderPort
): provider is KeycloakAdminClient => provider instanceof KeycloakAdminClient;

const meter = metrics.getMeter('sva.iam.service');

const iamCircuitBreakerGauge = meter.createObservableGauge('iam_circuit_breaker_state', {
  description: 'Circuit breaker state for Keycloak admin integration (0=closed, 2=open).',
});

iamCircuitBreakerGauge.addCallback((result) => {
  const idp = resolveIdentityProvider();
  result.observe(idp?.getCircuitBreakerState ? idp.getCircuitBreakerState() : 0);
});

export const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withResolvedInstanceDb(resolvePool, instanceId, work);
