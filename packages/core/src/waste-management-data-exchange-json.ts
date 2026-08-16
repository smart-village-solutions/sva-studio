import {
  getWasteManagementDataProfile,
  type WasteManagementDataEntityDefinition,
  type WasteManagementDataExchangeEnvelope,
  type WasteManagementDataExchangeRecord,
  type WasteManagementDataFieldValueType,
  type WasteManagementDataProfileId,
} from './waste-management-data-exchange.js';

export type WasteManagementDataExchangeIssue = Readonly<{
  code:
    | 'duplicate_record'
    | 'excluded_field'
    | 'invalid_envelope'
    | 'invalid_field_type'
    | 'missing_required_field'
    | 'unknown_entity_type'
    | 'unknown_field'
    | 'unsupported_format_version'
    | 'unsupported_profile';
  path: string;
  message: string;
}>;

export type WasteManagementDataExchangeParseResult =
  | Readonly<{
      ok: true;
      envelope: WasteManagementDataExchangeEnvelope;
      defaultedFields: readonly string[];
    }>
  | Readonly<{
      ok: false;
      issues: readonly WasteManagementDataExchangeIssue[];
    }>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwnProperty = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));

const isIsoTimestamp = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));

const hasExpectedType = (value: unknown, valueType: WasteManagementDataFieldValueType): boolean => {
  switch (valueType) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      return typeof value === 'string' && isIsoDate(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'object':
      return isObject(value) || Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'string-array':
      return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
  }
};

const findEntity = (
  profileId: WasteManagementDataProfileId,
  entityType: string
): WasteManagementDataEntityDefinition | undefined =>
  getWasteManagementDataProfile(profileId)?.entities.find(
    (entity) => entity.entityType === entityType
  );

const normalizeRecord = (
  profileId: WasteManagementDataProfileId,
  value: unknown,
  index: number,
  applyDefaults: boolean,
  issues: WasteManagementDataExchangeIssue[],
  defaultedFields: string[]
): WasteManagementDataExchangeRecord | undefined => {
  const path = `records[${index}]`;
  if (!isObject(value) || typeof value.entityType !== 'string') {
    issues.push({ code: 'invalid_envelope', path, message: 'Datensatz benötigt entityType.' });
    return undefined;
  }

  const definition = findEntity(profileId, value.entityType);
  if (definition === undefined || definition.fields.some((field) => field.key === '*')) {
    issues.push({
      code: 'unknown_entity_type',
      path: `${path}.entityType`,
      message: `Entität ${value.entityType} gehört nicht zum importierbaren Profil.`,
    });
    return undefined;
  }

  const fieldsByKey = new Map(definition.fields.map((field) => [field.key, field] as const));
  const normalized: Record<string, unknown> = { entityType: value.entityType };

  for (const key of Object.keys(value)) {
    if (key === 'entityType') continue;
    const field = fieldsByKey.get(key);
    if (field === undefined) {
      issues.push({ code: 'unknown_field', path: `${path}.${key}`, message: 'Unbekanntes Feld.' });
    } else if (field.transfer === 'intentionally-excluded') {
      issues.push({
        code: 'excluded_field',
        path: `${path}.${key}`,
        message: `Feld ist vom Transfer ausgeschlossen (${field.reason}).`,
      });
    }
  }

  for (const field of definition.fields) {
    if (field.transfer !== 'included') continue;
    const fieldPath = `${path}.${field.key}`;
    const present = hasOwnProperty(value, field.key);
    if (!present) {
      if (field.input.kind === 'required') {
        issues.push({
          code: 'missing_required_field',
          path: fieldPath,
          message: 'Pflichtfeld fehlt.',
        });
      } else if (field.input.kind === 'defaultable' && applyDefaults) {
        normalized[field.key] = structuredClone(field.input.defaultValue);
        defaultedFields.push(fieldPath);
      }
      continue;
    }

    const fieldValue = value[field.key];
    if (fieldValue === null && field.input.kind === 'optional' && field.input.nullable) {
      normalized[field.key] = null;
      continue;
    }
    if (!hasExpectedType(fieldValue, field.valueType)) {
      issues.push({
        code: 'invalid_field_type',
        path: fieldPath,
        message: `Erwarteter Feldtyp: ${field.valueType}.`,
      });
      continue;
    }
    normalized[field.key] = fieldValue;
  }

  return normalized as WasteManagementDataExchangeRecord;
};

