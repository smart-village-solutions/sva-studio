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
  readonly actingPrincipalType?: 'organization' | 'user';
}) => Promise<CredentialValue | null>;

type CredentialProviderOptions = Readonly<{
  readCredentials: ReadCredentials;
  now: () => number;
  credentialCacheTtlMs: number;
  credentialCacheMaxSize: number;
}>;

export const createDefaultCredentialReader = (): ReadCredentials => async (input) => {
  const result = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    activeOrganizationId: input.activeOrganizationId,
    actingPrincipalType: input.actingPrincipalType,
  });
  if (result.status === 'ok') {
    return {
      ...result.credentials,
      credentialSource: result.source,
      credentialOrganizationId: result.organizationId,
      credentialFingerprint: result.credentialFingerprint,
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

  if (result.status === 'acting_principal_not_allowed') {
    throw toSvaMainserverError({
      code: 'acting_principal_not_allowed',
      message: 'Der ausgewählte Mutationsprincipal ist für die aktive Organisation nicht zulässig.',
      statusCode: 403,
    });
  }

  return null;
};

const credentialCacheKey = (connection: SvaMainserverConnectionInput): string =>
  `${connection.instanceId}:${connection.keycloakSubject}:${connection.activeOrganizationId ?? 'none'}:` +
  `${connection.actingPrincipalType ?? 'automatic'}:${connection.credentialFingerprint ?? 'unbound'}`;

const readCredentialValue = async (
  input: CredentialProviderOptions,
  connection: SvaMainserverConnectionInput
): Promise<CredentialValue> => {
  let credentials: CredentialValue | null;
  try {
    credentials = await input.readCredentials({
      instanceId: connection.instanceId,
      keycloakSubject: connection.keycloakSubject,
      activeOrganizationId: connection.activeOrganizationId,
      actingPrincipalType: connection.actingPrincipalType,
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
  if (
    connection.credentialFingerprint &&
    credentials.credentialFingerprint !== connection.credentialFingerprint
  ) {
    logger.warn('SVA Mainserver credential context changed during mutation', {
      ...buildLogContext(connection, {
        operation: 'load_credentials',
        error_code: 'credential_context_changed',
      }),
    });
    throw toSvaMainserverError({
      code: 'credential_context_changed',
      message: 'Der gebundene Mainserver-Credential-Kontext ist nicht mehr aktuell.',
      statusCode: 409,
    });
  }
  return credentials;
};

const loadAndCacheCredential = async (input: {
  options: CredentialProviderOptions;
  connection: SvaMainserverConnectionInput;
  cache: Map<string, TimedCacheEntry<CredentialValue>>;
  cacheKey: string;
}): Promise<CredentialValue> => {
  const credentials = await withObservedHop(
    {
      hop: 'keycloak',
      operationName: 'load_credentials',
      connection: input.connection,
    },
    async () => readCredentialValue(input.options, input.connection)
  );
  const nowMs = input.options.now();
  writeTimedCacheValue(
    input.cache,
    input.cacheKey,
    credentials,
    nowMs + input.options.credentialCacheTtlMs,
    nowMs,
    input.options.credentialCacheMaxSize
  );
  logger.info('SVA Mainserver credentials loaded', {
    ...buildLogContext(input.connection, { operation: 'load_credentials', cache: 'store' }),
  });
  return credentials;
};

export const createCredentialProvider = (input: CredentialProviderOptions) => {
  const credentialCache = new Map<string, TimedCacheEntry<CredentialValue>>();
  const credentialLoads = new Map<string, Promise<CredentialValue>>();

  return async (connection: SvaMainserverConnectionInput): Promise<CredentialValue> => {
    const cacheKey = credentialCacheKey(connection);
    const nowMs = input.now();
    const cached = readTimedCacheValue(
      credentialCache,
      cacheKey,
      nowMs,
      input.credentialCacheMaxSize
    );
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

    const loadPromise = loadAndCacheCredential({
      options: input,
      connection,
      cache: credentialCache,
      cacheKey,
    });

    credentialLoads.set(cacheKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      credentialLoads.delete(cacheKey);
    }
  };
};
