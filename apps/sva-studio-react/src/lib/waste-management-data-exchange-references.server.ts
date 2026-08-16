import {
  getWasteManagementDataProfile,
  type WasteManagementDataExchangeRecord,
  type WasteManagementDataProfileId,
} from '@sva/core';
import type { WasteMasterDataRepository } from '@sva/data-repositories';

const loadReferenceIds = async (
  repository: WasteMasterDataRepository,
  entityType: string
): Promise<ReadonlySet<string>> => {
  switch (entityType) {
    case 'fraction': return new Set((await repository.listWasteFractions()).map(({ id }) => id));
    case 'region': return new Set((await repository.listWasteRegions()).map(({ id }) => id));
    case 'city': return new Set((await repository.listWasteCities()).map(({ id }) => id));
    case 'street': return new Set((await repository.listWasteStreets()).map(({ id }) => id));
    case 'houseNumber': return new Set((await repository.listWasteHouseNumbers()).map(({ id }) => id));
    case 'collectionLocation': return new Set((await repository.listWasteCollectionLocations()).map(({ id }) => id));
    case 'recurrencePreset': return new Set((await repository.listWasteCustomRecurrencePresets()).map(({ id }) => id));
    case 'tour': return new Set((await repository.listWasteTours()).map(({ id }) => id));
    default: return new Set();
  }
};

const collectSourceIds = (
  records: readonly WasteManagementDataExchangeRecord[]
): ReadonlyMap<string, ReadonlySet<string>> => {
  const sourceIds = new Map<string, Set<string>>();
  for (const record of records) {
    if (typeof record.id !== 'string') continue;
    const ids = sourceIds.get(record.entityType) ?? new Set<string>();
    ids.add(record.id);
    sourceIds.set(record.entityType, ids);
  }
  return sourceIds;
};

export const validateWasteDataReferences = async (
  repository: WasteMasterDataRepository,
  profileId: WasteManagementDataProfileId,
  records: readonly WasteManagementDataExchangeRecord[],
  packageSourceIds?: ReadonlyMap<string, ReadonlySet<string>>
): Promise<void> => {
  const profile = getWasteManagementDataProfile(profileId);
  if (profile === undefined) throw new Error(`unknown_waste_data_profile:${profileId}`);
  const sourceIds = collectSourceIds(records);
  const targetIds = new Map<string, ReadonlySet<string>>();
  for (const definition of profile.entities) {
    for (const field of definition.fields) {
      if (field.transfer !== 'included' || field.references === undefined) continue;
      if (!targetIds.has(field.references.entityType)) {
        targetIds.set(field.references.entityType, await loadReferenceIds(repository, field.references.entityType));
      }
    }
  }
  for (const record of records) {
    const definition = profile.entities.find((entity) => entity.entityType === record.entityType);
    for (const field of definition?.fields ?? []) {
      if (field.transfer !== 'included' || field.references === undefined) continue;
      const raw = record[field.key];
      const ids = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
      for (const id of ids) {
        const entityType = field.references.entityType;
        if (!sourceIds.get(entityType)?.has(id) && !packageSourceIds?.get(entityType)?.has(id) && !targetIds.get(entityType)?.has(id)) {
          throw new Error(`missing_waste_data_reference:${record.entityType}:${String(record.id ?? 'singleton')}:${field.key}:${id}`);
        }
      }
    }
  }
};
