import type { SvaMainserverConnectionInput } from '../../types.js';

import { readEffectiveSvaMainserverCredentialsWithStatus } from '@sva/auth-runtime/server';

import { SvaMainserverError } from '../errors.js';
import { readTimedCacheValue, type TimedCacheEntry, writeTimedCacheValue } from './cache.js';
import { buildLogContext, logger, withObservedHop } from './observability.js';
import { type CredentialValue, toSvaMainserverError } from './shared.js';

type ReadCredentials = (input: {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
}) => Promise<CredentialValue | null>;

export const createDefaultCredentialReader = (): ReadCredentials => async (input) => {
  const result = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    activeOrganizationId: input.activeOrganizationId,
  });
  if (result.status === 'ok') {
    return {
      ...result.credentials,
      credentialSource: result.source,
      credentialOrganizationId: result.organizationId,
    };
  }

  if (result.status === 'identity_provider_unavailable') {
    throw toSvaMainserverError({
      code: 'identity_provider_unavailable',
      message: 'Identity-Provider für Mainserver-Credentials ist nicht verfügbar.',
      statusCode: 503,
    });
  }

  if (result.status === 'database_unavailable') {
    throw toSvaMainserverError({
      code: 'database_unavailable',
      message: 'Organisationskontext für Mainserver-Credentials konnte nicht geladen werden.',
      statusCode: 503,
    });
  }

  if (result.status === 'organization_mainserver_credentials_missing') {
    throw toSvaMainserverError({
      code: 'organization_mainserver_credentials_missing',
      message: 'Für die aktive Organisation fehlen Mainserver-Credentials.',
      statusCode: 409,
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
    const cacheKey =
      `${connection.instanceId}:${connection.keycloakSubject}:${connection.activeOrganizationId ?? 'none'}`;
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
            error instanceof SvaMainserverError
              ? error
              : toSvaMainserverError({
                  code: 'identity_provider_unavailable',
                  message: 'Identity-Provider für Mainserver-Credentials ist nicht verfügbar.',
                  statusCode: 503,
                });

          logger.warn('SVA Mainserver identity provider is unavailable', {
            ...buildLogContext(connection, {
              operation: 'load_credentials',
              error_code: normalizedError.code,
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