export const parseWasteManagementDataExchangeJson = (
  source: string | unknown,
  options: Readonly<{ applyDefaults?: boolean }> = {}
): WasteManagementDataExchangeParseResult => {
  let value: unknown = source;
  if (typeof source === 'string') {
    try {
      value = JSON.parse(source) as unknown;
    } catch {
      return {
        ok: false,
        issues: [{ code: 'invalid_envelope', path: '$', message: 'Ungültiges JSON.' }],
      };
    }
  }

  if (!isObject(value)) {
    return {
      ok: false,
      issues: [{ code: 'invalid_envelope', path: '$', message: 'JSON-Envelope fehlt.' }],
    };
  }
  if (value.formatVersion !== '1.0.0') {
    return {
      ok: false,
      issues: [
        {
          code: 'unsupported_format_version',
          path: 'formatVersion',
          message: 'Nicht unterstützte Formatversion.',
        },
      ],
    };
  }
  if (
    value.pluginId !== 'waste-management' ||
    typeof value.profileId !== 'string' ||
    typeof value.exportedAt !== 'string' ||
    !isIsoTimestamp(value.exportedAt) ||
    !Array.isArray(value.records)
  ) {
    return {
      ok: false,
      issues: [
        { code: 'invalid_envelope', path: '$', message: 'JSON-Envelope ist unvollständig.' },
      ],
    };
  }

  const profile = getWasteManagementDataProfile(value.profileId as WasteManagementDataProfileId);
  if (profile === undefined) {
    return {
      ok: false,
      issues: [
        {
          code: 'unsupported_profile',
          path: 'profileId',
          message: 'Unbekanntes Waste-Datenprofil.',
        },
      ],
    };
  }

  const issues: WasteManagementDataExchangeIssue[] = [];
  const defaultedFields: string[] = [];
  const records = value.records.flatMap((record, index) => {
    const normalized = normalizeRecord(
      profile.profileId,
      record,
      index,
      options.applyDefaults ?? true,
      issues,
      defaultedFields
    );
    return normalized === undefined ? [] : [normalized];
  });

  const seen = new Set<string>();
  records.forEach((record, index) => {
    const identity = `${record.entityType}:${typeof record.id === 'string' ? record.id : 'singleton'}`;
    if (seen.has(identity)) {
      issues.push({
        code: 'duplicate_record',
        path: `records[${index}]`,
        message: `Doppelter Datensatz ${identity}.`,
      });
    }
    seen.add(identity);
  });

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    envelope: {
      formatVersion: '1.0.0',
      pluginId: 'waste-management',
      profileId: profile.profileId,
      exportedAt: value.exportedAt,
      records,
    },
    defaultedFields,
  };
};

export const serializeWasteManagementDataExchangeJson = (
  input: Readonly<{
    profileId: WasteManagementDataProfileId;
    exportedAt: string;
    records: readonly WasteManagementDataExchangeRecord[];
  }>
): string => {
  const profile = getWasteManagementDataProfile(input.profileId);
  if (profile === undefined) throw new Error(`unknown_waste_data_profile:${input.profileId}`);
  const transferableRecords = input.records.map((record) => {
    const definition = profile.entities.find((entity) => entity.entityType === record.entityType);
    if (definition === undefined) throw new Error(`unknown_waste_entity:${record.entityType}`);
    return Object.fromEntries([
      ['entityType', record.entityType],
      ...definition.fields.flatMap((field) =>
        field.transfer === 'included' && hasOwnProperty(record, field.key)
          ? [[field.key, record[field.key]] as const]
          : []
      ),
    ]) as WasteManagementDataExchangeRecord;
  });
  const parsed = parseWasteManagementDataExchangeJson(
    {
      formatVersion: '1.0.0',
      pluginId: 'waste-management',
      profileId: input.profileId,
      exportedAt: input.exportedAt,
      records: transferableRecords,
    },
    { applyDefaults: true }
  );
  if (!parsed.ok) {
    throw new Error(`invalid_waste_data_exchange:${parsed.issues[0]?.path ?? '$'}`);
  }

  const materializedRecords = [...parsed.envelope.records]
    .map((record) => {
      const definition = profile.entities.find((entity) => entity.entityType === record.entityType);
      if (definition === undefined) throw new Error(`unknown_waste_entity:${record.entityType}`);
      const output: Record<string, unknown> = { entityType: record.entityType };
      for (const field of definition.fields) {
        if (field.transfer !== 'included') continue;
        if (hasOwnProperty(record, field.key)) output[field.key] = record[field.key];
        else if (field.input.kind === 'optional') output[field.key] = null;
        else if (field.input.kind === 'defaultable') output[field.key] = field.input.defaultValue;
      }
      return output;
    })
    .sort((left, right) => {
      const typeOrder = String(left.entityType).localeCompare(String(right.entityType));
      return typeOrder !== 0
        ? typeOrder
        : String(left.id ?? '').localeCompare(String(right.id ?? ''));
    });

  return `${JSON.stringify({ ...parsed.envelope, records: materializedRecords }, null, 2)}\n`;
};
