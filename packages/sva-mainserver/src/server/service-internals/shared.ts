import { randomUUID } from 'node:crypto';
import type {
  SvaMainserverConnectionInput,
  SvaMainserverErrorCode,
  SvaMainserverInstanceConfig,
  SvaMainserverListQuery,
  SvaMainserverListResult,
} from '../../types.js';
import { z } from 'zod';

import { SvaMainserverError } from '../errors.js';

type GraphqlResponse<TResult> = {
  readonly data?: TResult;
  readonly errors?: readonly {
    readonly message?: string;
  }[];
};

export type CredentialValue = {
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly credentialSource?: 'organization' | 'user';
  readonly credentialOrganizationId?: string;
  readonly credentialFingerprint?: string;
};

export type ServiceHop = 'db' | 'keycloak' | 'oauth2' | 'graphql' | 'identity';

export type UpstreamRequestInput = {
  readonly url: string;
  readonly init: RequestInit;
  readonly input: SvaMainserverConnectionInput;
  readonly operationName: string;
  readonly hop: Extract<ServiceHop, 'oauth2' | 'graphql' | 'identity'>;
  readonly allowRetry?: boolean;
};

export type GraphqlOperationInput = SvaMainserverConnectionInput & {
  readonly document: string;
  readonly operationName: string;
  readonly variables?: Record<string, unknown>;
  readonly allowRetry?: boolean;
};

export type GraphqlExecutor = <TResult>(
  input: GraphqlOperationInput,
  config: SvaMainserverInstanceConfig
) => Promise<TResult>;

export type SvaMainserverListInput = SvaMainserverConnectionInput & SvaMainserverListQuery;

export const DEFAULT_CREDENTIAL_CACHE_TTL_MS = 60_000;
export const DEFAULT_TOKEN_SKEW_MS = 60_000;
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;
export const DEFAULT_CACHE_MAX_SIZE = 256;
export const DEFAULT_RETRY_BASE_DELAY_MS = 150;
export const RETRYABLE_STATUS_CODES = new Set([503]);
export const MAX_MAINSERVER_PAGE_SIZE = 100;
export const ALLOWED_MAINSERVER_PAGE_SIZES = new Set([25, 50, 100]);
export const MAX_MAINSERVER_UPSTREAM_SCAN_RECORDS = 10_000;

const graphqlResponseSchema = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

export const toSvaMainserverError = (input: {
  code: SvaMainserverErrorCode;
  message: string;
  statusCode?: number;
}): SvaMainserverError => new SvaMainserverError(input);

export const isAbortErrorLike = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'AbortError' || error.name === 'TimeoutError';
};

export const normalizeUnexpectedError = (error: unknown): SvaMainserverError => {
  if (error instanceof SvaMainserverError) {
    return error;
  }

  return toSvaMainserverError({
    code: 'network_error',
    message: error instanceof Error ? error.message : 'Unbekannter Mainserver-Fehler.',
    statusCode: 503,
  });
};

export const parseJsonBody = async (response: Response): Promise<unknown> => {
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

export const shouldRetryError = (error: unknown): boolean =>
  isAbortErrorLike(error) || (error instanceof Error && error.name === 'TypeError');

export const resolveNetworkErrorMessage = (input: {
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

export const resolveTokenStatusErrorCode = (status: number): SvaMainserverErrorCode => {
  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 403) {
    return 'forbidden';
  }
  return 'token_request_failed';
};

export const resolveGraphqlStatusErrorCode = (status: number): SvaMainserverErrorCode => {
  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 403) {
    return 'forbidden';
  }
  return 'network_error';
};

export const assertUpstreamScanLimit = (skip: number) => {
  if (skip > MAX_MAINSERVER_UPSTREAM_SCAN_RECORDS) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message:
        'Mainserver-Pagination erfordert zu viele Upstream-Datensätze für sichtbare Ergebnisse.',
      statusCode: 502,
    });
  }
};

