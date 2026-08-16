import type {
  WasteManagementDataEntityDefinition,
  WasteManagementDataFieldDefinition,
  WasteManagementDataFieldValueType,
  WasteManagementExcludedFieldDefinition,
  WasteManagementIncludedFieldDefinition,
} from './waste-management-data-exchange.js';

export const required = (key: string, valueType: WasteManagementDataFieldValueType) =>
  ({ key, valueType, transfer: 'included', input: { kind: 'required' } }) as const;

export const optional = (
  key: string,
  valueType: WasteManagementDataFieldValueType,
  nullable = true
) => ({ key, valueType, transfer: 'included', input: { kind: 'optional', nullable } }) as const;

export const defaultable = (
  key: string,
  valueType: WasteManagementDataFieldValueType,
  defaultValue: unknown
) =>
  ({ key, valueType, transfer: 'included', input: { kind: 'defaultable', defaultValue } }) as const;

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
