import { createMainserverJsonRequestHeaders, requestMainserverJson } from '@sva/plugin-sdk';

import {
  CategoriesApiError,
  flattenCategoriesForTable,
  flattenCategoryManagementForTable,
  normalizeCategoryList,
  normalizeDeleteResponse,
  normalizeManagementCategory,
  normalizeSaveResponse,
} from './categories.normalization.js';
import type {
  CategoriesListResponse,
  CategoryDeleteResponse,
  CategoryListItem,
  CategoryManagementItem,
  CategoryManagementResponse,
  CategorySaveInput,
  CategorySaveResponse,
} from './categories.types.js';

export { CategoriesApiError, flattenCategoriesForTable, flattenCategoryManagementForTable };
export type {
  CategoriesListResponse,
  CategoryListItem,
  CategoryTableRow,
} from './categories.types.js';
export type { CategoryManagementItem, CategoryManagementResponse } from './categories.types.js';

export const listCategories = async (
  fetchImpl?: typeof fetch
): Promise<readonly CategoryListItem[]> => {
  const response = await requestMainserverJson<CategoriesListResponse, CategoriesApiError>({
    url: '/api/v1/mainserver/categories',
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
    errorFactory: (code, message) => new CategoriesApiError(code, message),
  });
  return normalizeCategoryList(response.data);
};

export const listCategoryManagement = async (
  fetchImpl?: typeof fetch
): Promise<readonly CategoryManagementItem[]> => {
  const response = await requestMainserverJson<CategoryManagementResponse, CategoriesApiError>({
    url: '/api/v1/mainserver/categories?view=management',
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
    errorFactory: (code, message) => new CategoriesApiError(code, message),
  });
  if (!Array.isArray(response.data)) throw new CategoriesApiError('invalid_categories_payload');
  return response.data.map(normalizeManagementCategory);
};

export const saveCategory = async (input: {
  readonly category: CategorySaveInput;
  readonly id?: string;
  readonly idempotencyKey?: string;
  readonly fetch?: typeof fetch;
}): Promise<CategorySaveResponse> => {
  const response = await requestMainserverJson<unknown, CategoriesApiError>({
    url: input.id
      ? `/api/v1/mainserver/categories/${encodeURIComponent(input.id)}`
      : '/api/v1/mainserver/categories',
    init: {
      method: input.id ? 'PUT' : 'POST',
      headers: createMainserverJsonRequestHeaders({
        ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
      }),
      body: JSON.stringify(input.category),
    },
    ...(input.fetch ? { fetch: input.fetch } : {}),
    errorFactory: (code, message) => new CategoriesApiError(code, message),
  });
  return normalizeSaveResponse(response);
};

export const deleteCategory = async (
  id: string,
  fetchImpl?: typeof fetch
): Promise<CategoryDeleteResponse> => {
  const response = await requestMainserverJson<unknown, CategoriesApiError>({
    url: `/api/v1/mainserver/categories/${encodeURIComponent(id)}`,
    init: { method: 'DELETE', headers: createMainserverJsonRequestHeaders() },
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
    errorFactory: (code, message) => new CategoriesApiError(code, message),
  });
  return normalizeDeleteResponse(response);
};
