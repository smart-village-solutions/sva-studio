import { createServiceOperationContext } from './service-operation-context.js';
import { createServiceDiagnostics } from './service-diagnostics.js';
import { randomInt } from 'node:crypto';
import type { SvaMainserverConnectionInput, SvaMainserverInstanceConfig } from '../../types.js';
import { loadSvaMainserverInstanceConfig } from '../config-store.js';
import { createAccessTokenProvider } from './access-token-provider.js';
import { createDataProviderIdentityOperation } from './data-provider-identity.js';
import { createCredentialProvider, createDefaultCredentialReader } from './credentials.js';
import { createFetchWithRetry, createGraphqlExecutor } from './graphql-client.js';
import { withObservedHop } from './observability.js';
import {
  DEFAULT_CACHE_MAX_SIZE,
  DEFAULT_CREDENTIAL_CACHE_TTL_MS,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_TOKEN_SKEW_MS,
  DEFAULT_UPSTREAM_TIMEOUT_MS,
  normalizeUnexpectedError,
  toSvaMainserverError,
  type CredentialValue,
  type GraphqlOperationInput,
} from './shared.js';

export type SvaMainserverServiceOptions = {
  readonly loadInstanceConfig?: (instanceId: string) => Promise<SvaMainserverInstanceConfig>;
  readonly readCredentials?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
    readonly actingPrincipalType?: 'organization' | 'user';
  }) => Promise<CredentialValue | null>;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly credentialCacheTtlMs?: number;
  readonly tokenSkewMs?: number;
  readonly upstreamTimeoutMs?: number;
  readonly credentialCacheMaxSize?: number;
  readonly tokenCacheMaxSize?: number;
  readonly retryBaseDelayMs?: number;
  readonly randomIntImpl?: (min: number, max: number) => number;
};

export const createServiceContext = (options: SvaMainserverServiceOptions = {}) => {
  const loadInstanceConfig = options.loadInstanceConfig ?? loadSvaMainserverInstanceConfig;
  const readCredentials = options.readCredentials ?? createDefaultCredentialReader();
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const credentialCacheTtlMs = options.credentialCacheTtlMs ?? DEFAULT_CREDENTIAL_CACHE_TTL_MS;
  const tokenSkewMs = options.tokenSkewMs ?? DEFAULT_TOKEN_SKEW_MS;
  const upstreamTimeoutMs = options.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
  const credentialCacheMaxSize = options.credentialCacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
  const tokenCacheMaxSize = options.tokenCacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const randomIntImpl = options.randomIntImpl ?? randomInt;

  const loadValidatedInstanceConfig = async (
    input: SvaMainserverConnectionInput,
    operationName: string
  ): Promise<SvaMainserverInstanceConfig> =>
    withObservedHop(
      {
        hop: 'db',
        operationName,
        connection: input,
      },
      async () => loadInstanceConfig(input.instanceId)
    );

  const fetchWithRetry = createFetchWithRetry({
    fetchImpl,
    upstreamTimeoutMs,
    retryBaseDelayMs,
    randomIntImpl,
  });

  const loadCredentials = createCredentialProvider({
    readCredentials,
    now,
    credentialCacheTtlMs,
    credentialCacheMaxSize,
  });

  const loadAccessToken = createAccessTokenProvider({
    now,
    tokenSkewMs,
    tokenCacheMaxSize,
    loadCredentials,
    fetchWithRetry,
  });

  const loadListCredentialMetadata = async (input: SvaMainserverConnectionInput) => {
    const credentials = await loadCredentials(input);
    return {
      ...(credentials.credentialSource ? { credentialSource: credentials.credentialSource } : {}),
    };
  };

  const executeGraphqlWithConfig = createGraphqlExecutor({
    fetchWithRetry,
    loadAccessToken,
  });
  const executeCategoryManagementGraphql = async <TResult>(
    operation: GraphqlOperationInput,
    config: SvaMainserverInstanceConfig
  ): Promise<TResult> => {
    try {
      return await executeGraphqlWithConfig<TResult>(operation, config);
    } catch (error) {
      const normalized = normalizeUnexpectedError(error);
      if (normalized.code === 'forbidden' || normalized.code === 'unauthorized')
        throw toSvaMainserverError({
          code: 'category_management_access_denied',
          message:
            'Die Mainserver-Zugangsdaten sind nicht für die Kategorienverwaltung berechtigt.',
          statusCode: 403,
        });
      throw error;
    }
  };
  const loadDataProviderIdentityWithConfig = createDataProviderIdentityOperation({
    fetchWithRetry,
    loadAccessToken,
  });

  const loadDataProviderIdentity = async (input: SvaMainserverConnectionInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return loadDataProviderIdentityWithConfig(input, config);
  };

  const operations = createServiceOperationContext(executeGraphqlWithConfig);
  const diagnostics = createServiceDiagnostics({
    loadValidatedInstanceConfig,
    executeGraphqlWithConfig,
    now,
  });

  return {
    executeCategoryManagementGraphql,
    loadValidatedInstanceConfig,
    loadListCredentialMetadata,
    executeGraphqlWithConfig,
    loadDataProviderIdentity,
    ...operations,
    ...diagnostics,
  };
};

export type ServiceContext = ReturnType<typeof createServiceContext>;
