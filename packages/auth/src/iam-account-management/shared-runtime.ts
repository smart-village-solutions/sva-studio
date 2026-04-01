import { metrics } from '@opentelemetry/api';

import type { IdentityProviderPort } from '../identity-provider-port.js';
import {
  KeycloakAdminClient,
  getKeycloakAdminClientConfigFromEnv,
} from '../keycloak-admin-client.js';
import { getIamDatabaseUrl } from '../runtime-secrets.server.js';
import { createPoolResolver, type QueryClient, withInstanceDb } from '../shared/db-helpers.js';

export const resolvePool = createPoolResolver(getIamDatabaseUrl);

let identityProviderCache:
  | {
      provider: IdentityProviderPort;
      getCircuitBreakerState?: () => number;
    }
  | null
  | undefined;

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
