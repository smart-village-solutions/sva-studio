import type {
  WasteCollectionLocationRecord,
  WasteCityRecord,
  WasteCustomRecurrencePresetRecord,
  WasteFractionRecord,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteManagementDataExchangeRecord,
  WasteManagementDataProfileId,
  WastePdfStaticSettingsWriteInput,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourAssignmentRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
} from '@sva/core';
import { getWasteManagementDataProfile } from '@sva/core';
import type { WasteMasterDataRepository } from '@sva/data-repositories';

const hasOwnProperty = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const deriveWasteFractionShortLabel = (record: Readonly<Record<string, unknown>>): string => {
  const name = typeof record.name === 'string'
    ? record.name.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 3).toLocaleUpperCase('de')
    : '';
  if (name.length > 0) return name;
  return typeof record.id === 'string'
    ? record.id.replaceAll('-', '').slice(0, 3).toLocaleUpperCase('de')
    : '';
};

export const loadExistingWasteDataRecord = async (
  repository: WasteMasterDataRepository,
  record: WasteManagementDataExchangeRecord
): Promise<object | null> => {
  const id = typeof record.id === 'string' ? record.id : '';
  switch (record.entityType) {
    case 'fraction': return repository.getWasteFractionById(id);
    case 'region': return repository.getWasteRegionById(id);
    case 'city': return repository.getWasteCityById(id);
    case 'street': return repository.getWasteStreetById(id);
    case 'houseNumber': return repository.getWasteHouseNumberById(id);
    case 'collectionLocation': return repository.getWasteCollectionLocationById(id);
    case 'recurrencePreset': return repository.getWasteCustomRecurrencePresetById(id);
    case 'tour': return repository.getWasteTourById(id);
    case 'locationTourLink': return repository.getWasteLocationTourLinkById(id);
    case 'tourAssignment': return repository.getWasteTourAssignmentById(id);
    case 'globalDateShift': return repository.getWasteGlobalDateShiftById(id);
    case 'tourDateShift': return repository.getWasteTourDateShiftById(id);
    case 'holidayRule': return (await repository.listWasteHolidayRules()).find((entry) => entry.id === id) ?? null;
    case 'portableSettings': return repository.getWastePdfStaticSettings();
    default: throw new Error(`unsupported_waste_data_entity:${record.entityType}`);
  }
};

export const materializeWasteDataRecord = (
  profileId: WasteManagementDataProfileId,
  record: WasteManagementDataExchangeRecord,
  existing: object | null,
  defaultedFields: string[]
): WasteManagementDataExchangeRecord => {
  const definition = getWasteManagementDataProfile(profileId)?.entities.find(
    (entity) => entity.entityType === record.entityType
  );
  if (definition === undefined) throw new Error(`unsupported_waste_data_entity:${record.entityType}`);
  const current = existing ? ({ ...existing } as Record<string, unknown>) : {};
  const result: Record<string, unknown> = { entityType: record.entityType };
  for (const field of definition.fields) {
    if (field.transfer !== 'included') continue;
    if (hasOwnProperty(record, field.key)) result[field.key] = record[field.key] === null ? undefined : record[field.key];
    else if (hasOwnProperty(current, field.key)) result[field.key] = current[field.key];
    else if (field.input.kind === 'defaultable') {
      result[field.key] = structuredClone(field.input.defaultValue);
      defaultedFields.push(`${record.entityType}.${String(record.id ?? 'singleton')}.${field.key}`);
    }
  }
  if (
    record.entityType === 'fraction' &&
    (typeof result.pdfShortLabel !== 'string' || result.pdfShortLabel.trim().length === 0)
  ) {
    result.pdfShortLabel = deriveWasteFractionShortLabel(result);
  }
  return result as WasteManagementDataExchangeRecord;
};

export const comparableWasteDataRecord = (value: object): string =>
  JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) =>
    key !== 'entityType' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'locationCount'
  ).sort(([left], [right]) => left.localeCompare(right))));

export const upsertWasteDataRecord = async (
  repository: WasteMasterDataRepository,
  record: WasteManagementDataExchangeRecord
): Promise<void> => {
  switch (record.entityType) {
    case 'fraction': return repository.upsertWasteFraction(record as unknown as Omit<WasteFractionRecord, 'createdAt' | 'updatedAt'>);
    case 'region': return repository.upsertWasteRegion(record as unknown as Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>);
    case 'city': return repository.upsertWasteCity(record as unknown as Omit<WasteCityRecord, 'createdAt' | 'updatedAt'>);
    case 'street': return repository.upsertWasteStreet(record as unknown as Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>);
    case 'houseNumber': return repository.upsertWasteHouseNumber(record as unknown as Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>);
    case 'collectionLocation': return repository.upsertWasteCollectionLocation(record as unknown as Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>);
    case 'recurrencePreset': return repository.upsertWasteCustomRecurrencePreset(record as unknown as Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>);
    case 'tour': return repository.upsertWasteTour(record as unknown as Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>);
    case 'locationTourLink': return repository.upsertWasteLocationTourLink(record as unknown as Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>);
    case 'tourAssignment': return repository.upsertWasteTourAssignment(record as unknown as Omit<WasteTourAssignmentRecord, 'createdAt' | 'updatedAt'>);
    case 'globalDateShift': return repository.upsertWasteGlobalDateShift(record as unknown as Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>);
    case 'tourDateShift': return repository.upsertWasteTourDateShift(record as unknown as Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>);
    case 'holidayRule': return repository.upsertWasteHolidayRule(record as unknown as Omit<WasteHolidayRuleRecord, 'createdAt' | 'updatedAt'>);
    case 'portableSettings': return repository.upsertWastePdfStaticSettings(record as WastePdfStaticSettingsWriteInput);
    default: throw new Error(`unsupported_waste_data_entity:${record.entityType}`);
  }
};
