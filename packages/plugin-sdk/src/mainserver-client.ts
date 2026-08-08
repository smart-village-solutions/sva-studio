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

  return {
    capture,
    has: (contentId: string): boolean => contextBindings.has(contentId),
    mutationHeaders,
  };
};

const createMainserverItemLoader = <TItem, TError extends Error>(input: {
  readonly basePath: string;
  readonly fetch?: typeof fetch;
  readonly errorFactory: MainserverErrorFactory<TError>;
  readonly mapItem: (item: TItem) => TItem;
  readonly contextBindingStore: ReturnType<typeof createMainserverContextBindingStore>;
}) => {
  const loadDetail = async (contentId: string): Promise<MainserverDetailResult<TItem>> => {
    const response = await requestMainserverJson<ApiItemResponse<TItem>, TError>({
      url: `${input.basePath}/${encodeURIComponent(contentId)}`,
      fetch: input.fetch,
      errorFactory: input.errorFactory,
      onResponse: input.contextBindingStore.capture(contentId),
    });
    return {
      data: input.mapItem(response.data),
      deviations: response.meta?.deviations ?? [],
    };
  };

  return {
    loadDetail,
    loadItem: async (contentId: string): Promise<TItem> => (await loadDetail(contentId)).data,
  };
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
  const { loadDetail, loadItem } = createMainserverItemLoader({
    basePath: options.basePath,
    fetch: options.fetch,
    errorFactory: options.errorFactory,
    mapItem,
    contextBindingStore,
  });
  const ensureContextBinding = async (contentId: string): Promise<void> => {
    if (!contextBindingStore.has(contentId)) {
      await loadItem(contentId);
    }
    if (!contextBindingStore.has(contentId)) {
      throw options.errorFactory(
        'mainserver_context_binding_missing',
        'mainserver_context_binding_missing'
      );
    }
  };

  return {
    list: async (query: MainserverListQuery): Promise<TListResult> => {
      const response = await requestMainserverJson<TListResponse, TError>({
        url: buildMainserverListUrl(options.basePath, query),
        fetch: options.fetch,
        errorFactory: options.errorFactory,
      });
      return options.mapListResponse(response, mapItem);
    },
    get: loadItem,
    getDetail: loadDetail,
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
      await ensureContextBinding(contentId);
      const response = await requestMainserverJson<ApiItemResponse<TItem>, TError>({
        url: `${options.basePath}/${encodeURIComponent(contentId)}`,
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
      await ensureContextBinding(contentId);
      await requestMainserverJson<ApiItemResponse<{ readonly id: string }>, TError>({
        url: `${options.basePath}/${encodeURIComponent(contentId)}`,
        fetch: options.fetch,
        errorFactory: options.errorFactory,
        init: {
          method: 'DELETE',
          headers: contextBindingStore.mutationHeaders(contentId, actingPrincipalType),
        },
      });
    },
    ensureMutationContext: ensureContextBinding,
    mutationHeaders: contextBindingStore.mutationHeaders,
  };
};
