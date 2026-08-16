import type {
  WasteManagementDataExchangeRecord,
  WasteManagementDataFieldValueType,
  WasteManagementDataProfileDefinition,
} from './waste-management-data-exchange.js';
import type { WasteManagementDataExchangeIssue } from './waste-management-data-exchange-json.types.js';

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isIsoTimestamp = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));

const hasOwnProperty = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));

const hasExpectedType = (value: unknown, valueType: WasteManagementDataFieldValueType): boolean => {
  switch (valueType) {
    case 'boolean': return typeof value === 'boolean';
    case 'date': return typeof value === 'string' && isIsoDate(value);
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'object': return isObject(value) || Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'string-array': return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
  }
};

const validateRecordKeys = (
  value: Record<string, unknown>,
  path: string,
  definition: WasteManagementDataProfileDefinition['entities'][number],
  issues: WasteManagementDataExchangeIssue[]
): void => {
  const fields = new Map(definition.fields.map((field) => [field.key, field] as const));
  for (const key of Object.keys(value)) {
    if (key === 'entityType') continue;
    const field = fields.get(key);
    if (field === undefined) issues.push({ code: 'unknown_field', path: `${path}.${key}`, message: 'Unbekanntes Feld.' });
    else if (field.transfer === 'intentionally-excluded') {
      issues.push({ code: 'excluded_field', path: `${path}.${key}`, message: `Feld ist vom Transfer ausgeschlossen (${field.reason}).` });
    }
  }
};

const materializeRecordFields = (
  value: Record<string, unknown>,
  path: string,
  definition: WasteManagementDataProfileDefinition['entities'][number],
  applyDefaults: boolean,
  issues: WasteManagementDataExchangeIssue[],
  defaultedFields: string[]
): WasteManagementDataExchangeRecord => {
  const normalized: Record<string, unknown> = { entityType: value.entityType };
  for (const field of definition.fields) {
    if (field.transfer !== 'included') continue;
    const fieldPath = `${path}.${field.key}`;
    if (!hasOwnProperty(value, field.key)) {
      if (field.input.kind === 'required') issues.push({ code: 'missing_required_field', path: fieldPath, message: 'Pflichtfeld fehlt.' });
      else if (field.input.kind === 'defaultable' && applyDefaults) {
        normalized[field.key] = structuredClone(field.input.defaultValue);
        defaultedFields.push(fieldPath);
      }
      continue;
    }
    const fieldValue = value[field.key];
    if (fieldValue === null && field.input.kind === 'optional' && field.input.nullable) {
      normalized[field.key] = null;
    } else if (!hasExpectedType(fieldValue, field.valueType)) {
      issues.push({ code: 'invalid_field_type', path: fieldPath, message: `Erwarteter Feldtyp: ${field.valueType}.` });
    } else normalized[field.key] = fieldValue;
  }
  return normalized as WasteManagementDataExchangeRecord;
};

export const normalizeWasteManagementRecord = (input: Readonly<{
  profile: WasteManagementDataProfileDefinition;
  value: unknown;
  index: number;
  applyDefaults: boolean;
  issues: WasteManagementDataExchangeIssue[];
  defaultedFields: string[];
}>): WasteManagementDataExchangeRecord | undefined => {
  const path = `records[${input.index}]`;
  if (!isObject(input.value) || typeof input.value.entityType !== 'string') {
    input.issues.push({ code: 'invalid_envelope', path, message: 'Datensatz benötigt entityType.' });
    return undefined;
  }
  const value = input.value;
  const definition = input.profile.entities.find((entry) => entry.entityType === value.entityType);
  if (definition === undefined || definition.fields.some((field) => field.key === '*')) {
    input.issues.push({ code: 'unknown_entity_type', path: `${path}.entityType`, message: `Entität ${value.entityType} gehört nicht zum importierbaren Profil.` });
    return undefined;
  }
  validateRecordKeys(value, path, definition, input.issues);
  return materializeRecordFields(value, path, definition, input.applyDefaults, input.issues, input.defaultedFields);
};

export const collectDuplicateRecordIssues = (
  records: readonly WasteManagementDataExchangeRecord[],
  issues: WasteManagementDataExchangeIssue[]
): void => {
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const identity = `${record.entityType}:${typeof record.id === 'string' ? record.id : 'singleton'}`;
    if (seen.has(identity)) issues.push({ code: 'duplicate_record', path: `records[${index}]`, message: `Doppelter Datensatz ${identity}.` });
    seen.add(identity);
  });
};
