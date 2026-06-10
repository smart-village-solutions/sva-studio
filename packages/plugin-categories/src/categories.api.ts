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

const compactString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeCategoryTreeItem = (value: unknown): CategoryTreeItem => {
  if (isRecord(value) === false) {
    throw new CategoriesApiError('invalid_categories_payload');
  }

  const id = compactString(value.id);
  const name = compactString(value.name);
  if (!id || !name) {
    throw new CategoriesApiError('invalid_categories_payload');
  }

  if (value.children !== undefined && Array.isArray(value.children) === false) {
    throw new CategoriesApiError('invalid_categories_payload');
  }

  if (value.position !== undefined && (typeof value.position !== 'number' || Number.isFinite(value.position) === false)) {
    throw new CategoriesApiError('invalid_categories_payload');
  }

  if (value.iconName !== undefined && typeof value.iconName !== 'string') {
    throw new CategoriesApiError('invalid_categories_payload');
  }

  if (value.tagList !== undefined && typeof value.tagList !== 'string') {
    throw new CategoriesApiError('invalid_categories_payload');
  }

  if (value.createdAt !== undefined && typeof value.createdAt !== 'string') {
    throw new CategoriesApiError('invalid_categories_payload');
  }

  if (value.updatedAt !== undefined && typeof value.updatedAt !== 'string') {
    throw new CategoriesApiError('invalid_categories_payload');
  }

  const rawChildren = Array.isArray(value.children) ? value.children : [];
  const children = rawChildren.map(normalizeCategoryTreeItem);

  return {
    id,
    name,
    ...(compactString(value.iconName) ? { iconName: compactString(value.iconName) } : {}),
    ...(typeof value.position === 'number' ? { position: value.position } : {}),
    ...(compactString(value.tagList) || value.tagList === '' ? { tagList: typeof value.tagList === 'string' ? value.tagList : '' } : {}),
    ...(compactString(value.createdAt) ? { createdAt: compactString(value.createdAt) } : {}),
    ...(compactString(value.updatedAt) ? { updatedAt: compactString(value.updatedAt) } : {}),
    children,
  };
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
    throw new CategoriesApiError('invalid_categories_payload');
  }

  return categories;
};
