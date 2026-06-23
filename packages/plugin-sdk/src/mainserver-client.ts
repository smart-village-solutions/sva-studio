import { mergeRequestHeaders } from './http-client.js';

export type MainserverListQuery = Readonly<{
  page: number;
  pageSize: number;
}>;

const DEFAULT_MAINSERVER_REQUEST_TIMEOUT_MS = 10_000;

export type MainserverErrorFactory<TError extends Error> = (code: string, message: string) => TError;

export type MainserverCrudClientOptions<
  TItem,
  TMutationInput,
  TListResponse extends { readonly data: readonly TItem[] },
  TListResult,
  TError extends Error,
> = Readonly<{
  basePath: string;
  errorFactory: MainserverErrorFactory<TError>;
  fetch?: typeof fetch;
  mapItem?: (item: TItem) => TItem;
  mapListResponse: (response: TListResponse, mapItem: (item: TItem) => TItem) => TListResult;
  createBody?: (input: TMutationInput) => unknown;
  updateBody?: (input: TMutationInput) => unknown;
  createHeaders?: () => HeadersInit;
  updateHeaders?: () => HeadersInit;
}>;

type ApiItemResponse<T> = Readonly<{
  data: T;
}>;

type ApiErrorResponse = Readonly<{
  error?: string | Readonly<{ code?: string; message?: string }>;
  message?: string;
}>;

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

const createTimeoutSignal = (timeoutMs: number): {
  readonly cancel: () => void;
  readonly signal: AbortSignal;
} => {
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

export const buildMainserverListUrl = (basePath: string, query: MainserverListQuery): string =>
  `${basePath}?page=${encodeURIComponent(String(query.page))}&pageSize=${encodeURIComponent(String(query.pageSize))}`;

const resolveMainserverErrorFactory = <TError extends Error>(
  errorFactory?: MainserverErrorFactory<TError>
): MainserverErrorFactory<TError | MainserverApiError> =>
  errorFactory ?? ((code: string, errorMessage: string) => new MainserverApiError(code, errorMessage));

const createMainserverTimeoutError = <TError extends Error>(
  errorFactory?: MainserverErrorFactory<TError>
): TError | MainserverApiError => resolveMainserverErrorFactory(errorFactory)('mainserver_timeout', 'mainserver_timeout');

const isMainserverTimeoutError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'TimeoutError';

const wrapMainserverTimeoutError = <TError extends Error>(
  error: unknown,
  errorFactory?: MainserverErrorFactory<TError>
): never => {
  if (isMainserverTimeoutError(error)) {
    throw createMainserverTimeoutError(errorFactory);
  }

  throw error;
};

const combineAbortSignals = (signals: readonly AbortSignal[]): {
  readonly cancel: () => void;
  readonly signal: AbortSignal;
} => {
  if (signals.length === 1) {
    return {
      cancel: () => undefined,
      signal: signals[0]!,
    };
  }

  if (typeof AbortSignal.any === 'function') {
    return {
      cancel: () => undefined,
      signal: AbortSignal.any([...signals]),
    };
  }

  const controller = new AbortController();
  const listeners = new Map<AbortSignal, () => void>();

  const abortFrom = (signal: AbortSignal) => {
    controller.abort(signal.reason);
  };

  for (const signal of signals) {
    if (signal.aborted) {
      abortFrom(signal);
      return {
        cancel: () => undefined,
        signal: controller.signal,
      };
    }

    const handleAbort = () => {
      abortFrom(signal);
    };
    listeners.set(signal, handleAbort);
    signal.addEventListener('abort', handleAbort, { once: true });
  }

  return {
    cancel: () => {
      for (const [signal, handleAbort] of listeners.entries()) {
        signal.removeEventListener('abort', handleAbort);
      }
      listeners.clear();
    },
    signal: controller.signal,
  };
};

const fetchMainserverResponse = async <TError extends Error>(input: {
  readonly url: string;
  readonly init?: RequestInit;
  readonly fetch?: typeof fetch;
  readonly errorFactory?: MainserverErrorFactory<TError>;
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

const readStructuredErrorDetails = (value: ApiErrorResponse['error']): {
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

const parseMainserverErrorResponse = async (response: Response): Promise<{
  readonly code: string;
  readonly message: string;
}> => {
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
  } catch {
    return fallback;
  }
};

const assertMainserverResponseOk = async <TError extends Error>(
  response: Response,
  errorFactory?: MainserverErrorFactory<TError>
): Promise<void> => {
  if (response.ok) {
    return;
  }
  const { code, message } = await parseMainserverErrorResponse(response);
  throw resolveMainserverErrorFactory(errorFactory)(code, message);
};

export function requestMainserverJson<T>(input: {
  readonly url: string;
  readonly init?: RequestInit;
  readonly fetch?: typeof fetch;
  readonly errorFactory?: MainserverErrorFactory<MainserverApiError>;
  readonly timeoutMs?: number;
}): Promise<T>;
export function requestMainserverJson<T, TError extends Error>(input: {
  readonly url: string;
  readonly init?: RequestInit;
  readonly fetch?: typeof fetch;
  readonly errorFactory: MainserverErrorFactory<TError>;
  readonly timeoutMs?: number;
}): Promise<T>;

export async function requestMainserverJson<T, TError extends Error = MainserverApiError>(input: {
  readonly url: string;
  readonly init?: RequestInit;
  readonly fetch?: typeof fetch;
  readonly errorFactory?: MainserverErrorFactory<TError>;
  readonly timeoutMs?: number;
}): Promise<T> {
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
        errorFactory: input.errorFactory,
        signal: combinedSignal.signal,
      });
      await assertMainserverResponseOk(response, input.errorFactory);
      return (await response.json()) as T;
    } catch (error) {
      return wrapMainserverTimeoutError(error, input.errorFactory);
    }
  } finally {
    combinedSignal.cancel();
    timeout.cancel();
  }
}

