import type {
  CategoryDeleteResponse,
  CategoryListItem,
  CategoryManagementItem,
  CategoryMutationError,
  CategorySaveResponse,
  CategoryTableRow,
  CategoryUsage,
} from './categories.types.js';

export class CategoriesApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'CategoriesApiError';
  }
}

const invalidPayload = () => new CategoriesApiError('invalid_categories_payload');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const record = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw invalidPayload();
  return value;
};
const optionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw invalidPayload();
  return value;
};
const compactString = (value: unknown): string | undefined =>
  optionalString(value)?.trim() || undefined;
const requiredString = (value: unknown): string => {
  const text = compactString(value);
  if (!text) throw invalidPayload();
  return text;
};
const optionalPosition = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalidPayload();
  return value;
};

export const normalizeCategoryList = (value: unknown): readonly CategoryListItem[] => {
  if (!Array.isArray(value)) throw invalidPayload();
  return value.map((entry) => {
    const item = record(entry);
    const parentName =
      item.parent === undefined || item.parent === null
        ? undefined
        : compactString(record(item.parent).name);
    const position = optionalPosition(item.position);
    const tagList = optionalString(item.tagList);
    return {
      id: requiredString(item.id),
      name: requiredString(item.name),
      ...(parentName ? { parent: { name: parentName } } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(tagList !== undefined ? { tagList: tagList.trim() } : {}),
    };
  });
};

export const normalizeManagementCategory = (value: unknown): CategoryManagementItem => {
  const item = record(value);
  if (!Array.isArray(item.children) || !Array.isArray(item.dataTypes)) throw invalidPayload();
  if (typeof item.active !== 'boolean') throw invalidPayload();
  const parentValue =
    item.parent === undefined || item.parent === null
      ? undefined
      : (() => {
          const raw = record(item.parent);
          return { id: requiredString(raw.id), name: requiredString(raw.name) };
        })();
  const position = optionalPosition(item.position);
  const iconName = compactString(item.iconName);
  const email = compactString(item.email);
  const createdAt = compactString(item.createdAt);
  const updatedAt = compactString(item.updatedAt);
  return {
    id: requiredString(item.id),
    name: requiredString(item.name),
    active: item.active,
    children: item.children.map((child) => ({ id: requiredString(record(child).id) })),
    dataTypes: item.dataTypes.map(requiredString),
    ...(parentValue ? { parent: parentValue } : {}),
    ...(position !== undefined ? { position } : {}),
    ...(iconName ? { iconName } : {}),
    ...(email ? { email } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
};

const mutationErrors = (value: unknown): readonly CategoryMutationError[] => {
  if (!Array.isArray(value)) throw invalidPayload();
  return value.map((entry) => {
    const item = record(entry);
    const field = compactString(item.field);
    return {
      code: requiredString(item.code),
      message: requiredString(item.message),
      ...(field ? { field } : {}),
    };
  });
};

export const normalizeSaveResponse = (value: unknown): CategorySaveResponse => {
  const item = record(value);
  if (!Array.isArray(item.affectedDescendantIds)) throw invalidPayload();
  const category =
    item.category === null || item.category === undefined
      ? undefined
      : normalizeManagementCategory(item.category);
  return {
    ...(category ? { category } : {}),
    affectedDescendantIds: item.affectedDescendantIds.map(requiredString),
    errors: mutationErrors(item.errors),
  };
};

const normalizeUsage = (value: unknown): CategoryUsage => {
  const item = record(value);
  const count = (field: keyof CategoryUsage) => {
    const amount = item[field];
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0)
      throw invalidPayload();
    return amount;
  };
  return {
    children: count('children'),
    resourceAssignments: count('resourceAssignments'),
    externalServiceAssignments: count('externalServiceAssignments'),
    dataResourceSettings: count('dataResourceSettings'),
    notificationConfigurations: count('notificationConfigurations'),
  };
};

export const normalizeDeleteResponse = (value: unknown): CategoryDeleteResponse => {
  const item = record(value);
  const deletedCategoryId = compactString(item.deletedCategoryId);
  return {
    ...(deletedCategoryId ? { deletedCategoryId } : {}),
    usage: normalizeUsage(item.usage),
    errors: mutationErrors(item.errors),
  };
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
      tagsDisplay: tags.length ? tags.join(', ') : '—',
    };
  });

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
      tags: category.dataTypes,
      tagsDisplay: category.dataTypes.length ? category.dataTypes.join(', ') : '—',
    }));
