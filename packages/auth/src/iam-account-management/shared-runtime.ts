import { metrics } from '@opentelemetry/api';
import { getRuntimeProfileFromEnv } from '@sva/sdk';

import type { IdentityProviderPort } from '../identity-provider-port.js';
import {
  KeycloakAdminClient,
  getKeycloakAdminClientConfigFromEnv,
} from '../keycloak-admin-client.js';
import { loadInstanceById } from '@sva/data/server';
import { getIamDatabaseUrl } from '../runtime-secrets.server.js';
import { createPoolResolver, type QueryClient, withInstanceDb } from '../shared/db-helpers.js';

export const resolvePool = createPoolResolver(getIamDatabaseUrl);

let identityProviderCache:
  | IdentityProviderResolution
  | null
  | undefined;

export type IdentityProviderResolution = {
  provider: IdentityProviderPort;
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
      getCircuitBreakerState: () => client.getCircuitBreakerState(),
    };
  } catch {
    identityProviderCache = null;
  }

  return identityProviderCache;
};

export const resolveIdentityProviderForInstance = async (
  instanceId: string
): Promise<
  | IdentityProviderResolution
  | null
> => {
  const runtimeProfile = getRuntimeProfileFromEnv(process.env);
  const allowGlobalFallback = runtimeProfile === null || runtimeProfile === 'local-builder' || runtimeProfile === 'local-keycloak'
    || process.env.NODE_ENV === 'test';
  const instance = await loadInstanceById(instanceId).catch(() => null);
  if (!instance) {
    return allowGlobalFallback ? resolveIdentityProvider() : null;
  }

  try {
    const client = new KeycloakAdminClient(getKeycloakAdminClientConfigFromEnv(instance.authRealm));
    return {
      provider: client,
      getCircuitBreakerState: () => client.getCircuitBreakerState(),
    };
  } catch {
    return allowGlobalFallback ? resolveIdentityProvider() : null;
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
): Promise<T> => withInstanceDb(resolvePool, instanceId, work);
