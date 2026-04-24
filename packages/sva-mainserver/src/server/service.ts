import { randomInt } from 'node:crypto';

import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import { readSvaMainserverCredentialsWithStatus } from '@sva/auth/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import {
  svaMainserverMutationRootTypenameDocument,
  svaMainserverQueryRootTypenameDocument,
  type SvaMainserverMutationRootTypenameMutation,
  type SvaMainserverQueryRootTypenameQuery,
} from '../generated/diagnostics.js';
import type {
  SvaMainserverConnectionInput,
  SvaMainserverConnectionStatus,
  SvaMainserverErrorCode,
  SvaMainserverInstanceConfig,
} from '../types.js';
import { loadSvaMainserverInstanceConfig } from './config-store.js';
import { SvaMainserverError } from './errors.js';

type CredentialValue = {
  readonly apiKey: string;
  readonly apiSecret: string;
};

type TimedCacheEntry<TValue> = {
  value: TValue;
  expiresAtMs: number;
  lastUsedAtMs: number;
};

type GraphqlResponse<TResult> = {
  readonly data?: TResult;
  readonly errors?: readonly {
    readonly message?: string;
  }[];
};

type ServiceHop = 'db' | 'keycloak' | 'oauth2' | 'graphql';

type UpstreamRequestInput = {
  readonly url: string;
  readonly init: RequestInit;
  readonly input: SvaMainserverConnectionInput;
  readonly operationName: string;
  readonly hop: Extract<ServiceHop, 'oauth2' | 'graphql'>;
};

export type SvaMainserverServiceOptions = {
  readonly loadInstanceConfig?: (instanceId: string) => Promise<SvaMainserverInstanceConfig>;
  readonly readCredentials?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
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

const logger = createSdkLogger({ component: 'sva-mainserver', level: 'debug' });
const tracer = trace.getTracer('sva.mainserver');
const meter = metrics.getMeter('sva.mainserver');
const hopDurationHistogram = meter.createHistogram('sva_mainserver_hop_duration_ms', {
  description: 'Latenz pro Mainserver-Hop in Millisekunden.',
  unit: 'ms',
});
const hopRequestCounter = meter.createCounter('sva_mainserver_hop_total', {
  description: 'Anzahl der Mainserver-Hops nach Typ und Ergebnis.',
});

const DEFAULT_CREDENTIAL_CACHE_TTL_MS = 60_000;
const DEFAULT_TOKEN_SKEW_MS = 60_000;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;
const DEFAULT_CACHE_MAX_SIZE = 256;
const DEFAULT_RETRY_BASE_DELAY_MS = 150;
const RETRYABLE_STATUS_CODES = new Set([503]);

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().finite().positive(),
});

const graphqlResponseSchema = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

const toSvaMainserverError = (input: {
  code: SvaMainserverErrorCode;
  message: string;
  statusCode?: number;
}): SvaMainserverError => new SvaMainserverError(input);

const isAbortErrorLike = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'AbortError' || error.name === 'TimeoutError';
};

const normalizeUnexpectedError = (error: unknown): SvaMainserverError => {
  if (error instanceof SvaMainserverError) {
    return error;
  }

  return toSvaMainserverError({
    code: 'network_error',
    message: error instanceof Error ? error.message : 'Unbekannter Mainserver-Fehler.',
    statusCode: 503,
  });
};

const buildLogContext = (
  input: Pick<SvaMainserverConnectionInput, 'instanceId'>,
  extra: Record<string, unknown> = {}
): Record<string, unknown> => {
  const context = getWorkspaceContext();

  return {
    workspace_id: input.instanceId,
    instance_id: input.instanceId,
    request_id: context.requestId,
    trace_id: context.traceId,
    ...extra,
  };
};

const pruneCache = <TValue>(
  cache: Map<string, TimedCacheEntry<TValue>>,
  nowMs: number,
  maxSize: number
): void => {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAtMs <= nowMs) {
      cache.delete(key);
    }
  }

  if (cache.size <= maxSize) {
    return;
  }

  const oldestEntries = [...cache.entries()].sort((left, right) => left[1].lastUsedAtMs - right[1].lastUsedAtMs);
  for (const [key] of oldestEntries.slice(0, cache.size - maxSize)) {
    cache.delete(key);
  }
};