export const normalizeVisibleListQuery = (
  input: SvaMainserverListQuery
): SvaMainserverListQuery => {
  const requestedPageSize = Math.trunc(input.pageSize);
  const pageSize = ALLOWED_MAINSERVER_PAGE_SIZES.has(requestedPageSize) ? requestedPageSize : 25;
  const maxPage = Math.floor((MAX_MAINSERVER_UPSTREAM_SCAN_RECORDS - 1) / pageSize) + 1;
  return {
    page: Math.min(Math.max(1, Math.trunc(input.page)), maxPage),
    pageSize,
  };
};

export const parseGraphqlPayload = <TResult>(payload: unknown): TResult => {
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
    const errorMessages = result.errors
      .map((error) => error.message?.trim())
      .filter((message): message is string => Boolean(message));
    throw toSvaMainserverError({
      code: 'graphql_error',
      message:
        errorMessages.length > 0
          ? `GraphQL-Antwort des SVA-Mainservers enthielt ${result.errors.length} Fehler: ${errorMessages.join(' | ')}`
          : `GraphQL-Antwort des SVA-Mainservers enthielt ${result.errors.length} Fehler.`,
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

export const assertPublishedAt = (publishedAt: string): void => {
  if (publishedAt.trim().length === 0) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Veröffentlichungsdatum ist für Mainserver-News erforderlich.',
      statusCode: 400,
    });
  }
};

// The deployed Mainserver omits some relations from its unchanged comparison.
// Keep its payload comparable changing until upstream forceCreate is fixed (#442).
export const withUpdatedPayload = (
  payload: unknown,
  previousPayload: unknown
): Record<string, unknown> | undefined => {
  let storedPayload = previousPayload;
  if (typeof storedPayload === 'string') {
    try {
      storedPayload = JSON.parse(storedPayload) as unknown;
    } catch {
      // Preserve the old omit behavior for unparseable stored payloads.
    }
  }
  const parsed = z
    .record(z.string(), z.unknown())
    .safeParse((payload === undefined ? storedPayload : payload) ?? {});
  if (!parsed.success) {
    if (payload === undefined) return undefined;
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Mainserver-Payload muss für Updates ein JSON-Objekt sein.',
      statusCode: 400,
    });
  }
  const previous = z.record(z.string(), z.unknown()).safeParse(storedPayload);
  const previousTimestamp =
    previous.success && typeof previous.data.studioUpdatedAt === 'string'
      ? Date.parse(previous.data.studioUpdatedAt)
      : Number.NaN;
  const updatedAt = Number.isFinite(previousTimestamp)
    ? Math.max(Date.now(), previousTimestamp + 1)
    : Date.now();
  return {
    ...parsed.data,
    studioUpdatedAt: new Date(updatedAt).toISOString(),
    // Stale detail reads can repeat the timestamp, including across Studio processes.
    studioUpdateId: randomUUID(),
  };
};

export const defined = <TValue>(value: TValue | null | undefined): value is TValue =>
  value !== null && value !== undefined;

export const optionalString = (value: string | null | undefined): string | undefined =>
  value && value.length > 0 ? value : undefined;

export const optionalNumber = (value: number | null | undefined): number | undefined =>
  defined(value) ? value : undefined;

export const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const unwrapSettledResult = <TValue>(
  result: PromiseSettledResult<TValue>
): { ok: true; value: TValue } | { ok: false; error: SvaMainserverError } =>
  result.status === 'fulfilled'
    ? { ok: true, value: result.value }
    : { ok: false, error: normalizeUnexpectedError(result.reason) };

export const toListResult = <TItem>(
  input: SvaMainserverListInput,
  data: readonly TItem[],
  hasNextPage: boolean
): SvaMainserverListResult<TItem> => ({
  data,
  pagination: {
    page: input.page,
    pageSize: input.pageSize,
    hasNextPage,
  },
});
