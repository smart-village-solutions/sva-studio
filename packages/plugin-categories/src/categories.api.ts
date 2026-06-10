import { requestMainserverJson } from '@sva/plugin-sdk';

import type { CategoriesListResponse, CategoryListItem, CategoryTableRow } from './categories.types.js';

export type { CategoriesListResponse, CategoryListItem, CategoryTableRow } from './categories.types.js';

export class CategoriesApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'CategoriesApiError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const invalidCategoriesPayload = () => new CategoriesApiError('invalid_categories_payload');

const compactString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const expectRecord = (value: unknown): Record<string, unknown> => {
  if (isRecord(value) === false) {
    throw invalidCategoriesPayload();
  }

  return value;
};

const requireCategoryField = (value: unknown): string => {
  const normalized = compactString(value);
  if (!normalized) {
    throw invalidCategoriesPayload();
  }

  return normalized;
};

const readParent = (value: unknown): CategoryListItem['parent'] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const record = expectRecord(value);
  const name = readOptionalTrimmedString(record.name);
  if (!name) {
    return undefined;
  }

  return { name };
};

const readPosition = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || Number.isFinite(value) === false) {
    throw invalidCategoriesPayload();
  }

  return value;
};

const readOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw invalidCategoriesPayload();
  }

  return value;
};

const readOptionalTrimmedString = (value: unknown): string | undefined => compactString(readOptionalString(value));

const readTagList = (value: unknown): string | undefined => {
  const tagList = readOptionalString(value);
  if (tagList === undefined) {
    return undefined;
  }

  return compactString(tagList) ?? '';
};

const buildCategoryListItem = (input: {
  readonly id: string;
  readonly name: string;
  readonly parent?: CategoryListItem['parent'];
  readonly position?: number;
  readonly tagList?: string;
}): CategoryListItem => ({
  id: input.id,
  name: input.name,
  ...(input.parent ? { parent: input.parent } : {}),
  ...(input.position !== undefined ? { position: input.position } : {}),
  ...(input.tagList !== undefined ? { tagList: input.tagList } : {}),
});

const normalizeCategoryListItem = (value: unknown): CategoryListItem => {
  const record = expectRecord(value);
  return buildCategoryListItem({
    id: requireCategoryField(record.id),
    name: requireCategoryField(record.name),
    parent: readParent(record.parent),
    position: readPosition(record.position),
    tagList: readTagList(record.tagList),
  });
};

const normalizeCategoryList = (value: unknown): readonly CategoryListItem[] | null => {
  if (Array.isArray(value) === false) {
    return null;
  }

  return value.map(normalizeCategoryListItem);
};

const splitTags = (tagList?: string): readonly string[] =>
  (tagList ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

export const flattenCategoriesForTable = (categories: readonly CategoryListItem[]): readonly CategoryTableRow[] =>
  categories.map((category) => {
    const tags = splitTags(category.tagList);

    return {
      id: category.id,
      categoryId: category.id,
      actionTargetId: category.id,
      name: category.name,
      hierarchyLabel: category.parent?.name ?? '—',
      level: 0,
      ...(category.position !== undefined ? { position: category.position } : {}),
      tags,
      tagsDisplay: tags.length > 0 ? tags.join(', ') : '—',
    };
  });

export const listCategories = async (fetchImpl?: typeof fetch): Promise<readonly CategoryListItem[]> => {
  const response = await requestMainserverJson<CategoriesListResponse, CategoriesApiError>({
    url: '/api/v1/mainserver/categories',
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
    errorFactory: (code, message) => new CategoriesApiError(code, message),
  });

  const categories = normalizeCategoryList(response.data);
  if (categories === null) {
    throw invalidCategoriesPayload();
  }

  return categories;
};
