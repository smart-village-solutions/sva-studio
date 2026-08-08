import { createMainserverCrudClient, requestMainserverJson } from '@sva/plugin-sdk';
import type { MainserverActingPrincipalType } from '@sva/plugin-sdk';

import type {
  PoiCategoryOption,
  PoiContentItem,
  PoiFormInput,
  PoiListQuery,
  PoiListResult,
} from './poi.types.js';

export class PoiApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'PoiApiError';
  }
}

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
export const getPoiDetail = async (contentId: string) => poiClient.getDetail(contentId);

export const createPoi = async (
  input: PoiFormInput,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<PoiContentItem> => poiClient.create(input, actingPrincipalType);

export const updatePoi = async (
  contentId: string,
  input: PoiFormInput,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<PoiContentItem> => poiClient.update(contentId, input, actingPrincipalType);

export const deletePoi = async (
  contentId: string,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<void> => poiClient.remove(contentId, actingPrincipalType);

export const listPoiCategories = async (): Promise<readonly PoiCategoryOption[]> => {
  const response = await requestMainserverJson<
    { readonly data: readonly PoiCategoryOption[] },
    PoiApiError
  >({
    url: '/api/v1/mainserver/categories',
    errorFactory: (code, message) => new PoiApiError(code, message),
  });

  return response.data;
};
