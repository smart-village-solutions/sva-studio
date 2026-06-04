import { randomBytes, scryptSync } from 'node:crypto';
import { z } from 'zod';

import type { SvaMainserverConnectionInput, SvaMainserverInstanceConfig } from '../../types.js';

import { readTimedCacheValue, type TimedCacheEntry, writeTimedCacheValue } from './cache.js';
import { buildForwardHeaders, buildLogContext, logger, withObservedHop } from './observability.js';
import {
  parseJsonBody,
  resolveNetworkErrorMessage,
  resolveTokenStatusErrorCode,
  toSvaMainserverError,
  type CredentialValue,
} from './shared.js';

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().finite().positive(),
});

export const createAccessTokenProvider = (input: {
  readonly now: () => number;
  readonly tokenSkewMs: number;
  readonly tokenCacheMaxSize: number;
  readonly loadCredentials: (connection: SvaMainserverConnectionInput) => Promise<CredentialValue>;
  readonly fetchWithRetry: (input: {
    readonly url: string;
    readonly init: RequestInit;
    readonly input: SvaMainserverConnectionInput;
    readonly operationName: string;
    readonly hop: 'oauth2';
  }) => Promise<Response>;
}) => {
  const tokenCache = new Map<string, TimedCacheEntry<string>>();
  const tokenLoads = new Map<string, Promise<string>>();
  const credentialFingerprintSalt = randomBytes(16);

  const resolveCredentialSignature = (credentials: CredentialValue): string =>
    scryptSync(
      [
        credentials.apiKey,
        credentials.apiSecret,
        credentials.credentialSource ?? 'unknown',
        credentials.credentialOrganizationId ?? 'none',
      ].join('\u0000'),
      credentialFingerprintSalt,
      32,
    ).toString('hex');

  return async (connection: SvaMainserverConnectionInput, config: SvaMainserverInstanceConfig): Promise<string> => {
    const credentials = await input.loadCredentials(connection);
    const credentialSignature = resolveCredentialSignature(credentials);
    const tokenCacheKey =
      `${connection.instanceId}:${connection.keycloakSubject}:${connection.activeOrganizationId ?? 'none'}:` +
      `${credentialSignature}:` +
      `${config.oauthTokenUrl}:${config.graphqlBaseUrl}`;
    const nowMs = input.now();
    const cached = readTimedCacheValue(tokenCache, tokenCacheKey, nowMs, input.tokenCacheMaxSize);
    const cacheEntry = tokenCache.get(tokenCacheKey);
    if (cached && cacheEntry && cacheEntry.expiresAtMs > nowMs + input.tokenSkewMs) {
      logger.debug('SVA Mainserver token cache hit', {
        ...buildLogContext(connection, {
          operation: 'load_access_token',
          cache: 'hit',
        }),
      });
      return cached;
    }

    logger.debug('SVA Mainserver token cache miss', {
      ...buildLogContext(connection, {
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
        connection,
      },
      async () => {
        const body = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: credentials.apiKey,
          client_secret: credentials.apiSecret,
        });

        let response: Response;
        try {
          response = await input.fetchWithRetry({
            url: config.oauthTokenUrl,
            input: connection,
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
            ...buildLogContext(connection, {
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
            ...buildLogContext(connection, {
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
            ...buildLogContext(connection, {
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

        const cacheWriteNowMs = input.now();
        const expiresAtMs = cacheWriteNowMs + payloadResult.data.expires_in * 1000;
        writeTimedCacheValue(
          tokenCache,
          tokenCacheKey,
          payloadResult.data.access_token,
          expiresAtMs,
          cacheWriteNowMs,
          input.tokenCacheMaxSize
        );
        logger.info('SVA Mainserver access token loaded', {
          ...buildLogContext(connection, {
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
};
