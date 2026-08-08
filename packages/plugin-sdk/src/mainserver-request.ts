import { mergeRequestHeaders } from './http-client.js';
import { combineAbortSignals } from './mainserver-abort-signal.js';

export type MainserverErrorFactory<TError extends Error> = (
  code: string,
  message: string
) => TError;
export type MainserverActingPrincipalType = 'organization' | 'user';

export const MAINSERVER_ACTING_PRINCIPAL_HEADER = 'X-SVA-Acting-Principal-Type';
export const MAINSERVER_CONTRACT_VERSION_HEADER = 'X-SVA-Mainserver-Contract-Version';
export const MAINSERVER_CONTRACT_VERSION = '2';
export const MAINSERVER_CONTEXT_BINDING_HEADER = 'X-SVA-Context-Binding';
export const MAINSERVER_OPERATION_ID_HEADER = 'X-SVA-Operation-Id';

export type MainserverResponseMeta = Readonly<{
  url: string;
  method: string;
  status: number;
  ok: boolean;
  contentType: string | null;
  contextBinding?: string;
  durationMs: number;
}>;

type ApiErrorResponse = Readonly<{
  error?: string | Readonly<{ code?: string; message?: string }>;
  message?: string;
}>;

const DEFAULT_MAINSERVER_REQUEST_TIMEOUT_MS = 10_000;

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
  typeof value === 'object' && value !== null;

export class MainserverApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'MainserverApiError';
  }
}

const resolveFetch = (fetchOverride?: typeof fetch): typeof fetch => {
  const resolvedFetch = fetchOverride ?? globalThis.fetch?.bind(globalThis);
  if (!resolvedFetch) {
    throw new Error('mainserver_fetch_unavailable');
  }
  return resolvedFetch;
};

const createTimeoutSignal = (
  timeoutMs: number
): { readonly cancel: () => void; readonly signal: AbortSignal } => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort(new DOMException('mainserver_timeout', 'TimeoutError'));
  }, timeoutMs);

  return {
    cancel: () => {
      globalThis.clearTimeout(timeoutId);
    },
    signal: controller.signal,
  };
};

