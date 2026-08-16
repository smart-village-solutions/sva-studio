import type {
  WasteManagementDataEntityDefinition,
  WasteManagementDataFieldDefinition,
  WasteManagementDataFieldValueType,
  WasteManagementExcludedFieldDefinition,
  WasteManagementIncludedFieldDefinition,
  WasteManagementStructuredFieldShape,
} from './waste-management-data-exchange.js';

type ScalarFieldValueType = Exclude<WasteManagementDataFieldValueType, 'object'>;

export const required = (key: string, valueType: ScalarFieldValueType) =>
  ({ key, valueType, transfer: 'included', input: { kind: 'required' } }) as const;

export const optional = (
  key: string,
  valueType: ScalarFieldValueType,
  nullable = true
) => ({ key, valueType, transfer: 'included', input: { kind: 'optional', nullable } }) as const;

export const optionalEnum = (
  key: string,
  allowedValues: readonly string[],
  nullable = true
) => ({
  key,
  valueType: 'string',
  allowedValues,
  transfer: 'included',
  input: { kind: 'optional', nullable },
}) as const;

export const defaultable = (
  key: string,
  valueType: ScalarFieldValueType,
  defaultValue: unknown
) =>
  ({ key, valueType, transfer: 'included', input: { kind: 'defaultable', defaultValue } }) as const;

export const optionalStructured = (
  key: string,
  structuredShape: WasteManagementStructuredFieldShape,
  nullable = true
) => ({
  key,
  valueType: 'object',
  structuredShape,
  transfer: 'included',
  input: { kind: 'optional', nullable },
}) as const;

export const defaultableStructured = (
  key: string,
  structuredShape: WasteManagementStructuredFieldShape,
  defaultValue: unknown
) => ({
  key,
  valueType: 'object',
  structuredShape,
  transfer: 'included',
  input: { kind: 'defaultable', defaultValue },
}) as const;

export const reference = (
  field: WasteManagementIncludedFieldDefinition,
  entityType: string,
  many = false
): WasteManagementIncludedFieldDefinition => ({ ...field, references: { entityType, many } });

export const excludedTargetTimestamps = [
  { key: 'createdAt', transfer: 'intentionally-excluded', reason: 'target-managed-timestamp' },
  { key: 'updatedAt', transfer: 'intentionally-excluded', reason: 'target-managed-timestamp' },
] as const satisfies readonly WasteManagementExcludedFieldDefinition[];

export const entity = (
  entityType: string,
  fields: readonly WasteManagementDataFieldDefinition[]
): WasteManagementDataEntityDefinition => ({ entityType, fields });
