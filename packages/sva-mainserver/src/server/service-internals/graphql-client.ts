import type { SvaMainserverConnectionInput, SvaMainserverInstanceConfig } from '../../types.js';

import { buildForwardHeaders, buildLogContext, logger, withObservedHop } from './observability.js';
import {
  parseGraphqlPayload,
  parseJsonBody,
  resolveGraphqlStatusErrorCode,
  resolveNetworkErrorMessage,
  RETRYABLE_STATUS_CODES,
  shouldRetryError,
  sleep,
  toSvaMainserverError,
  type GraphqlExecutor,
  type GraphqlOperationInput,
  type UpstreamRequestInput,
} from './shared.js';

export const createFetchWithRetry = (input: {
  readonly fetchImpl: typeof fetch;
  readonly upstreamTimeoutMs: number;
  readonly retryBaseDelayMs: number;
  readonly randomIntImpl: (min: number, max: number) => number;
}) => {
  return async ({ url, init, input: connection, operationName, hop }: UpstreamRequestInput): Promise<Response> => {
    const executeRequest = async (): Promise<Response> =>
      input.fetchImpl(url, {
        ...init,
        redirect: 'manual',
        signal: init.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(input.upstreamTimeoutMs)])
          : AbortSignal.timeout(input.upstreamTimeoutMs),
      });

    try {
      const firstResponse = await executeRequest();
      if (!RETRYABLE_STATUS_CODES.has(firstResponse.status)) {
        return firstResponse;
      }

      await firstResponse.body?.cancel();
      const delayMs = input.retryBaseDelayMs + input.randomIntImpl(0, 100);
      logger.warn('SVA Mainserver upstream returned transient status, retrying once', {
        ...buildLogContext(connection, {
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

      const delayMs = input.retryBaseDelayMs + input.randomIntImpl(0, 100);
      logger.warn('SVA Mainserver upstream request failed transiently, retrying once', {
        ...buildLogContext(connection, {
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
};

export const createGraphqlExecutor = (input: {
  readonly fetchWithRetry: ReturnType<typeof createFetchWithRetry>;
  readonly loadAccessToken: (connection: SvaMainserverConnectionInput, config: SvaMainserverInstanceConfig) => Promise<string>;
}): GraphqlExecutor => {
  return async <TResult>(operation: GraphqlOperationInput, config: SvaMainserverInstanceConfig): Promise<TResult> => {
    const accessToken = await input.loadAccessToken(operation, config);

    return withObservedHop(
      {
        hop: 'graphql',
        operationName: operation.operationName,
        connection: operation,
      },
      async () => {
        let response: Response;
        try {
          response = await input.fetchWithRetry({
            url: config.graphqlBaseUrl,
            input: operation,
            operationName: operation.operationName,
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
                operationName: operation.operationName,
                query: operation.document,
                ...(operation.variables ? { variables: operation.variables } : {}),
              }),
            },
          });
        } catch (error) {
          logger.warn('SVA Mainserver GraphQL request failed', {
            ...buildLogContext(operation, {
              operation: operation.operationName,
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
            ...buildLogContext(operation, {
              operation: operation.operationName,
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

        try {
          const payload = await parseJsonBody(response);
          const result = parseGraphqlPayload<TResult>(payload);
          logger.info('SVA Mainserver GraphQL operation succeeded', {
            ...buildLogContext(operation, {
              operation: operation.operationName,
            }),
          });
          return result;
        } catch (error) {
          const normalizedError = error instanceof Error && 'code' in error ? error : toSvaMainserverError({
            code: 'network_error',
            message: error instanceof Error ? error.message : 'Unbekannter Mainserver-Fehler.',
            statusCode: 503,
          });
          logger.warn('SVA Mainserver GraphQL response validation failed', {
            ...buildLogContext(operation, {
              operation: operation.operationName,
              error_code: 'code' in normalizedError ? normalizedError.code : 'network_error',
            }),
          });
          throw normalizedError;
        }
      }
    );
  };
};
