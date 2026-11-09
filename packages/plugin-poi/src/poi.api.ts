import {
  createMainserverCrudClient,
  requestMainserverJson,
  translatePluginKey,
} from '@sva/plugin-sdk';
import type { MainserverActingPrincipalType, MainserverMutationOptions } from '@sva/plugin-sdk';

import type {
  PoiCategoryOption,
  PoiContentItem,
  PoiFormInput,
  PoiListQuery,
  PoiListResult,
} from './poi.types.js';

export class PoiApiError extends Error {
  declare readonly details?: unknown;
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(
      code.startsWith('voucher_')
        ? translatePluginKey('poi', 'messages.voucherOperationUnavailable')
        : code === 'poi_editor_reload_required'
          ? translatePluginKey('poi', 'messages.editorReloadRequired')
          : code === 'invalid_response' && message === 'poi_lunch_snapshot_incomplete'
            ? translatePluginKey('poi', 'messages.lunchesUnavailable')
            : message
    );
    this.name = 'PoiApiError';
  }
}

export const readPoiVisibilityFailureContentId = (error: unknown): string | undefined => {
  const providerError = error instanceof Error && 'cause' in error ? error.cause : error;
  if (!(providerError instanceof PoiApiError) || providerError.code !== 'poi_visibility_failed') return;
  const details = providerError.details;
  if (typeof details === 'object' && details !== null && 'contentId' in details &&
    typeof details.contentId === 'string' && details.contentId.trim()) return details.contentId;
  return undefined;
};

const poiClient = createMainserverCrudClient<
  PoiContentItem,
  PoiFormInput,
  PoiListResult,
  PoiListResult,
  PoiApiError
>({
  basePath: '/api/v1/mainserver/poi',
  errorFactory: (code, message) => new PoiApiError(code, message),
  mapListResponse: (response) => response,
});

export const listPoi = async (query: PoiListQuery): Promise<PoiListResult> => poiClient.list(query);

export const getPoi = async (contentId: string): Promise<PoiContentItem> =>
  poiClient.get(contentId);
export const getPoiDetail = async (
  contentId: string,
  actingPrincipalType?: MainserverActingPrincipalType
) => poiClient.getDetail(contentId, actingPrincipalType);

export const createPoi = async (
  input: PoiFormInput,
  actingPrincipalType: MainserverActingPrincipalType,
  mutationOptions?: MainserverMutationOptions
): Promise<PoiContentItem> =>
  mutationOptions
    ? poiClient.create(input, actingPrincipalType, mutationOptions)
    : poiClient.create(input, actingPrincipalType);

export const updatePoi = async (
  contentId: string,
  input: PoiFormInput,
  actingPrincipalType: MainserverActingPrincipalType,
  mutationOptions?: MainserverMutationOptions
): Promise<PoiContentItem> =>
  poiClient.update(contentId, input, actingPrincipalType, mutationOptions);

export const deletePoi = async (
  contentId: string,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<void> => poiClient.remove(contentId, actingPrincipalType);

export const listPoiCategories = async (): Promise<readonly PoiCategoryOption[]> => {
  const response = await requestMainserverJson<
    { readonly data: readonly PoiCategoryOption[] },
    PoiApiError
  >({
    url: '/api/v1/mainserver/categories?dataType=point_of_interest',
    errorFactory: (code, message) => new PoiApiError(code, message),
  });

  return response.data;
};

export const setPoiVisibility = async (
  contentId: string,
  visible: boolean,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<void> => {
  await poiClient.ensureMutationContext(contentId, actingPrincipalType);
  await requestMainserverJson<{ readonly data: PoiContentItem }, PoiApiError>({
    url: `/api/v1/mainserver/poi/${encodeURIComponent(contentId)}`,
    errorFactory: (code, message) => new PoiApiError(code, message),
    init: {
      method: 'PATCH',
      body: JSON.stringify({ visible }),
      headers: poiClient.mutationHeaders(contentId, actingPrincipalType),
    },
  });
};
