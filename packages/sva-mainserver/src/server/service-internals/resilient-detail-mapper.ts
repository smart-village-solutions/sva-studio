import { z } from 'zod';

import type { MainserverDataDeviation, MainserverDetailResult } from '../../types.js';

type ResilientObjectOptions = Readonly<{
  hardFields: readonly string[];
  listFields?: Readonly<Record<string, z.ZodType>>;
  fieldAliases?: Readonly<Record<string, string>>;
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deviationFor = (fieldPath: string): MainserverDataDeviation => ({
  fieldPath,
  fieldGroup: (fieldPath.split('.')[0] ?? fieldPath).replace(/\[\]$/u, ''),
  code: 'unexpected_type',
  phase: 'read',
  handling: 'omitted',
  retryable: false,
});

export const parseResilientDetail = <T>(
  schema: z.ZodObject,
  value: unknown,
  options: ResilientObjectOptions
): MainserverDetailResult<T> | null => {
  if (!isRecord(value)) {
    return null;
  }

  const hardFields = new Set(options.hardFields);
  const deviations: MainserverDataDeviation[] = [];
  const data: Record<string, unknown> = {};

  for (const [fieldName, fieldSchema] of Object.entries(schema.shape)) {
    const canonicalFieldName = options.fieldAliases?.[fieldName] ?? fieldName;
    const fieldValue = value[fieldName];
    const listItemSchema = options.listFields?.[fieldName];
    if (listItemSchema && Array.isArray(fieldValue)) {
      const validItems: unknown[] = [];
      let invalidItemFound = false;
      for (const item of fieldValue) {
        const parsedItem = listItemSchema.safeParse(item);
        if (parsedItem.success) {
          validItems.push(parsedItem.data);
        } else {
          invalidItemFound = true;
        }
      }
      data[fieldName] = validItems;
      if (invalidItemFound) {
        deviations.push(deviationFor(`${canonicalFieldName}[]`));
      }
      continue;
    }

    const parsedField = fieldSchema.safeParse(fieldValue);
    if (parsedField.success) {
      data[fieldName] = parsedField.data;
      continue;
    }
    if (hardFields.has(fieldName)) {
      return null;
    }
    data[fieldName] = undefined;
    deviations.push(deviationFor(canonicalFieldName));
  }

  return { data: data as T, deviations };
};
