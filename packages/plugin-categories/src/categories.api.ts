import { requestMainserverJson } from '@sva/plugin-sdk';

import type {
  CategoriesListResponse,
  CategoryDeleteResponse,
  CategoryListItem,
  CategoryManagementItem,
  CategoryManagementResponse,
  CategoryMutationError,
  CategorySaveInput,
  CategorySaveResponse,
  CategoryTableRow,
  CategoryUsage,
} from './categories.types.js';

export type {
  CategoriesListResponse,
  CategoryListItem,
  CategoryTableRow,
} from './categories.types.js';
export type { CategoryManagementItem, CategoryManagementResponse } from './categories.types.js';

export class CategoriesApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'CategoriesApiError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
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

const readOptionalTrimmedString = (value: unknown): string | undefined =>
  compactString(readOptionalString(value));

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

export const flattenCategoriesForTable = (
  categories: readonly CategoryListItem[]
): readonly CategoryTableRow[] =>
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

export const listCategories = async (
  fetchImpl?: typeof fetch
): Promise<readonly CategoryListItem[]> => {
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

const normalizeManagementCategory = (value: unknown): CategoryManagementItem => {
  const record = expectRecord(value);
  const id = requireCategoryField(record.id);
  const name = requireCategoryField(record.name);
  if (
    typeof record.active !== 'boolean' ||
    !Array.isArray(record.children) ||
    !Array.isArray(record.dataTypes)
  )
    throw invalidCategoriesPayload();
  const parent =
    record.parent === undefined || record.parent === null
      ? undefined
      : (() => {
          const raw = expectRecord(record.parent);
          return { id: requireCategoryField(raw.id), name: requireCategoryField(raw.name) };
        })();
  const children = record.children.map((child) => ({
    id: requireCategoryField(expectRecord(child).id),
  }));
  const dataTypes = record.dataTypes.map(requireCategoryField);
  const position = readPosition(record.position);
  const iconName = readOptionalTrimmedString(record.iconName);
  const email = readOptionalTrimmedString(record.email);
  return {
    id,
    name,
    active: record.active,
    children,
    dataTypes,
    ...(parent ? { parent } : {}),
    ...(position !== undefined ? { position } : {}),
    ...(iconName ? { iconName } : {}),
    ...(email ? { email } : {}),
  };
};

export const listCategoryManagement = async (
  fetchImpl?: typeof fetch
): Promise<readonly CategoryManagementItem[]> => {
  const response = await requestMainserverJson<CategoryManagementResponse, CategoriesApiError>({
    url: '/api/v1/mainserver/categories?view=management',
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
    errorFactory: (code, message) => new CategoriesApiError(code, message),
  });
  if (!Array.isArray(response.data)) throw invalidCategoriesPayload();
  return response.data.map(normalizeManagementCategory);
};

const normalizeMutationErrors = (value: unknown): readonly CategoryMutationError[] => {
  if (!Array.isArray(value)) throw invalidCategoriesPayload();
  return value.map((entry) => {
    const record = expectRecord(entry);
    const code = requireCategoryField(record.code);
    const message = requireCategoryField(record.message);
    const field = readOptionalTrimmedString(record.field);
    return { code, message, ...(field ? { field } : {}) };
  });
};

const normalizeUsage = (value: unknown): CategoryUsage => {
  const record = expectRecord(value);
  const count = (field: keyof CategoryUsage) => {
    const value = record[field];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
      throw invalidCategoriesPayload();
    return value;
  };
  return {
    children: count('children'),
    resourceAssignments: count('resourceAssignments'),
    externalServiceAssignments: count('externalServiceAssignments'),
    dataResourceSettings: count('dataResourceSettings'),
    notificationConfigurations: count('notificationConfigurations'),
  };
};

const normalizeSaveResponse = (value: unknown): CategorySaveResponse => {
  const record = expectRecord(value);
  const errors = normalizeMutationErrors(record.errors);
  if (!Array.isArray(record.affectedDescendantIds)) throw invalidCategoriesPayload();
  const affectedDescendantIds = record.affectedDescendantIds.map(requireCategoryField);
  const category =
    record.category === null || record.category === undefined
      ? undefined
      : normalizeManagementCategory(record.category);
  return { ...(category ? { category } : {}), affectedDescendantIds, errors };
};

const normalizeDeleteResponse = (value: unknown): CategoryDeleteResponse => {
  const record = expectRecord(value);
  const deletedCategoryId =
    record.deletedCategoryId === null || record.deletedCategoryId === undefined
      ? undefined
      : requireCategoryField(record.deletedCategoryId);
  return {
    ...(deletedCategoryId ? { deletedCategoryId } : {}),
    usage: normalizeUsage(record.usage),
    errors: normalizeMutationErrors(record.errors),
  };
};

export const flattenCategoryManagementForTable = (
  categories: readonly CategoryManagementItem[]
): readonly CategoryTableRow[] =>
  [...categories]
    .sort(
      (left, right) =>
        (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER) ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
    )
    .map((category) => ({
      id: category.id,
      categoryId: category.id,
      actionTargetId: category.id,
      name: category.name,
      hierarchyLabel: category.parent?.name ?? '—',
      level: 0,
      active: category.active,
      ...(category.position !== undefined ? { position: category.position } : {}),
      tags: category.dataTypes ?? [],
      tagsDisplay:
        (category.dataTypes ?? []).length > 0 ? (category.dataTypes ?? []).join(', ') : '—',
    }));

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
      headers: {
        'Content-Type': 'application/json',
        ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
      },
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
    init: { method: 'DELETE' },
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
    errorFactory: (code, message) => new CategoriesApiError(code, message),
  });
  return normalizeDeleteResponse(response);
};
