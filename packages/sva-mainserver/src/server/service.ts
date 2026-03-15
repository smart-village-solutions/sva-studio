import type { IdentityUserAttributes } from '@sva/auth';
import { readIdentityUserAttributes } from '@sva/auth/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';

import type { SvaMainserverConnectionInput, SvaMainserverConnectionStatus, SvaMainserverInstanceConfig } from '../types';
import type { SvaMainserverErrorCode } from '../types';
import {
  svaMainserverMutationRootTypenameDocument,
  svaMainserverQueryRootTypenameDocument,
  type SvaMainserverMutationRootTypenameMutation,
  type SvaMainserverQueryRootTypenameQuery,
} from '../generated/diagnostics';
import { loadSvaMainserverInstanceConfig } from './config-store';
import { SvaMainserverError } from './errors';

type CredentialValue = {
  readonly apiKey: string;
  readonly apiSecret: string;
};

type TokenCacheEntry = {
  readonly accessToken: string;
  readonly expiresAtMs: number;
};

type CredentialCacheEntry = {
  readonly value: CredentialValue;
  readonly expiresAtMs: number;
};

type TokenResponse = {
  readonly access_token: string;
  readonly expires_in: number;
};

type GraphqlResponse<TResult> = {
  readonly data?: TResult;
  readonly errors?: readonly {
    readonly message?: string;
  }[];
};

export type SvaMainserverServiceOptions = {
  readonly loadInstanceConfig?: (instanceId: string) => Promise<SvaMainserverInstanceConfig>;
  readonly readIdentityUserAttributes?: (
    keycloakSubject: string,
    attributeNames?: readonly string[]
  ) => Promise<IdentityUserAttributes | null>;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly credentialCacheTtlMs?: number;
  readonly tokenSkewMs?: number;
};

const logger = createSdkLogger({ component: 'sva-mainserver', level: 'info' });

const DEFAULT_CREDENTIAL_CACHE_TTL_MS = 60_000;
const DEFAULT_TOKEN_SKEW_MS = 60_000;
const MAIN_SERVER_API_KEY_ATTRIBUTE = 'sva_mainserver_api_key';
const MAIN_SERVER_API_SECRET_ATTRIBUTE = 'sva_mainserver_api_secret';

const normalizeAttributeValue = (value: readonly string[] | undefined): string | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const candidate = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
  return candidate?.trim() ?? null;
};

const toSvaMainserverError = (input: {
  code: SvaMainserverErrorCode;
  message: string;
  statusCode?: number;
}): SvaMainserverError => new SvaMainserverError(input);

