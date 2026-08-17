import {
  createMainserverMutationHeaders,
  createMainserverReadHeaders,
  CONTENT_MEDIA_SAVE_OPERATION_ID_HEADER,
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
export type MainserverMutationOptions = Readonly<{
  operationId?: string;
  contentMediaSaveOperationId?: string;
}>;

const addContentMediaSaveOperationHeader = (
  headers: Headers,
  mutationOptions?: MainserverMutationOptions
): Headers => {
  if (mutationOptions?.contentMediaSaveOperationId) {
    headers.set(
      CONTENT_MEDIA_SAVE_OPERATION_ID_HEADER,
      mutationOptions.contentMediaSaveOperationId
    );
  }
  return headers;
};
export {
  createMainserverJsonRequestHeaders,
  createMainserverMutationHeaders,
  createMainserverReadHeaders,
  CONTENT_MEDIA_SAVE_OPERATION_ID_HEADER,
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
  meta?: Readonly<{
    access?: Readonly<Record<string, boolean>>;
    deviations?: readonly MainserverDataDeviation[];
  }>;
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
    headers?: HeadersInit,
    operationId?: string
  ): Headers => {
    const result = createMainserverMutationHeaders(actingPrincipalType, headers, operationId);
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
  const loadDetail = async (
    contentId: string,
    actingPrincipalType?: MainserverActingPrincipalType
  ): Promise<MainserverDetailResult<TItem>> => {
    const response = await requestMainserverJson<ApiItemResponse<TItem>, TError>({
      url: `${input.basePath}/${encodeURIComponent(contentId)}`,
      fetch: input.fetch,
      errorFactory: input.errorFactory,
      ...(actingPrincipalType
        ? { init: { headers: createMainserverReadHeaders(actingPrincipalType) } }
        : {}),
      onResponse: input.contextBindingStore.capture(contentId),
    });
    return {
      data: input.mapItem(response.data),
      deviations: response.meta?.deviations ?? [],
      access: response.meta?.access ?? {},
    };
  };

  return {
    loadDetail,
    loadItem: async (
      contentId: string,
      actingPrincipalType?: MainserverActingPrincipalType
    ): Promise<TItem> => (await loadDetail(contentId, actingPrincipalType)).data,
  };
};

const createEnsureMainserverContextBinding =
  <TItem, TError extends Error>(input: {
    readonly contextBindingStore: ReturnType<typeof createMainserverContextBindingStore>;
    readonly loadItem: (
      contentId: string,
      actingPrincipalType?: MainserverActingPrincipalType
    ) => Promise<TItem>;
    readonly errorFactory: MainserverErrorFactory<TError>;
  }) =>
  async (contentId: string, actingPrincipalType: MainserverActingPrincipalType): Promise<void> => {
    if (!input.contextBindingStore.has(contentId))
      await input.loadItem(contentId, actingPrincipalType);
    if (!input.contextBindingStore.has(contentId)) {
      throw input.errorFactory(
        'mainserver_context_binding_missing',
        'mainserver_context_binding_missing'
      );
    }
  };

const createMainserverCrudMutations = <TItem, TMutationInput, TListResponse extends {
  readonly data: readonly TItem[];
}, TListResult, TError extends Error>(input: {
  readonly options: MainserverCrudClientOptions<TItem, TMutationInput, TListResponse, TListResult, TError>;
  readonly mapItem: (item: TItem) => TItem;
  readonly contextBindingStore: ReturnType<typeof createMainserverContextBindingStore>;
  readonly ensureContextBinding: (contentId: string, actingPrincipalType: MainserverActingPrincipalType) => Promise<void>;
}) => ({
  create: async (
    mutationInput: TMutationInput,
    actingPrincipalType: MainserverActingPrincipalType,
    mutationOptions?: MainserverMutationOptions
  ): Promise<TItem> => {
    const response = await requestMainserverJson<ApiItemResponse<TItem>, TError>({
      url: input.options.basePath,
      fetch: input.options.fetch,
      errorFactory: input.options.errorFactory,
      init: {
        method: 'POST',
        headers: addContentMediaSaveOperationHeader(
          createMainserverMutationHeaders(
            actingPrincipalType,
            input.options.createHeaders?.(),
            mutationOptions?.operationId
          ),
          mutationOptions
        ),
        body: JSON.stringify(input.options.createBody ? input.options.createBody(mutationInput) : mutationInput),
      },
    });
    return input.mapItem(response.data);
  },
  update: async (
    contentId: string,
    mutationInput: TMutationInput,
    actingPrincipalType: MainserverActingPrincipalType,
    mutationOptions?: MainserverMutationOptions
  ): Promise<TItem> => {
    await input.ensureContextBinding(contentId, actingPrincipalType);
    const response = await requestMainserverJson<ApiItemResponse<TItem>, TError>({
      url: `${input.options.basePath}/${encodeURIComponent(contentId)}`,
      fetch: input.options.fetch,
      errorFactory: input.options.errorFactory,
      init: {
        method: 'PATCH',
        headers: addContentMediaSaveOperationHeader(
          input.contextBindingStore.mutationHeaders(
            contentId,
            actingPrincipalType,
            input.options.updateHeaders?.(),
            mutationOptions?.operationId
          ),
          mutationOptions
        ),
        body: JSON.stringify(input.options.updateBody ? input.options.updateBody(mutationInput) : mutationInput),
      },
    });
    return input.mapItem(response.data);
  },
  remove: async (contentId: string, actingPrincipalType: MainserverActingPrincipalType): Promise<void> => {
    await input.ensureContextBinding(contentId, actingPrincipalType);
    await requestMainserverJson<ApiItemResponse<{ readonly id: string }>, TError>({
      url: `${input.options.basePath}/${encodeURIComponent(contentId)}`,
      fetch: input.options.fetch,
      errorFactory: input.options.errorFactory,
      init: {
        method: 'DELETE',
        headers: input.contextBindingStore.mutationHeaders(contentId, actingPrincipalType),
      },
    });
  },
});

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
  const ensureContextBinding = createEnsureMainserverContextBinding({
    contextBindingStore,
    loadItem,
    errorFactory: options.errorFactory,
  });

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
    ...createMainserverCrudMutations({ options, mapItem, contextBindingStore, ensureContextBinding }),
    ensureMutationContext: ensureContextBinding,
    mutationHeaders: contextBindingStore.mutationHeaders,
  };
};