export const createMainserverCrudClient = <
  TItem,
  TMutationInput,
  TListResponse extends { readonly data: readonly TItem[] },
  TListResult,
  TError extends Error = MainserverApiError,
>(
  options: MainserverCrudClientOptions<TItem, TMutationInput, TListResponse, TListResult, TError>
) => {
  const mapItem = options.mapItem ?? ((item: TItem) => item);

  return {
    list: async (query: MainserverListQuery): Promise<TListResult> => {
      const response = await requestMainserverJson<TListResponse, TError>({
        url: buildMainserverListUrl(options.basePath, query),
        fetch: options.fetch,
        errorFactory: options.errorFactory,
      });
      return options.mapListResponse(response, mapItem);
    },
    get: async (contentId: string): Promise<TItem> => {
      const response = await requestMainserverJson<ApiItemResponse<TItem>, TError>({
        url: `${options.basePath}/${contentId}`,
        fetch: options.fetch,
        errorFactory: options.errorFactory,
      });
      return mapItem(response.data);
    },
    create: async (input: TMutationInput): Promise<TItem> => {
      const response = await requestMainserverJson<ApiItemResponse<TItem>, TError>({
        url: options.basePath,
        fetch: options.fetch,
        errorFactory: options.errorFactory,
        init: {
          method: 'POST',
          headers: options.createHeaders?.() ?? createMainserverJsonRequestHeaders(),
          body: JSON.stringify(options.createBody ? options.createBody(input) : input),
        },
      });
      return mapItem(response.data);
    },
    update: async (contentId: string, input: TMutationInput): Promise<TItem> => {
      const response = await requestMainserverJson<ApiItemResponse<TItem>, TError>({
        url: `${options.basePath}/${contentId}`,
        fetch: options.fetch,
        errorFactory: options.errorFactory,
        init: {
          method: 'PATCH',
          headers: options.updateHeaders?.() ?? createMainserverJsonRequestHeaders(),
          body: JSON.stringify(options.updateBody ? options.updateBody(input) : input),
        },
      });
      return mapItem(response.data);
    },
    remove: async (contentId: string): Promise<void> => {
      await requestMainserverJson<ApiItemResponse<{ readonly id: string }>, TError>({
        url: `${options.basePath}/${contentId}`,
        fetch: options.fetch,
        errorFactory: options.errorFactory,
        init: {
          method: 'DELETE',
          headers: createMainserverJsonRequestHeaders(),
        },
      });
    },
  };
};
