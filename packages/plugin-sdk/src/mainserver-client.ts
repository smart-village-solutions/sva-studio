import {
  createMainserverMutationHeaders,
  MAINSERVER_CONTEXT_BINDING_HEADER,
  MainserverApiError,
  requestMainserverJson,
  type MainserverErrorFactory,
  type MainserverActingPrincipalType,
} from './mainserver-request.js';
import type { MainserverDataDeviation, MainserverDetailResult } from './mainserver-detail.js';

export type MainserverListQuery = Readonly<{
  page: number;
  pageSize: number;
}>;
export {
  createMainserverJsonRequestHeaders,
  createMainserverMutationHeaders,
  MainserverApiError,
  requestMainserverJson,
  type MainserverErrorFactory,
  type MainserverActingPrincipalType,
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
  meta?: Readonly<{ deviations?: readonly MainserverDataDeviation[] }>;
}>;

export const buildMainserverListUrl = (basePath: string, query: MainserverListQuery): string =>
  `${basePath}?page=${encodeURIComponent(String(query.page))}&pageSize=${encodeURIComponent(String(query.pageSize))}`;

const createMainserverContextBindingStore = () => {
  const contextBindings = new Map<string, string>();
  const capture =
    (contentId: string) => (meta: { readonly ok: boolean; readonly contextBinding?: string }) => {
      if (!meta.ok) return;
      if (meta.contextBinding) {
        contextBindings.set(contentId, meta.contextBinding);
      } else {
        contextBindings.delete(contentId);
      }
    };
  const mutationHeaders = (
    contentId: string,
    actingPrincipalType: MainserverActingPrincipalType,
    headers?: HeadersInit
  ): Headers => {
    const result = createMainserverMutationHeaders(actingPrincipalType, headers);
    const contextBinding = contextBindings.get(contentId);
    if (contextBinding) {
      result.set(MAINSERVER_CONTEXT_BINDING_HEADER, contextBinding);
    }
    return result;
  };

  return { capture, mutationHeaders };
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
  const contextBindingStore = createMainserverContextBindingStore();

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
        onResponse: contextBindingStore.capture(contentId),
      });
      return mapItem(response.data);
    },
    getDetail: async (contentId: string): Promise<MainserverDetailResult<TItem>> => {
      const response = await requestMainserverJson<ApiItemResponse<TItem>, TError>({
        url: `${options.basePath}/${contentId}`,
        fetch: options.fetch,
        errorFactory: options.errorFactory,
        onResponse: contextBindingStore.capture(contentId),
      });
      return {
        data: mapItem(response.data),
        deviations: response.meta?.deviations ?? [],
      };
    },
    create: async (
      input: TMutationInput,
      actingPrincipalType: MainserverActingPrincipalType
    ): Promise<TItem> => {
      const response = await requestMainserverJson<ApiItemResponse<TItem>, TError>({
        url: options.basePath,
        fetch: options.fetch,
        errorFactory: options.errorFactory,
        init: {
          method: 'POST',
          headers: createMainserverMutationHeaders(actingPrincipalType, options.createHeaders?.()),
          body: JSON.stringify(options.createBody ? options.createBody(input) : input),
        },
      });
      return mapItem(response.data);
    },
    update: async (
      contentId: string,
      input: TMutationInput,
      actingPrincipalType: MainserverActingPrincipalType
    ): Promise<TItem> => {
      const response = await requestMainserverJson<ApiItemResponse<TItem>, TError>({
        url: `${options.basePath}/${contentId}`,
        fetch: options.fetch,
        errorFactory: options.errorFactory,
        init: {
          method: 'PATCH',
          headers: contextBindingStore.mutationHeaders(
            contentId,
            actingPrincipalType,
            options.updateHeaders?.()
          ),
          body: JSON.stringify(options.updateBody ? options.updateBody(input) : input),
        },
      });
      return mapItem(response.data);
    },
    remove: async (
      contentId: string,
      actingPrincipalType: MainserverActingPrincipalType
    ): Promise<void> => {
      await requestMainserverJson<ApiItemResponse<{ readonly id: string }>, TError>({
        url: `${options.basePath}/${contentId}`,
        fetch: options.fetch,
        errorFactory: options.errorFactory,
        init: {
          method: 'DELETE',
          headers: contextBindingStore.mutationHeaders(contentId, actingPrincipalType),
        },
      });
    },
    mutationHeaders: contextBindingStore.mutationHeaders,
  };
};
