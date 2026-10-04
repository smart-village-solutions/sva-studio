import type {
  SvaMainserverCategoriesListItem,
  SvaMainserverCategoryManagementItem,
  SvaMainserverCategoryMutationError,
} from '../../types.js';
import { isCategoryDataTypeIdentifier } from '../categories-fields.js';
import { toSvaMainserverError } from './shared.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const readRequiredCategoryField = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readOptionalCategoryField = (value: unknown): string | undefined | null => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readOptionalTagList = (value: unknown): string | undefined | null => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
};

const readOptionalPosition = (value: unknown): number | undefined | null => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || Number.isFinite(value) === false) {
    return null;
  }

  return value;
};

const readOptionalCategoryParent = (
  value: unknown
): SvaMainserverCategoriesListItem['parent'] | undefined | null => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (isRecord(value) === false) {
    return null;
  }

  const name = readOptionalCategoryField(value.name);
  if (name === null) {
    return null;
  }

  return name ? { name } : undefined;
};

export const normalizeCategoryListItem = (
  value: unknown
): SvaMainserverCategoriesListItem | null => {
  if (isRecord(value) === false) {
    return null;
  }

  const id = readRequiredCategoryField(value.id);
  const name = readRequiredCategoryField(value.name);
  const position = readOptionalPosition(value.position);
  const tagList = readOptionalTagList(value.tagList);
  const dataTypes = value.dataTypes;
  const parent = readOptionalCategoryParent(value.parent);

  if (
    !id ||
    !name ||
    position === null ||
    tagList === null ||
    !Array.isArray(dataTypes) ||
    parent === null
  ) {
    return null;
  }
  const normalizedDataTypes = dataTypes.map(readRequiredCategoryField);
  if (normalizedDataTypes.some((dataType) => !dataType)) return null;

  return {
    id,
    name,
    dataTypes: normalizedDataTypes as string[],
    ...(parent ? { parent } : {}),
    ...(position !== undefined ? { position } : {}),
    ...(tagList !== undefined ? { tagList } : {}),
  };
};

export const readCategoryManagementErrors = (
  value: unknown
): readonly SvaMainserverCategoryMutationError[] | null => {
  if (!Array.isArray(value)) return null;
  const errors: SvaMainserverCategoryMutationError[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const code = readRequiredCategoryField(entry.code);
    const message = readRequiredCategoryField(entry.message);
    const field = readOptionalCategoryField(entry.field);
    if (!code || !message || field === null) return null;
    errors.push({ code, message, ...(field ? { field } : {}) });
  }
  return errors;
};

const readManagementCategoryBase = (value: Record<string, unknown>) => {
  const id = readRequiredCategoryField(value.id);
  const name = readRequiredCategoryField(value.name);
  const active = value.active;
  const position = readOptionalPosition(value.position);
  const iconName = readOptionalCategoryField(value.iconName);
  const createdAt = readOptionalCategoryField(value.createdAt);
  const updatedAt = readOptionalCategoryField(value.updatedAt);
  const dataTypes = value.dataTypes;
  const children = value.children;
  if (
    !id ||
    !name ||
    typeof active !== 'boolean' ||
    position === null ||
    iconName === null ||
    createdAt === null ||
    updatedAt === null ||
    !Array.isArray(dataTypes) ||
    !Array.isArray(children)
  )
    return null;
  return { id, name, active, position, iconName, createdAt, updatedAt, dataTypes, children };
};

const readManagementCategoryRelations = (
  value: Record<string, unknown>,
  dataTypes: unknown[],
  children: unknown[]
) => {
  const parent =
    value.parent === null || value.parent === undefined
      ? undefined
      : isRecord(value.parent)
        ? {
            id: readRequiredCategoryField(value.parent.id),
            name: readRequiredCategoryField(value.parent.name),
          }
        : null;
  if (parent === null || (parent && (!parent.id || !parent.name))) return null;
  const normalizedTypes = dataTypes.map(readRequiredCategoryField);
  const normalizedChildren = children.map((child) =>
    isRecord(child) ? readRequiredCategoryField(child.id) : null
  );
  if (
    normalizedTypes.some((entry) => !entry || !isCategoryDataTypeIdentifier(entry)) ||
    normalizedChildren.some((entry) => !entry)
  )
    return null;
  const email = isRecord(value.contact)
    ? readOptionalCategoryField(value.contact.email)
    : value.contact === null || value.contact === undefined
      ? undefined
      : null;
  if (email === null) return null;
  return { parent, normalizedTypes, normalizedChildren, email };
};

export const normalizeManagementCategory = (
  value: unknown
): SvaMainserverCategoryManagementItem | null => {
  if (!isRecord(value)) return null;
  const base = readManagementCategoryBase(value);
  if (!base) return null;
  const { id, name, active, position, iconName, createdAt, updatedAt, dataTypes, children } = base;
  const relations = readManagementCategoryRelations(value, dataTypes, children);
  if (!relations) return null;
  const { parent, normalizedTypes, normalizedChildren, email } = relations;
  return {
    id,
    name,
    active,
    children: normalizedChildren.map((child) => ({ id: child! })),
    dataTypes: normalizedTypes as string[],
    ...(parent ? { parent: parent as { id: string; name: string } } : {}),
    ...(position !== undefined ? { position } : {}),
    ...(iconName ? { iconName } : {}),
    ...(email ? { email } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
};

export const invalidCategoryManagementResponse = () =>
  toSvaMainserverError({
    code: 'category_management_invalid_response',
    message: 'Der Mainserver lieferte eine ungültige Kategorienverwaltungsantwort.',
    statusCode: 502,
  });
