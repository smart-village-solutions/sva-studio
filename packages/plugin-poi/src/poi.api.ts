import { createMainserverCrudClient } from '@sva/plugin-sdk';

import type { PoiContentItem, PoiFormInput, PoiListQuery, PoiListResult } from './poi.types.js';

export class PoiApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'PoiApiError';
  }
}

const DEFAULT_LIST_QUERY: PoiListQuery = { page: 1, pageSize: 25 };

const poiClient = createMainserverCrudClient<PoiContentItem, PoiFormInput, PoiListResult, PoiListResult, PoiApiError>({
  basePath: '/api/v1/mainserver/poi',
  errorFactory: (code, message) => new PoiApiError(code, message),
  mapListResponse: (response, _mapItem, query) => ({
    data: response.data,
    pagination: response.pagination ?? {
      page: query.page,
      pageSize: query.pageSize,
      hasNextPage: false,
    },
  }),
});

export const listPoi = async (query: PoiListQuery = DEFAULT_LIST_QUERY): Promise<PoiListResult> => poiClient.list(query);

export const getPoi = async (contentId: string): Promise<PoiContentItem> => poiClient.get(contentId);

export const createPoi = async (input: PoiFormInput): Promise<PoiContentItem> => poiClient.create(input);

export const updatePoi = async (contentId: string, input: PoiFormInput): Promise<PoiContentItem> =>
  poiClient.update(contentId, input);

export const deletePoi = async (contentId: string): Promise<void> => poiClient.remove(contentId);
