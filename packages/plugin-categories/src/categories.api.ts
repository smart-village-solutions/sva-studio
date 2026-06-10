import { requestMainserverJson } from '@sva/plugin-sdk';

import type { CategoriesListResponse, CategoryTableRow, CategoryTreeItem } from './categories.types.js';

export type { CategoriesListResponse, CategoryTableRow, CategoryTreeItem } from './categories.types.js';

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

const readChildren = (value: unknown): readonly unknown[] => {
  if (value === undefined) {
    return [];
  }

  if (Array.isArray(value) === false) {
    throw invalidCategoriesPayload();
  }

  return value;
};

const readPosition = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || Number.isFinite(value) === false) {
    throw invalidCategoriesPayload();
  }

  return value;
};

const readOptionalString = (value: unknown): string | undefined => {
  if (value === undefined) {
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

const buildCategoryTreeItem = (input: {
  readonly id: string;
  readonly name: string;
  readonly children: readonly CategoryTreeItem[];
  readonly iconName?: string;
  readonly position?: number;
  readonly tagList?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}): CategoryTreeItem => ({
  id: input.id,
  name: input.name,
  ...(input.iconName ? { iconName: input.iconName } : {}),
  ...(input.position !== undefined ? { position: input.position } : {}),
  ...(input.tagList !== undefined ? { tagList: input.tagList } : {}),
  ...(input.createdAt ? { createdAt: input.createdAt } : {}),
  ...(input.updatedAt ? { updatedAt: input.updatedAt } : {}),
  children: input.children,
});

const normalizeCategoryTreeItem = (value: unknown): CategoryTreeItem => {
  const record = expectRecord(value);
  return buildCategoryTreeItem({
    id: requireCategoryField(record.id),
    name: requireCategoryField(record.name),
    iconName: readOptionalTrimmedString(record.iconName),
    position: readPosition(record.position),
    tagList: readTagList(record.tagList),
    createdAt: readOptionalTrimmedString(record.createdAt),
    updatedAt: readOptionalTrimmedString(record.updatedAt),
    children: readChildren(record.children).map(normalizeCategoryTreeItem),
  });
};

const normalizeCategoryTree = (value: unknown): readonly CategoryTreeItem[] | null => {
  if (Array.isArray(value) === false) {
    return null;
  }

  return value.map(normalizeCategoryTreeItem);
};

const splitTags = (tagList?: string): readonly string[] =>
  (tagList ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

export const flattenCategoriesForTable = (categories: readonly CategoryTreeItem[]): readonly CategoryTableRow[] => {
  const rows: CategoryTableRow[] = [];

  const visit = (category: CategoryTreeItem, ancestors: readonly string[], level: number) => {
    const path = [...ancestors, category.name];
    const tags = splitTags(category.tagList);

    rows.push({
      id: category.id,
      categoryId: category.id,
      actionTargetId: category.id,
      name: category.name,
      hierarchyLabel: ancestors.length === 0 ? '—' : path.join(' / '),
      level,
      ...(category.iconName ? { iconName: category.iconName } : {}),
      ...(category.position !== undefined ? { position: category.position } : {}),
      tags,
      tagsDisplay: tags.length > 0 ? tags.join(', ') : '—',
      ...(category.createdAt ? { createdAt: category.createdAt } : {}),
      ...(category.updatedAt ? { updatedAt: category.updatedAt } : {}),
    });

    for (const child of category.children) {
      visit(child, path, level + 1);
    }
  };

  for (const category of categories) {
    visit(category, [], 0);
  }

  return rows;
};

export const listCategories = async (fetchImpl?: typeof fetch): Promise<readonly CategoryTreeItem[]> => {
  const response = await requestMainserverJson<CategoriesListResponse, CategoriesApiError>({
    url: '/api/v1/mainserver/categories',
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
    errorFactory: (code, message) => new CategoriesApiError(code, message),
  });

  const categories = normalizeCategoryTree(response.data);
  if (categories === null) {
    throw invalidCategoriesPayload();
  }

  return categories;
};
