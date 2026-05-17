import type { SvaMainserverConnectionInput } from '../../types.js';

import { readSvaMainserverCredentialsWithStatus } from '@sva/auth-runtime/server';

import { readTimedCacheValue, type TimedCacheEntry, writeTimedCacheValue } from './cache.js';
import { buildLogContext, logger, withObservedHop } from './observability.js';
import { type CredentialValue, toSvaMainserverError } from './shared.js';

type ReadCredentials = (input: {
  readonly instanceId: string;
  readonly keycloakSubject: string;
}) => Promise<CredentialValue | null>;

export const createDefaultCredentialReader = (): ReadCredentials => async (input) => {
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
};

export const createCredentialProvider = (input: {
  readonly readCredentials: ReadCredentials;
  readonly now: () => number;
  readonly credentialCacheTtlMs: number;
  readonly credentialCacheMaxSize: number;
}) => {
  const credentialCache = new Map<string, TimedCacheEntry<CredentialValue>>();
  const credentialLoads = new Map<string, Promise<CredentialValue>>();

  return async (connection: SvaMainserverConnectionInput): Promise<CredentialValue> => {
    const cacheKey = connection.keycloakSubject;
    const nowMs = input.now();
    const cached = readTimedCacheValue(credentialCache, cacheKey, nowMs, input.credentialCacheMaxSize);
    if (cached) {
      logger.debug('SVA Mainserver credential cache hit', {
        ...buildLogContext(connection, {
          operation: 'load_credentials',
          cache: 'hit',
        }),
      });
      return cached;
    }

    logger.debug('SVA Mainserver credential cache miss', {
      ...buildLogContext(connection, {
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
        connection,
      },
      async () => {
        let credentials: CredentialValue | null;
        try {
          credentials = await input.readCredentials({
            instanceId: connection.instanceId,
            keycloakSubject: connection.keycloakSubject,
          });
        } catch (error) {
          const normalizedError =
            error instanceof Error && 'code' in error
              ? error
              : toSvaMainserverError({
                  code: 'identity_provider_unavailable',
                  message: 'Identity-Provider für Mainserver-Credentials ist nicht verfügbar.',
                  statusCode: 503,
                });

          logger.warn('SVA Mainserver identity provider is unavailable', {
            ...buildLogContext(connection, {
              operation: 'load_credentials',
              error_code: 'code' in normalizedError ? normalizedError.code : 'identity_provider_unavailable',
            }),
          });
          throw normalizedError;
        }

        if (!credentials) {
          logger.warn('SVA Mainserver credentials are missing in Keycloak attributes', {
            ...buildLogContext(connection, {
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

        const cacheWriteNowMs = input.now();
        writeTimedCacheValue(
          credentialCache,
          cacheKey,
          credentials,
          cacheWriteNowMs + input.credentialCacheTtlMs,
          cacheWriteNowMs,
          input.credentialCacheMaxSize
        );
        logger.info('SVA Mainserver credentials loaded', {
          ...buildLogContext(connection, {
            operation: 'load_credentials',
            cache: 'store',
          }),
        });
        return credentials;
      }
    );

    credentialLoads.set(cacheKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      credentialLoads.delete(cacheKey);
    }
  };
};
