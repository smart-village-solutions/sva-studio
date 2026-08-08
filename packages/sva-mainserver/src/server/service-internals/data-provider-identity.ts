import { z } from 'zod';

import type {
  SvaMainserverConnectionInput,
  SvaMainserverDataProviderIdentity,
  SvaMainserverInstanceConfig,
} from '../../types.js';

import type { createAccessTokenProvider } from './access-token-provider.js';
import type { createFetchWithRetry } from './graphql-client.js';
import { buildForwardHeaders, buildLogContext, logger, withObservedHop } from './observability.js';
import {
  parseJsonBody,
  resolveGraphqlStatusErrorCode,
  resolveNetworkErrorMessage,
  toSvaMainserverError,
} from './shared.js';

const identityResponseSchema = z
  .object({
    data_provider: z
      .object({
        id: z.union([z.string(), z.number().int()]).nullish(),
        name: z.string().nullish(),
      })
      .passthrough(),
  })
  .passthrough();

const normalizeIdentifier = (value: string | number | null | undefined): string | undefined => {
  if (typeof value === 'number') {
    return String(value);
  }
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const resolveIdentityUrl = (graphqlBaseUrl: string): string =>
  new URL('/data_provider.json', graphqlBaseUrl).toString();

export const createDataProviderIdentityOperation =
  (input: {
    readonly fetchWithRetry: ReturnType<typeof createFetchWithRetry>;
    readonly loadAccessToken: ReturnType<typeof createAccessTokenProvider>;
  }) =>
  async (
    connection: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverDataProviderIdentity> => {
    const accessToken = await input.loadAccessToken(connection, config);

    return withObservedHop(
      {
        hop: 'identity',
        operationName: 'load_data_provider_identity',
        connection,
      },
      async () => {
        let response: Response;
        try {
          response = await input.fetchWithRetry({
            url: resolveIdentityUrl(config.graphqlBaseUrl),
            input: connection,
            operationName: 'load_data_provider_identity',
            hop: 'identity',
            init: {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
                ...buildForwardHeaders(),
              },
            },
          });
        } catch (error) {
          throw toSvaMainserverError({
            code: 'network_error',
            message: resolveNetworkErrorMessage({
              error,
              timeoutMessage: 'Zeitüberschreitung beim DataProvider-Identity-Aufruf.',
              defaultMessage: 'Netzwerkfehler beim DataProvider-Identity-Aufruf.',
            }),
            statusCode: 503,
          });
        }

        if (!response.ok) {
          const errorCode = resolveGraphqlStatusErrorCode(response.status);
          throw toSvaMainserverError({
            code: errorCode,
            message: `DataProvider-Identity-Aufruf fehlgeschlagen (${response.status}).`,
            statusCode: response.status,
          });
        }

        const parsed = identityResponseSchema.safeParse(await parseJsonBody(response));
        if (!parsed.success) {
          logger.warn('SVA Mainserver DataProvider identity response failed schema validation', {
            ...buildLogContext(connection, {
              operation: 'load_data_provider_identity',
              error_code: 'invalid_response',
            }),
          });
          throw toSvaMainserverError({
            code: 'invalid_response',
            message: 'Ungültige DataProvider-Identity-Antwort des SVA-Mainservers.',
            statusCode: 502,
          });
        }

        const id = normalizeIdentifier(parsed.data.data_provider.id);
        const name = normalizeIdentifier(parsed.data.data_provider.name);
        return {
          dataProvider: {
            ...(id ? { id } : {}),
            ...(name ? { name } : {}),
          },
          hasStableId: Boolean(id),
        };
      }
    );
  };