export const createMainserverJsonRequestHeaders = (headers?: HeadersInit): Headers =>
  mergeRequestHeaders(
    {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    headers
  );

export const createMainserverMutationHeaders = (
  actingPrincipalType: MainserverActingPrincipalType,
  headers?: HeadersInit,
  operationId = globalThis.crypto.randomUUID()
): Headers => {
  const result = createMainserverJsonRequestHeaders(headers);
  result.set(MAINSERVER_ACTING_PRINCIPAL_HEADER, actingPrincipalType);
  result.set(MAINSERVER_CONTRACT_VERSION_HEADER, MAINSERVER_CONTRACT_VERSION);
  result.set(MAINSERVER_OPERATION_ID_HEADER, operationId);
  return result;
};

const resolveMainserverErrorFactory = <TError extends Error>(
  errorFactory?: MainserverErrorFactory<TError>
): MainserverErrorFactory<TError | MainserverApiError> =>
  errorFactory ??
  ((code: string, errorMessage: string) => new MainserverApiError(code, errorMessage));

const createMainserverTimeoutError = <TError extends Error>(
  errorFactory?: MainserverErrorFactory<TError>
): TError | MainserverApiError =>
  resolveMainserverErrorFactory(errorFactory)('mainserver_timeout', 'mainserver_timeout');

const isMainserverTimeoutError = (error: unknown, signal?: AbortSignal): boolean =>
  (error instanceof DOMException && error.name === 'TimeoutError') ||
  Boolean(
    signal?.aborted &&
    signal.reason instanceof DOMException &&
    signal.reason.name === 'TimeoutError'
  );

const wrapMainserverTimeoutError = <TError extends Error>(
  error: unknown,
  errorFactory?: MainserverErrorFactory<TError>,
  signal?: AbortSignal
): never => {
  if (isMainserverTimeoutError(error, signal)) {
    throw createMainserverTimeoutError(errorFactory);
  }

  throw error;
};

const fetchMainserverResponse = async (input: {
  readonly url: string;
  readonly init?: RequestInit;
  readonly fetch?: typeof fetch;
  readonly signal: AbortSignal;
}): Promise<Response> =>
  resolveFetch(input.fetch)(input.url, {
    credentials: 'include',
    ...input.init,
    signal: input.signal,
    headers: mergeRequestHeaders({ Accept: 'application/json' }, input.init?.headers),
  });

const readNonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const readResponseContentType = (response: Response): string | null => {
  const headers = response.headers;
  return typeof headers?.get === 'function' ? headers.get('content-type') : null;
};

const isHtmlLikeContentType = (response: Response): boolean => {
  const contentType = readResponseContentType(response);
  if (contentType === null || contentType.length === 0) {
    return false;
  }
  const normalized = contentType.toLowerCase();
  return normalized.includes('text/html') || normalized.includes('application/xhtml+xml');
};

const readStructuredErrorDetails = (
  value: ApiErrorResponse['error']
): {
  readonly code?: string;
  readonly message?: string;
} => {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  return {
    code: readNonEmptyString(value.code),
    message: readNonEmptyString(value.message),
  };
};

const parseMainserverErrorResponse = async (
  response: Response,
  signal?: AbortSignal
): Promise<{
  readonly code: string;
  readonly message: string;
}> => {
  if (isHtmlLikeContentType(response)) {
    return {
      code: `http_${response.status}`,
      message: `http_${response.status}`,
    };
  }

  const fallback = {
    code: `http_${response.status}`,
    message: `http_${response.status}`,
  };

  try {
    const body = await response.json();
    if (!isApiErrorResponse(body)) {
      throw new Error('invalid_mainserver_error_response');
    }
    const structuredError = readStructuredErrorDetails(body.error);
    const errorCode = readNonEmptyString(body.error) ?? structuredError.code ?? fallback.code;
    const message = readNonEmptyString(body.message) ?? structuredError.message ?? errorCode;
    return {
      code: errorCode,
      message,
    };
  } catch (error) {
    if (isMainserverTimeoutError(error, signal)) {
      throw signal?.reason ?? error;
    }
    return fallback;
  }
};

const assertMainserverResponseOk = async <TError extends Error>(
  response: Response,
  errorFactory?: MainserverErrorFactory<TError>,
  signal?: AbortSignal
): Promise<void> => {
  if (response.ok) {
    return;
  }
  const { code, message } = await parseMainserverErrorResponse(response, signal);
  throw resolveMainserverErrorFactory(errorFactory)(code, message);
};

export function requestMainserverJson<T>(input: {
  readonly url: string;
  readonly init?: RequestInit;
  readonly fetch?: typeof fetch;
  readonly errorFactory?: MainserverErrorFactory<MainserverApiError>;
  readonly onResponse?: (meta: MainserverResponseMeta) => void;
  readonly timeoutMs?: number;
}): Promise<T>;
export function requestMainserverJson<T, TError extends Error>(input: {
  readonly url: string;
  readonly init?: RequestInit;
  readonly fetch?: typeof fetch;
  readonly errorFactory: MainserverErrorFactory<TError>;
  readonly onResponse?: (meta: MainserverResponseMeta) => void;
  readonly timeoutMs?: number;
}): Promise<T>;

export async function requestMainserverJson<T, TError extends Error = MainserverApiError>(input: {
  readonly url: string;
  readonly init?: RequestInit;
  readonly fetch?: typeof fetch;
  readonly errorFactory?: MainserverErrorFactory<TError>;
  readonly onResponse?: (meta: MainserverResponseMeta) => void;
  readonly timeoutMs?: number;
}): Promise<T> {
  const startedAt = Date.now();
  const timeout = createTimeoutSignal(input.timeoutMs ?? DEFAULT_MAINSERVER_REQUEST_TIMEOUT_MS);
  const combinedSignal = combineAbortSignals(
    input.init?.signal ? [input.init.signal, timeout.signal] : [timeout.signal]
  );
  try {
    try {
      const response = await fetchMainserverResponse({
        url: input.url,
        init: input.init,
        fetch: input.fetch,
        signal: combinedSignal.signal,
      });
      const contextBinding = response.headers?.get(MAINSERVER_CONTEXT_BINDING_HEADER)?.trim();
      input.onResponse?.({
        url: input.url,
        method: (input.init?.method ?? 'GET').toUpperCase(),
        status: response.status,
        ok: response.ok,
        contentType: readResponseContentType(response),
        ...(contextBinding ? { contextBinding } : {}),
        durationMs: Date.now() - startedAt,
      });
      await assertMainserverResponseOk(response, input.errorFactory, combinedSignal.signal);
      if (isHtmlLikeContentType(response)) {
        throw resolveMainserverErrorFactory(input.errorFactory)(
          'non_json_response',
          'non_json_response'
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      return wrapMainserverTimeoutError(error, input.errorFactory, combinedSignal.signal);
    }
  } finally {
    combinedSignal.cancel();
    timeout.cancel();
  }
}