export const createSvaMainserverService = (options: SvaMainserverServiceOptions = {}) => {
  const loadInstanceConfig = options.loadInstanceConfig ?? loadSvaMainserverInstanceConfig;
  const readAttributes =
    options.readIdentityUserAttributes ??
    ((keycloakSubject: string, attributeNames?: readonly string[]) =>
      readIdentityUserAttributes({
        keycloakSubject,
        attributeNames,
      }));
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const credentialCacheTtlMs = options.credentialCacheTtlMs ?? DEFAULT_CREDENTIAL_CACHE_TTL_MS;
  const tokenSkewMs = options.tokenSkewMs ?? DEFAULT_TOKEN_SKEW_MS;

  const credentialCache = new Map<string, CredentialCacheEntry>();
  const tokenCache = new Map<string, TokenCacheEntry>();
  const credentialLoads = new Map<string, Promise<CredentialValue>>();
  const tokenLoads = new Map<string, Promise<string>>();

  const buildForwardHeaders = (): Record<string, string> => {
    const context = getWorkspaceContext();
    return {
      ...(context.requestId ? { 'X-Request-Id': context.requestId } : {}),
      ...(context.traceId ? { 'X-Trace-Id': context.traceId } : {}),
    };
  };

  const loadCredentials = async (keycloakSubject: string): Promise<CredentialValue> => {
    const cached = credentialCache.get(keycloakSubject);
    if (cached && cached.expiresAtMs > now()) {
      return cached.value;
    }

    const inflight = credentialLoads.get(keycloakSubject);
    if (inflight) {
      return inflight;
    }

    const loadPromise = (async () => {
      const attributes = await readAttributes(keycloakSubject, [
        MAIN_SERVER_API_KEY_ATTRIBUTE,
        MAIN_SERVER_API_SECRET_ATTRIBUTE,
      ]);
      if (attributes === null) {
        throw toSvaMainserverError({
          code: 'identity_provider_unavailable',
          message: 'Keycloak-Attribute für die Mainserver-Anbindung konnten nicht geladen werden.',
          statusCode: 503,
        });
      }

      const apiKey = normalizeAttributeValue(attributes[MAIN_SERVER_API_KEY_ATTRIBUTE]);
      const apiSecret = normalizeAttributeValue(attributes[MAIN_SERVER_API_SECRET_ATTRIBUTE]);
      if (!apiKey || !apiSecret) {
        throw toSvaMainserverError({
          code: 'missing_credentials',
          message: 'API-Key oder API-Secret für den SVA-Mainserver fehlen.',
          statusCode: 400,
        });
      }

      const value = { apiKey, apiSecret };
      credentialCache.set(keycloakSubject, {
        value,
        expiresAtMs: now() + credentialCacheTtlMs,
      });
      return value;
    })();

    credentialLoads.set(keycloakSubject, loadPromise);
    try {
      return await loadPromise;
    } finally {
      credentialLoads.delete(keycloakSubject);
    }
  };

  const loadAccessToken = async (
    input: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<string> => {
    const credentials = await loadCredentials(input.keycloakSubject);
    const tokenCacheKey = `${input.instanceId}:${input.keycloakSubject}:${credentials.apiKey}`;
    const cached = tokenCache.get(tokenCacheKey);
    if (cached && cached.expiresAtMs > now() + tokenSkewMs) {
      return cached.accessToken;
    }

    const inflight = tokenLoads.get(tokenCacheKey);
    if (inflight) {
      return inflight;
    }

    const loadPromise = (async () => {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.apiKey,
        client_secret: credentials.apiSecret,
      });

      let response: Response;
      try {
        response = await fetchImpl(config.oauthTokenUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            ...buildForwardHeaders(),
          },
          body,
        });
      } catch (error) {
        throw toSvaMainserverError({
          code: 'network_error',
          message: error instanceof Error ? error.message : 'Netzwerkfehler beim Tokenabruf.',
          statusCode: 503,
        });
      }

      if (!response.ok) {
        throw toSvaMainserverError({
          code:
            response.status === 401
              ? 'unauthorized'
              : response.status === 403
                ? 'forbidden'
                : 'token_request_failed',
          message: `Tokenabruf fehlgeschlagen (${response.status}).`,
          statusCode: response.status,
        });
      }

      const payload = (await response.json()) as Partial<TokenResponse>;
      if (typeof payload.access_token !== 'string' || typeof payload.expires_in !== 'number') {
        throw toSvaMainserverError({
          code: 'invalid_response',
          message: 'Ungültige Token-Antwort des SVA-Mainservers.',
          statusCode: 502,
        });
      }

      tokenCache.set(tokenCacheKey, {
        accessToken: payload.access_token,
        expiresAtMs: now() + payload.expires_in * 1000,
      });
      return payload.access_token;
    })();

    tokenLoads.set(tokenCacheKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      tokenLoads.delete(tokenCacheKey);
    }
  };

  const executeGraphql = async <TResult>(
    input: SvaMainserverConnectionInput & {
      readonly document: string;
      readonly operationName: string;
    }
  ): Promise<TResult> => {
    const config = await loadInstanceConfig(input.instanceId);
    const accessToken = await loadAccessToken(input, config);

    let response: Response;
    try {
      response = await fetchImpl(config.graphqlBaseUrl, {
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
      });
    } catch (error) {
      throw toSvaMainserverError({
        code: 'network_error',
        message: error instanceof Error ? error.message : 'Netzwerkfehler beim GraphQL-Aufruf.',
        statusCode: 503,
      });
    }

    if (!response.ok) {
      throw toSvaMainserverError({
        code:
          response.status === 401
            ? 'unauthorized'
            : response.status === 403
              ? 'forbidden'
              : 'network_error',
        message: `GraphQL-Aufruf fehlgeschlagen (${response.status}).`,
        statusCode: response.status,
      });
    }

    const payload = (await response.json()) as GraphqlResponse<TResult>;
    if (payload.errors && payload.errors.length > 0) {
      throw toSvaMainserverError({
        code: 'graphql_error',
        message: payload.errors.map((entry) => entry.message ?? 'Unbekannter GraphQL-Fehler').join('; '),
        statusCode: 502,
      });
    }
    if (payload.data === undefined) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'GraphQL-Antwort des SVA-Mainservers enthielt keine Daten.',
        statusCode: 502,
      });
    }

    return payload.data;
  };

  const getQueryRootTypename = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverQueryRootTypenameQuery> =>
    executeGraphql<SvaMainserverQueryRootTypenameQuery>({
      ...input,
      document: svaMainserverQueryRootTypenameDocument,
      operationName: 'SvaMainserverQueryRootTypename',
    });

  const getMutationRootTypename = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverMutationRootTypenameMutation> =>
    executeGraphql<SvaMainserverMutationRootTypenameMutation>({
      ...input,
      document: svaMainserverMutationRootTypenameDocument,
      operationName: 'SvaMainserverMutationRootTypename',
    });

  const getConnectionStatus = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverConnectionStatus> => {
    try {
      const config = await loadInstanceConfig(input.instanceId);
      const [queryRoot, mutationRoot] = await Promise.all([
        getQueryRootTypename(input),
        getMutationRootTypename(input),
      ]);

      return {
        status: 'connected',
        checkedAt: new Date(now()).toISOString(),
        config,
        queryRootTypename: queryRoot.__typename,
        mutationRootTypename: mutationRoot.__typename,
      };
    } catch (error) {
      const normalizedError =
        error instanceof SvaMainserverError
          ? error
          : toSvaMainserverError({
              code: 'network_error',
              message: error instanceof Error ? error.message : 'Unbekannter Mainserver-Fehler.',
            });

      logger.warn('SVA Mainserver connection check failed', {
        operation: 'connection_check',
        instance_id: input.instanceId,
        keycloak_subject: input.keycloakSubject,
        error_code: normalizedError.code,
        request_id: getWorkspaceContext().requestId,
        trace_id: getWorkspaceContext().traceId,
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

export const getSvaMainserverConnectionStatus = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getConnectionStatus(input);

export const getSvaMainserverQueryRootTypename = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getQueryRootTypename(input);

export const getSvaMainserverMutationRootTypename = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getMutationRootTypename(input);