const readCacheValue = <TValue>(
  cache: Map<string, TimedCacheEntry<TValue>>,
  key: string,
  nowMs: number,
  maxSize: number
): TValue | null => {
  pruneCache(cache, nowMs, maxSize);

  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAtMs <= nowMs) {
    cache.delete(key);
    return null;
  }

  entry.lastUsedAtMs = nowMs;
  return entry.value;
};

const writeCacheValue = <TValue>(
  cache: Map<string, TimedCacheEntry<TValue>>,
  key: string,
  value: TValue,
  expiresAtMs: number,
  nowMs: number,
  maxSize: number
): void => {
  cache.set(key, {
    value,
    expiresAtMs,
    lastUsedAtMs: nowMs,
  });
  pruneCache(cache, nowMs, maxSize);
};

const buildForwardHeaders = (): Record<string, string> => {
  const context = getWorkspaceContext();
  return {
    ...(context.requestId ? { 'X-Request-Id': context.requestId } : {}),
    ...(context.traceId ? { 'X-Trace-Id': context.traceId } : {}),
  };
};

const parseJsonBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch (error) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message:
        error instanceof Error
          ? error.message
          : 'Die Antwort des SVA-Mainservers konnte nicht als JSON gelesen werden.',
      statusCode: 502,
    });
  }
};

const shouldRetryError = (error: unknown): boolean =>
  isAbortErrorLike(error) || (error instanceof Error && error.name === 'TypeError');

const resolveNetworkErrorMessage = (input: {
  error: unknown;
  timeoutMessage: string;
  defaultMessage: string;
}): string => {
  if (isAbortErrorLike(input.error)) {
    return input.timeoutMessage;
  }
  if (input.error instanceof Error) {
    return input.error.message;
  }
  return input.defaultMessage;
};

const resolveTokenStatusErrorCode = (status: number): SvaMainserverErrorCode => {
  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 403) {
    return 'forbidden';
  }
  return 'token_request_failed';
};

const resolveGraphqlStatusErrorCode = (status: number): SvaMainserverErrorCode => {
  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 403) {
    return 'forbidden';
  }
  return 'network_error';
};

const parseGraphqlPayload = <TResult>(payload: unknown): TResult => {
  const payloadResult = graphqlResponseSchema.safeParse(payload);
  if (!payloadResult.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige GraphQL-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  const result = payloadResult.data as GraphqlResponse<TResult>;
  if (result.errors && result.errors.length > 0) {
    throw toSvaMainserverError({
      code: 'graphql_error',
      message: `GraphQL-Antwort des SVA-Mainservers enthielt ${result.errors.length} Fehler.`,
      statusCode: 502,
    });
  }
  if (result.data === undefined) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'GraphQL-Antwort des SVA-Mainservers enthielt keine Daten.',
      statusCode: 502,
    });
  }

  return result.data;
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const unwrapSettledResult = <TValue>(
  result: PromiseSettledResult<TValue>
): { ok: true; value: TValue } | { ok: false; error: SvaMainserverError } =>
  result.status === 'fulfilled'
    ? { ok: true, value: result.value }
    : { ok: false, error: normalizeUnexpectedError(result.reason) };

const withObservedHop = async <TValue>(
  input: {
    readonly hop: ServiceHop;
    readonly operationName: string;
    readonly connection: SvaMainserverConnectionInput;
  },
  work: () => Promise<TValue>
): Promise<TValue> => {
  const startMs = Date.now();

  return tracer.startActiveSpan(`sva_mainserver.${input.hop}`, async (span) => {
    span.setAttributes({
      'sva_mainserver.hop': input.hop,
      'sva_mainserver.operation': input.operationName,
      workspace_id: input.connection.instanceId,
      instance_id: input.connection.instanceId,
    });

    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      hopDurationHistogram.record(Date.now() - startMs, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'success',
      });
      hopRequestCounter.add(1, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'success',
      });
      return result;
    } catch (error) {
      const normalizedError = normalizeUnexpectedError(error);
      span.recordException(normalizedError);
      span.setStatus({ code: SpanStatusCode.ERROR, message: normalizedError.message });
      hopDurationHistogram.record(Date.now() - startMs, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'error',
        error_code: normalizedError.code,
      });
      hopRequestCounter.add(1, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'error',
        error_code: normalizedError.code,
      });
      throw normalizedError;
    } finally {
      span.end();
    }
  });
};

