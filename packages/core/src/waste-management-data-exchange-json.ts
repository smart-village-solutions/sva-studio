import type {
  WasteManagementDataExchangeEnvelope,
  WasteManagementDataExchangeRecord,
  WasteManagementDataProfileId,
} from './waste-management-data-exchange.js';
import { getWasteManagementDataProfile } from './waste-management-data-profiles.js';
import {
  collectDuplicateRecordIssues,
  isIsoTimestamp,
  isObject,
  normalizeWasteManagementRecord,
} from './waste-management-data-exchange-json.validation.js';
import type {
  WasteManagementDataExchangeIssue,
  WasteManagementDataExchangeParseResult,
} from './waste-management-data-exchange-json.types.js';

export type {
  WasteManagementDataExchangeIssue,
  WasteManagementDataExchangeParseResult,
} from './waste-management-data-exchange-json.types.js';

const invalidEnvelope = (
  message: string,
  path = '$'
): WasteManagementDataExchangeParseResult => ({
  ok: false,
  issues: [{ code: 'invalid_envelope', path, message }],
});

const parseJsonSource = (source: string | unknown): unknown => {
  if (typeof source !== 'string') return source;
  try {
    return JSON.parse(source) as unknown;
  } catch {
    return undefined;
  }
};

const hasValidEnvelopeShape = (
  value: Record<string, unknown>
): value is Record<string, unknown> & {
  pluginId: 'waste-management';
  profileId: string;
  exportedAt: string;
  records: unknown[];
} =>
  value.pluginId === 'waste-management' &&
  typeof value.profileId === 'string' &&
  typeof value.exportedAt === 'string' &&
  isIsoTimestamp(value.exportedAt) &&
  Array.isArray(value.records);

export const parseWasteManagementDataExchangeJson = (
  source: string | unknown,
  options: Readonly<{ applyDefaults?: boolean }> = {}
): WasteManagementDataExchangeParseResult => {
  const value = parseJsonSource(source);
  if (!isObject(value)) return invalidEnvelope(typeof source === 'string' ? 'Ungültiges JSON.' : 'JSON-Envelope fehlt.');
  if (value.formatVersion !== '1.0.0') {
    return {
      ok: false,
      issues: [{
        code: 'unsupported_format_version',
        path: 'formatVersion',
        message: 'Nicht unterstützte Formatversion.',
      }],
    };
  }
  if (!hasValidEnvelopeShape(value)) return invalidEnvelope('JSON-Envelope ist unvollständig.');

  const profile = getWasteManagementDataProfile(value.profileId as WasteManagementDataProfileId);
  if (profile === undefined) {
    return {
      ok: false,
      issues: [{ code: 'unsupported_profile', path: 'profileId', message: 'Unbekanntes Waste-Datenprofil.' }],
    };
  }

  const issues: WasteManagementDataExchangeIssue[] = [];
  const defaultedFields: string[] = [];
  const records = value.records.flatMap((record, index) => {
    const normalized = normalizeWasteManagementRecord({
      profile,
      value: record,
      index,
      applyDefaults: options.applyDefaults ?? true,
      issues,
      defaultedFields,
    });
    return normalized === undefined ? [] : [normalized];
  });
  collectDuplicateRecordIssues(records, issues);
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

const hasOwnProperty = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const selectTransferableFields = (
  profileId: WasteManagementDataProfileId,
  records: readonly WasteManagementDataExchangeRecord[]
): readonly WasteManagementDataExchangeRecord[] => {
  const profile = getWasteManagementDataProfile(profileId);
  if (profile === undefined) throw new Error(`unknown_waste_data_profile:${profileId}`);
  return records.map((record) => {
    const definition = profile.entities.find((entity) => entity.entityType === record.entityType);
    if (definition === undefined) throw new Error(`unknown_waste_entity:${record.entityType}`);
    return Object.fromEntries([
      ['entityType', record.entityType],
      ...definition.fields.flatMap((field) =>
        field.transfer === 'included' &&
        hasOwnProperty(record, field.key) &&
        record[field.key] !== undefined
          ? [[field.key, record[field.key]] as const]
          : []
      ),
    ]) as WasteManagementDataExchangeRecord;
  });
};

const materializeSerializableRecords = (
  envelope: WasteManagementDataExchangeEnvelope
): readonly Record<string, unknown>[] => {
  const profile = getWasteManagementDataProfile(envelope.profileId);
  if (profile === undefined) throw new Error(`unknown_waste_data_profile:${envelope.profileId}`);
  return [...envelope.records].map((record) => {
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
  }).sort((left, right) => {
    const typeOrder = String(left.entityType).localeCompare(String(right.entityType));
    return typeOrder || String(left.id ?? '').localeCompare(String(right.id ?? ''));
  });
};

export const serializeWasteManagementDataExchangeJson = (input: Readonly<{
  profileId: WasteManagementDataProfileId;
  exportedAt: string;
  records: readonly WasteManagementDataExchangeRecord[];
}>): string => {
  const parsed = parseWasteManagementDataExchangeJson({
    formatVersion: '1.0.0',
    pluginId: 'waste-management',
    profileId: input.profileId,
    exportedAt: input.exportedAt,
    records: selectTransferableFields(input.profileId, input.records),
  }, { applyDefaults: false });
  if (!parsed.ok) throw new Error(`invalid_waste_data_exchange:${parsed.issues[0]?.path ?? '$'}`);
  const records = materializeSerializableRecords(parsed.envelope);
  return `${JSON.stringify({ ...parsed.envelope, records }, null, 2)}\n`;
};
