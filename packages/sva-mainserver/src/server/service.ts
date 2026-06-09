import { randomInt } from 'node:crypto';

import {
  svaMainserverMutationRootTypenameDocument,
  svaMainserverQueryRootTypenameDocument,
  type SvaMainserverMutationRootTypenameMutation,
  type SvaMainserverQueryRootTypenameQuery,
} from '../generated/diagnostics.js';
import {
  svaMainserverCategoriesListDocument,
  type SvaMainserverCategoriesListQuery,
} from '../generated/categories.js';
import type {
  SvaMainserverCategory,
  SvaMainserverConnectionInput,
  SvaMainserverConnectionStatus,
  SvaMainserverEventInput,
  SvaMainserverInstanceConfig,
  SvaMainserverListQuery,
  SvaMainserverNewsInput,
  SvaMainserverPoiInput,
  SvaMainserverStaticContentInput,
} from '../types.js';
import { loadSvaMainserverInstanceConfig } from './config-store.js';
import { createAccessTokenProvider } from './service-internals/access-token-provider.js';
import { createCredentialProvider, createDefaultCredentialReader } from './service-internals/credentials.js';
import { createEventOperations } from './service-internals/event-operations.js';
import { createFetchWithRetry, createGraphqlExecutor } from './service-internals/graphql-client.js';
import { mapCategory } from './service-internals/mappers-shared.js';
import { createNewsOperations } from './service-internals/news-operations.js';
import { createNewsVisibilityOperations } from './service-internals/news-visibility-operations.js';
import { buildLogContext, logger, withObservedHop } from './service-internals/observability.js';
import { createPoiOperations } from './service-internals/poi-operations.js';
import { createStaticContentOperations } from './service-internals/static-content-operations.js';
import {
  DEFAULT_CACHE_MAX_SIZE,
  DEFAULT_CREDENTIAL_CACHE_TTL_MS,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_TOKEN_SKEW_MS,
  DEFAULT_UPSTREAM_TIMEOUT_MS,
  normalizeUnexpectedError,
  defined,
  unwrapSettledResult,
  type CredentialValue,
  type SvaMainserverListInput,
} from './service-internals/shared.js';

