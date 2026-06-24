import {
  createMainserverJsonRequestHeaders,
  MainserverApiError,
  requestMainserverJson,
  type MainserverErrorFactory,
} from './mainserver-request.js';

export type MainserverListQuery = Readonly<{
  page: number;
  pageSize: number;
}>;
export {
  createMainserverJsonRequestHeaders,
  MainserverApiError,
  requestMainserverJson,
  type MainserverErrorFactory,
} from './mainserver-request.js';
export type { MainserverResponseMeta } from './mainserver-request.js';

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

export const buildMainserverListUrl = (basePath: string, query: MainserverListQuery): string =>
  `${basePath}?page=${encodeURIComponent(String(query.page))}&pageSize=${encodeURIComponent(String(query.pageSize))}`;

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
