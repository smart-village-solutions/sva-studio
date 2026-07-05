import { createMainserverCrudClient, requestMainserverJson } from '@sva/plugin-sdk';

import type {
  GenericItemContentItem,
  GenericItemCategoryOption,
  GenericItemFormInput,
  GenericItemListQuery,
  GenericItemListResult,
} from './generic-items.types.js';

export class GenericItemsApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'GenericItemsApiError';
  }
}

const genericItemsClient = createMainserverCrudClient<
  GenericItemContentItem,
  GenericItemFormInput,
  GenericItemListResult,
  GenericItemListResult,
  GenericItemsApiError
>({
  basePath: '/api/v1/mainserver/generic-items',
  errorFactory: (code: string, message?: string) => new GenericItemsApiError(code, message),
  mapListResponse: (response: GenericItemListResult) => response,
});

export const listGenericItems = async (query: GenericItemListQuery): Promise<GenericItemListResult> =>
  genericItemsClient.list(query);

export const getGenericItem = async (contentId: string): Promise<GenericItemContentItem> =>
  genericItemsClient.get(contentId);

export const createGenericItem = async (input: GenericItemFormInput): Promise<GenericItemContentItem> =>
  genericItemsClient.create(input);

export const updateGenericItem = async (
  contentId: string,
  input: GenericItemFormInput
): Promise<GenericItemContentItem> => genericItemsClient.update(contentId, input);

export const deleteGenericItem = async (contentId: string): Promise<void> =>
  genericItemsClient.remove(contentId);

export const listGenericItemCategories = async (): Promise<readonly GenericItemCategoryOption[]> => {
  const response = await requestMainserverJson<{ readonly data: readonly GenericItemCategoryOption[] }, GenericItemsApiError>({
    url: '/api/v1/mainserver/categories',
    errorFactory: (code, message) => new GenericItemsApiError(code, message),
  });
  return response.data;
};