export type SvaMainserverServiceOptions = {
  readonly loadInstanceConfig?: (instanceId: string) => Promise<SvaMainserverInstanceConfig>;
  readonly readCredentials?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
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

export const createSvaMainserverService = (options: SvaMainserverServiceOptions = {}) => {
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

  const executeGraphqlWithConfig = createGraphqlExecutor({
    fetchWithRetry,
    loadAccessToken,
  });

  const newsOperations = createNewsOperations(executeGraphqlWithConfig);
  const newsVisibilityOperations = createNewsVisibilityOperations(executeGraphqlWithConfig);
  const eventOperations = createEventOperations(executeGraphqlWithConfig);
  const poiOperations = createPoiOperations(executeGraphqlWithConfig);
  const staticContentOperations = createStaticContentOperations(executeGraphqlWithConfig);

  const getQueryRootTypenameWithConfig = async (
    input: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverQueryRootTypenameQuery> =>
    executeGraphqlWithConfig<SvaMainserverQueryRootTypenameQuery>(
      {
        ...input,
        document: svaMainserverQueryRootTypenameDocument,
        operationName: 'SvaMainserverQueryRootTypename',
      },
      config
    );

  const getMutationRootTypenameWithConfig = async (
    input: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverMutationRootTypenameMutation> =>
    executeGraphqlWithConfig<SvaMainserverMutationRootTypenameMutation>(
      {
        ...input,
        document: svaMainserverMutationRootTypenameDocument,
        operationName: 'SvaMainserverMutationRootTypename',
      },
      config
    );

  const getQueryRootTypename = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverQueryRootTypenameQuery> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return getQueryRootTypenameWithConfig(input, config);
  };

  const getMutationRootTypename = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverMutationRootTypenameMutation> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return getMutationRootTypenameWithConfig(input, config);
  };

  const listCategories = async (input: SvaMainserverConnectionInput): Promise<readonly SvaMainserverCategory[]> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const response = await executeGraphqlWithConfig<SvaMainserverCategoriesListQuery>(
      {
        ...input,
        document: svaMainserverCategoriesListDocument,
        operationName: 'SvaMainserverCategoriesList',
        variables: { order: 'name_ASC' },
      },
      config
    );

    return (response.categories ?? []).map(mapCategory).filter(defined);
  };

  const listNews = async (input: SvaMainserverListInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return newsOperations.listNewsWithConfig(input, config);
  };

  const getNews = async (input: SvaMainserverConnectionInput & { readonly newsId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return newsOperations.getNewsWithConfig(input, config);
  };

  const createNews = async (input: SvaMainserverConnectionInput & { readonly news: SvaMainserverNewsInput }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return newsOperations.writeNewsWithConfig(input, config);
  };

  const updateNews = async (
    input: SvaMainserverConnectionInput & { readonly newsId: string; readonly news: SvaMainserverNewsInput }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return newsOperations.writeNewsWithConfig({ ...input, forceCreate: false }, config);
  };

  const deleteNews = async (input: SvaMainserverConnectionInput & { readonly newsId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return newsOperations.destroyNewsWithConfig(input, config);
  };

  const changeNewsVisibility = async (
    input: SvaMainserverConnectionInput & { readonly newsId: string; readonly visible: boolean }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    await newsVisibilityOperations.changeNewsVisibilityWithConfig(input, config);
  };

  const listEvents = async (input: SvaMainserverListInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return eventOperations.listEventsWithConfig(input, config);
  };

  const getEvent = async (input: SvaMainserverConnectionInput & { readonly eventId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return eventOperations.getEventWithConfig(input, config);
  };

  const createEvent = async (input: SvaMainserverConnectionInput & { readonly event: SvaMainserverEventInput }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return eventOperations.writeEventWithConfig(input, config);
  };

  const updateEvent = async (
    input: SvaMainserverConnectionInput & { readonly eventId: string; readonly event: SvaMainserverEventInput }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return eventOperations.writeEventWithConfig({ ...input, forceCreate: false }, config);
  };

  const deleteEvent = async (input: SvaMainserverConnectionInput & { readonly eventId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return eventOperations.destroyEventWithConfig(input, config);
  };

  const listPoi = async (input: SvaMainserverListInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return poiOperations.listPoiWithConfig(input, config);
  };

  const getPoi = async (input: SvaMainserverConnectionInput & { readonly poiId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return poiOperations.getPoiWithConfig(input, config);
  };

  const createPoi = async (input: SvaMainserverConnectionInput & { readonly poi: SvaMainserverPoiInput }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return poiOperations.writePoiWithConfig(input, config);
  };

  const updatePoi = async (
    input: SvaMainserverConnectionInput & { readonly poiId: string; readonly poi: SvaMainserverPoiInput }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return poiOperations.writePoiWithConfig({ ...input, forceCreate: false }, config);
  };

  const deletePoi = async (input: SvaMainserverConnectionInput & { readonly poiId: string }) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return poiOperations.destroyPoiWithConfig(input, config);
  };

  const createOrUpdateStaticContent = async (
    input: SvaMainserverConnectionInput & { readonly staticContent: SvaMainserverStaticContentInput }
  ) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return staticContentOperations.writeStaticContentWithConfig(input, config);
  };

  const getConnectionStatus = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverConnectionStatus> => {
    try {
      const config = await loadValidatedInstanceConfig(input, 'connection_check');
      const [queryRootResult, mutationRootResult] = await Promise.allSettled([
        getQueryRootTypenameWithConfig(input, config),
        getMutationRootTypenameWithConfig(input, config),
      ]);
      const queryRoot = unwrapSettledResult(queryRootResult);
      const mutationRoot = unwrapSettledResult(mutationRootResult);

      if (!queryRoot.ok) {
        throw queryRoot.error;
      }
      if (!mutationRoot.ok) {
        throw mutationRoot.error;
      }

      logger.info('SVA Mainserver connection check succeeded', {
        ...buildLogContext(input, {
          operation: 'connection_check',
        }),
      });

      return {
        status: 'connected',
        checkedAt: new Date(now()).toISOString(),
        config,
        queryRootTypename: queryRoot.value.__typename,
        mutationRootTypename: mutationRoot.value.__typename,
      };
    } catch (error) {
      const normalizedError = normalizeUnexpectedError(error);

      logger.warn('SVA Mainserver connection check failed', {
        ...buildLogContext(input, {
          operation: 'connection_check',
          error_code: normalizedError.code,
          error_message: normalizedError.message,
        }),
      });

      return {
        status: 'error',
        checkedAt: new Date(now()).toISOString(),
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
      };
    }
  };

  return {
    createOrUpdateStaticContent,
    createEvent,
    createNews,
    createPoi,
    changeNewsVisibility,
    deleteEvent,
    deleteNews,
    deletePoi,
    getConnectionStatus,
    getEvent,
    getMutationRootTypename,
    getNews,
    getPoi,
    getQueryRootTypename,
    listCategories,
    listEvents,
    listNews,
    listPoi,
    updateEvent,
    updateNews,
    updatePoi,
  };
};

let defaultService: ReturnType<typeof createSvaMainserverService> | null = null;

const getDefaultService = () => {
  defaultService ??= createSvaMainserverService();
  return defaultService;
};

export const resetSvaMainserverServiceState = (): void => {
  defaultService = null;
};

export const getSvaMainserverConnectionStatus = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getConnectionStatus(input);

export const getSvaMainserverQueryRootTypename = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getQueryRootTypename(input);

export const getSvaMainserverMutationRootTypename = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getMutationRootTypename(input);

export const listSvaMainserverCategories = (input: SvaMainserverConnectionInput) =>
  getDefaultService().listCategories(input);

export const listSvaMainserverNews = (input: SvaMainserverConnectionInput & SvaMainserverListQuery) =>
  getDefaultService().listNews(input);

export const getSvaMainserverNews = (input: SvaMainserverConnectionInput & { readonly newsId: string }) =>
  getDefaultService().getNews(input);

export const createSvaMainserverNews = (
  input: SvaMainserverConnectionInput & { readonly news: SvaMainserverNewsInput }
) => getDefaultService().createNews(input);

export const updateSvaMainserverNews = (
  input: SvaMainserverConnectionInput & { readonly newsId: string; readonly news: SvaMainserverNewsInput }
) => getDefaultService().updateNews(input);

export const changeSvaMainserverNewsVisibility = (
  input: SvaMainserverConnectionInput & { readonly newsId: string; readonly visible: boolean }
) => getDefaultService().changeNewsVisibility(input);

export const deleteSvaMainserverNews = (input: SvaMainserverConnectionInput & { readonly newsId: string }) =>
  getDefaultService().deleteNews(input);

export const listSvaMainserverEvents = (input: SvaMainserverConnectionInput & SvaMainserverListQuery) =>
  getDefaultService().listEvents(input);

export const getSvaMainserverEvent = (input: SvaMainserverConnectionInput & { readonly eventId: string }) =>
  getDefaultService().getEvent(input);

export const createSvaMainserverEvent = (
  input: SvaMainserverConnectionInput & { readonly event: SvaMainserverEventInput }
) => getDefaultService().createEvent(input);

export const updateSvaMainserverEvent = (
  input: SvaMainserverConnectionInput & { readonly eventId: string; readonly event: SvaMainserverEventInput }
) => getDefaultService().updateEvent(input);

export const deleteSvaMainserverEvent = (input: SvaMainserverConnectionInput & { readonly eventId: string }) =>
  getDefaultService().deleteEvent(input);

export const listSvaMainserverPoi = (input: SvaMainserverConnectionInput & SvaMainserverListQuery) =>
  getDefaultService().listPoi(input);

export const getSvaMainserverPoi = (input: SvaMainserverConnectionInput & { readonly poiId: string }) =>
  getDefaultService().getPoi(input);

export const createSvaMainserverPoi = (
  input: SvaMainserverConnectionInput & { readonly poi: SvaMainserverPoiInput }
) => getDefaultService().createPoi(input);

export const updateSvaMainserverPoi = (
  input: SvaMainserverConnectionInput & { readonly poiId: string; readonly poi: SvaMainserverPoiInput }
) => getDefaultService().updatePoi(input);

export const deleteSvaMainserverPoi = (input: SvaMainserverConnectionInput & { readonly poiId: string }) =>
  getDefaultService().deletePoi(input);

export const createOrUpdateSvaMainserverStaticContent = (
  input: SvaMainserverConnectionInput & { readonly staticContent: SvaMainserverStaticContentInput }
) => getDefaultService().createOrUpdateStaticContent(input);