export const createSvaMainserverService = (options: SvaMainserverServiceOptions = {}) => {
  const loadInstanceConfig = options.loadInstanceConfig ?? loadSvaMainserverInstanceConfig;
  const readCredentials =
    options.readCredentials ??
    (async (input: { instanceId: string; keycloakSubject: string }) => {
      const result = await readSvaMainserverCredentialsWithStatus(input.keycloakSubject, input.instanceId);
      if (result.status === 'ok') {
        return result.credentials;
      }

      if (result.status === 'identity_provider_unavailable') {
        throw toSvaMainserverError({
          code: 'identity_provider_unavailable',
          message: 'Identity-Provider für Mainserver-Credentials ist nicht verfügbar.',
          statusCode: 503,
        });
      }

      return null;
    });
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const credentialCacheTtlMs = options.credentialCacheTtlMs ?? DEFAULT_CREDENTIAL_CACHE_TTL_MS;
  const tokenSkewMs = options.tokenSkewMs ?? DEFAULT_TOKEN_SKEW_MS;
  const upstreamTimeoutMs = options.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
  const credentialCacheMaxSize = options.credentialCacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
  const tokenCacheMaxSize = options.tokenCacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const randomIntImpl = options.randomIntImpl ?? randomInt;

  const credentialCache = new Map<string, TimedCacheEntry<CredentialValue>>();
  const tokenCache = new Map<string, TimedCacheEntry<string>>();
  const credentialLoads = new Map<string, Promise<CredentialValue>>();
  const tokenLoads = new Map<string, Promise<string>>();

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

  const fetchWithRetry = async ({ url, init, input, operationName, hop }: UpstreamRequestInput): Promise<Response> => {
    const executeRequest = async (): Promise<Response> =>
      fetchImpl(url, {
        ...init,
        redirect: 'manual',
        signal: init.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(upstreamTimeoutMs)])
          : AbortSignal.timeout(upstreamTimeoutMs),
      });

    try {
      const firstResponse = await executeRequest();
      if (!RETRYABLE_STATUS_CODES.has(firstResponse.status)) {
        return firstResponse;
      }

      await firstResponse.body?.cancel();
      const delayMs = retryBaseDelayMs + randomIntImpl(0, 100);
      logger.warn('SVA Mainserver upstream returned transient status, retrying once', {
        ...buildLogContext(input, {
          operation: operationName,
          hop,
          http_status: firstResponse.status,
          retry_delay_ms: delayMs,
        }),
      });
      await sleep(delayMs);
      return executeRequest();
    } catch (error) {
      if (!shouldRetryError(error)) {
        throw error;
      }

      const delayMs = retryBaseDelayMs + randomIntImpl(0, 100);
      logger.warn('SVA Mainserver upstream request failed transiently, retrying once', {
        ...buildLogContext(input, {
          operation: operationName,
          hop,
          retry_delay_ms: delayMs,
          error_message: error instanceof Error ? error.message : String(error),
        }),
      });
      await sleep(delayMs);
      return executeRequest();
    }
  };

  const loadCredentials = async (input: SvaMainserverConnectionInput): Promise<CredentialValue> => {
    const cacheKey = input.keycloakSubject;
    const nowMs = now();
    const cached = readCacheValue(credentialCache, cacheKey, nowMs, credentialCacheMaxSize);
    if (cached) {
      logger.debug('SVA Mainserver credential cache hit', {
        ...buildLogContext(input, {
          operation: 'load_credentials',
          cache: 'hit',
        }),
      });
      return cached;
    }

    logger.debug('SVA Mainserver credential cache miss', {
      ...buildLogContext(input, {
        operation: 'load_credentials',
        cache: 'miss',
      }),
    });

    const inflight = credentialLoads.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const loadPromise = withObservedHop(
      {
        hop: 'keycloak',
        operationName: 'load_credentials',
        connection: input,
      },
      async () => {
        let credentials: CredentialValue | null;
        try {
          credentials = await readCredentials({
            instanceId: input.instanceId,
            keycloakSubject: input.keycloakSubject,
          });
        } catch (error) {
          const normalizedError =
            error instanceof SvaMainserverError
              ? error
              : toSvaMainserverError({
                  code: 'identity_provider_unavailable',
                  message: 'Identity-Provider für Mainserver-Credentials ist nicht verfügbar.',
                  statusCode: 503,
                });

          logger.warn('SVA Mainserver identity provider is unavailable', {
            ...buildLogContext(input, {
              operation: 'load_credentials',
              error_code: normalizedError.code,
            }),
          });
          throw normalizedError;
        }

        if (!credentials) {
          logger.warn('SVA Mainserver credentials are missing in Keycloak attributes', {
            ...buildLogContext(input, {
              operation: 'load_credentials',
              error_code: 'missing_credentials',
            }),
          });
          throw toSvaMainserverError({
            code: 'missing_credentials',
            message: 'API-Key oder API-Secret für den SVA-Mainserver fehlen.',
            statusCode: 400,
          });
        }

        const value = credentials;
        const cacheWriteNowMs = now();
        writeCacheValue(
          credentialCache,
          cacheKey,
          value,
          cacheWriteNowMs + credentialCacheTtlMs,
          cacheWriteNowMs,
          credentialCacheMaxSize
        );
        logger.info('SVA Mainserver credentials loaded', {
          ...buildLogContext(input, {
            operation: 'load_credentials',
            cache: 'store',
          }),
        });
        return value;
      }
    );

    credentialLoads.set(cacheKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      credentialLoads.delete(cacheKey);
    }
  };

  const loadAccessToken = async (
    input: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<string> => {
    const credentials = await loadCredentials(input);
    const tokenCacheKey =
      `${input.instanceId}:${input.keycloakSubject}:${credentials.apiKey}:` +
      `${config.oauthTokenUrl}:${config.graphqlBaseUrl}`;
    const nowMs = now();
    const cached = readCacheValue(tokenCache, tokenCacheKey, nowMs, tokenCacheMaxSize);
    const cacheEntry = tokenCache.get(tokenCacheKey);
    if (cached && cacheEntry && cacheEntry.expiresAtMs > nowMs + tokenSkewMs) {
      logger.debug('SVA Mainserver token cache hit', {
        ...buildLogContext(input, {
          operation: 'load_access_token',
          cache: 'hit',
        }),
      });
      return cached;
    }

    logger.debug('SVA Mainserver token cache miss', {
      ...buildLogContext(input, {
        operation: 'load_access_token',
        cache: 'miss',
      }),
    });

    const inflight = tokenLoads.get(tokenCacheKey);
    if (inflight) {
      return inflight;
    }

    const loadPromise = withObservedHop(
      {
        hop: 'oauth2',
        operationName: 'load_access_token',
        connection: input,
      },
      async () => {
        const body = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: credentials.apiKey,
          client_secret: credentials.apiSecret,
        });

        let response: Response;
        try {
          response = await fetchWithRetry({
            url: config.oauthTokenUrl,
            input,
            operationName: 'load_access_token',
            hop: 'oauth2',
            init: {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                ...buildForwardHeaders(),
              },
              body,
            },
          });
        } catch (error) {
          logger.warn('SVA Mainserver token request failed', {
            ...buildLogContext(input, {
              operation: 'load_access_token',
              error_code: 'network_error',
              error_message: error instanceof Error ? error.message : String(error),
            }),
          });
          throw toSvaMainserverError({
            code: 'network_error',
            message: resolveNetworkErrorMessage({
              error,
              timeoutMessage: 'Zeitüberschreitung beim Tokenabruf vom SVA-Mainserver.',
              defaultMessage: 'Netzwerkfehler beim Tokenabruf.',
            }),
            statusCode: 503,
          });
        }

        if (!response.ok) {
          const errorCode = resolveTokenStatusErrorCode(response.status);
          logger.warn('SVA Mainserver token request returned an error status', {
            ...buildLogContext(input, {
              operation: 'load_access_token',
              error_code: errorCode,
              http_status: response.status,
            }),
          });
          throw toSvaMainserverError({
            code: errorCode,
            message: `Tokenabruf fehlgeschlagen (${response.status}).`,
            statusCode: response.status,
          });
        }

        const payloadResult = tokenResponseSchema.safeParse(await parseJsonBody(response));
        if (!payloadResult.success) {
          logger.warn('SVA Mainserver token response failed schema validation', {
            ...buildLogContext(input, {
              operation: 'load_access_token',
              error_code: 'invalid_response',
            }),
          });
          throw toSvaMainserverError({
            code: 'invalid_response',
            message: 'Ungültige Token-Antwort des SVA-Mainservers.',
            statusCode: 502,
          });
        }

        const cacheWriteNowMs = now();
        const expiresAtMs = cacheWriteNowMs + payloadResult.data.expires_in * 1000;
        writeCacheValue(
          tokenCache,
          tokenCacheKey,
          payloadResult.data.access_token,
          expiresAtMs,
          cacheWriteNowMs,
          tokenCacheMaxSize
        );
        logger.info('SVA Mainserver access token loaded', {
          ...buildLogContext(input, {
            operation: 'load_access_token',
            cache: 'store',
            expires_at_ms: expiresAtMs,
          }),
        });
        return payloadResult.data.access_token;
      }
    );

    tokenLoads.set(tokenCacheKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      tokenLoads.delete(tokenCacheKey);
    }
  };

  const executeGraphqlWithConfig = async <TResult>(
    input: SvaMainserverConnectionInput & {
      readonly document: string;
      readonly operationName: string;
    },
    config: SvaMainserverInstanceConfig
  ): Promise<TResult> => {
    const accessToken = await loadAccessToken(input, config);

    return withObservedHop(
      {
        hop: 'graphql',
        operationName: input.operationName,
        connection: input,
      },
      async () => {
        let response: Response;
        try {
          response = await fetchWithRetry({
            url: config.graphqlBaseUrl,
            input,
            operationName: input.operationName,
            hop: 'graphql',
            init: {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                ...buildForwardHeaders(),
              },
              body: JSON.stringify({
                operationName: input.operationName,
                query: input.document,
              }),
            },
          });
        } catch (error) {
          logger.warn('SVA Mainserver GraphQL request failed', {
            ...buildLogContext(input, {
              operation: input.operationName,
              error_code: 'network_error',
              error_message: error instanceof Error ? error.message : String(error),
            }),
          });
          throw toSvaMainserverError({
            code: 'network_error',
            message: resolveNetworkErrorMessage({
              error,
              timeoutMessage: 'Zeitüberschreitung beim GraphQL-Aufruf des SVA-Mainservers.',
              defaultMessage: 'Netzwerkfehler beim GraphQL-Aufruf.',
            }),
            statusCode: 503,
          });
        }

        if (!response.ok) {
          const errorCode = resolveGraphqlStatusErrorCode(response.status);
          logger.warn('SVA Mainserver GraphQL request returned an error status', {
            ...buildLogContext(input, {
              operation: input.operationName,
              error_code: errorCode,
              http_status: response.status,
            }),
          });
          throw toSvaMainserverError({
            code: errorCode,
            message: `GraphQL-Aufruf fehlgeschlagen (${response.status}).`,
            statusCode: response.status,
          });
        }

        let payload: TResult;
        try {
          payload = parseGraphqlPayload<TResult>(await parseJsonBody(response));
        } catch (error) {
          const normalizedError = normalizeUnexpectedError(error);
          logger.warn('SVA Mainserver GraphQL response validation failed', {
            ...buildLogContext(input, {
              operation: input.operationName,
              error_code: normalizedError.code,
            }),
          });
          throw normalizedError;
        }

        logger.info('SVA Mainserver GraphQL operation succeeded', {
          ...buildLogContext(input, {
            operation: input.operationName,
          }),
        });
        return payload;
      }
    );
  };

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
    getConnectionStatus,
    getMutationRootTypename,
    getQueryRootTypename,
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
