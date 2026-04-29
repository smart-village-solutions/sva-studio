export type MainserverListQuery = Readonly<{
  page: number;
  pageSize: number;
}>;

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
  error?: string;
  message?: string;
}>;

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

export const createMainserverJsonRequestHeaders = (headers?: HeadersInit): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  ...(headers ?? {}),
});

export const buildMainserverListUrl = (basePath: string, query: MainserverListQuery): string =>
  `${basePath}?page=${encodeURIComponent(String(query.page))}&pageSize=${encodeURIComponent(String(query.pageSize))}`;

export const requestMainserverJson = async <T, TError extends Error = MainserverApiError>(input: {
  readonly url: string;
  readonly init?: RequestInit;
  readonly fetch?: typeof fetch;
  readonly errorFactory?: MainserverErrorFactory<TError>;
}): Promise<T> => {
  const response = await resolveFetch(input.fetch)(input.url, {
    credentials: 'include',
    ...input.init,
    headers: {
      Accept: 'application/json',
      ...(input.init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorCode = `http_${response.status}`;
    let message = errorCode;

    try {
      const body = (await response.json()) as ApiErrorResponse;
      errorCode = typeof body.error === 'string' && body.error.length > 0 ? body.error : errorCode;
      message = typeof body.message === 'string' && body.message.length > 0 ? body.message : errorCode;
    } catch {
      // Keep the deterministic HTTP fallback when the server returns no JSON error envelope.
    }

    const errorFactory =
      input.errorFactory ??
      ((code: string, errorMessage: string) => new MainserverApiError(code, errorMessage) as unknown as TError);
    throw errorFactory(errorCode, message);
  }

  return (await response.json()) as T;
};

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
