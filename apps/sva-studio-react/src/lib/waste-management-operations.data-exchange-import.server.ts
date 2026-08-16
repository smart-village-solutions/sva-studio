import {
  buildWasteManagementPublicConfig,
  getWasteManagementDataProfile,
  isWasteManagementInterfaceSelected,
  readWasteManagementCalendarWebUrl,
  readWasteManagementEmailReminderConfig,
  readWasteManagementEmailReminderSigningSecret,
  readWasteManagementHolidayStateCode,
  readWasteManagementHolidaySyncStatus,
  readWasteManagementLastSuccessfulHolidaySyncAt,
  readWasteManagementPdfBrandingAssetUrl,
  readWasteManagementPdfContactBlock,
  wasteManagementDataProfiles,
  parseWasteManagementDataExchangeJson,
  type WasteCollectionLocationRecord,
  type WasteCityRecord,
  type WasteCustomRecurrencePresetRecord,
  type WasteFractionRecord,
  type WasteGlobalDateShiftRecord,
  type WasteHolidayRuleRecord,
  type WasteHouseNumberRecord,
  type WasteLocationTourLinkRecord,
  type WasteManagementDataExchangeRecord,
  type WasteManagementDataProfileId,
  type WastePdfStaticSettingsWriteInput,
  type WasteRegionRecord,
  type WasteStreetRecord,
  type WasteTourAssignmentRecord,
  type WasteTourDateShiftRecord,
  type WasteTourRecord,
} from '@sva/core';
import type { WasteMasterDataRepository } from '@sva/data-repositories';
import { saveExternalInterfaceRecord } from '@sva/data-repositories/server';
import { createHash } from 'node:crypto';
import { strFromU8, unzipSync } from 'fflate';

import {
  defaultReadBinarySource,
  loadSelectedWasteInterfaceRecord,
  withWasteClient,
} from './waste-management-operations.shared.js';
import type {
  OperationSummary,
  WasteOperationRuntimeDeps,
} from './waste-management-operations.types.js';

type CanonicalImportResult = Readonly<{
  created: number;
  updated: number;
  unchanged: number;
  defaultedFields: readonly string[];
  rowCount: number;
}>;

const hasOwnProperty = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const loadExistingRecord = async (
  repository: WasteMasterDataRepository,
  record: WasteManagementDataExchangeRecord
): Promise<object | null> => {
  const id = typeof record.id === 'string' ? record.id : '';
  switch (record.entityType) {
    case 'fraction':
      return repository.getWasteFractionById(id);
    case 'region':
      return repository.getWasteRegionById(id);
    case 'city':
      return repository.getWasteCityById(id);
    case 'street':
      return repository.getWasteStreetById(id);
    case 'houseNumber':
      return repository.getWasteHouseNumberById(id);
    case 'collectionLocation':
      return repository.getWasteCollectionLocationById(id);
    case 'recurrencePreset':
      return repository.getWasteCustomRecurrencePresetById(id);
    case 'tour':
      return repository.getWasteTourById(id);
    case 'locationTourLink':
      return repository.getWasteLocationTourLinkById(id);
    case 'tourAssignment':
      return repository.getWasteTourAssignmentById(id);
    case 'globalDateShift':
      return repository.getWasteGlobalDateShiftById(id);
    case 'tourDateShift':
      return repository.getWasteTourDateShiftById(id);
    case 'holidayRule':
      return (await repository.listWasteHolidayRules()).find((entry) => entry.id === id) ?? null;
    case 'portableSettings':
      return repository.getWastePdfStaticSettings();
    default:
      throw new Error(`unsupported_waste_data_entity:${record.entityType}`);
  }
};

const materializeRecord = (
  profileId: WasteManagementDataProfileId,
  record: WasteManagementDataExchangeRecord,
  existing: object | null,
  defaultedFields: string[]
): WasteManagementDataExchangeRecord => {
  const definition = getWasteManagementDataProfile(profileId)?.entities.find(
    (entity) => entity.entityType === record.entityType
  );
  if (definition === undefined)
    throw new Error(`unsupported_waste_data_entity:${record.entityType}`);
  const current = existing ? ({ ...existing } as Record<string, unknown>) : {};
  const result: Record<string, unknown> = { entityType: record.entityType };

  for (const field of definition.fields) {
    if (field.transfer !== 'included') continue;
    if (hasOwnProperty(record, field.key)) {
      result[field.key] = record[field.key] === null ? undefined : record[field.key];
    } else if (hasOwnProperty(current, field.key)) {
      result[field.key] = current[field.key];
    } else if (field.input.kind === 'defaultable') {
      result[field.key] = structuredClone(field.input.defaultValue);
      defaultedFields.push(`${record.entityType}.${String(record.id ?? 'singleton')}.${field.key}`);
    }
  }
  return result as WasteManagementDataExchangeRecord;
};

const comparable = (value: object): string =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            key !== 'entityType' &&
            key !== 'createdAt' &&
            key !== 'updatedAt' &&
            key !== 'locationCount'
        )
        .sort(([left], [right]) => left.localeCompare(right))
    )
  );

const upsertRecord = async (
  repository: WasteMasterDataRepository,
  record: WasteManagementDataExchangeRecord
): Promise<void> => {
  switch (record.entityType) {
    case 'fraction':
      return repository.upsertWasteFraction(
        record as unknown as Omit<WasteFractionRecord, 'createdAt' | 'updatedAt'>
      );
    case 'region':
      return repository.upsertWasteRegion(
        record as unknown as Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>
      );
    case 'city':
      return repository.upsertWasteCity(
        record as unknown as Omit<WasteCityRecord, 'createdAt' | 'updatedAt'>
      );
    case 'street':
      return repository.upsertWasteStreet(
        record as unknown as Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>
      );
    case 'houseNumber':
      return repository.upsertWasteHouseNumber(
        record as unknown as Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>
      );
    case 'collectionLocation':
      return repository.upsertWasteCollectionLocation(
        record as unknown as Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>
      );
    case 'recurrencePreset':
      return repository.upsertWasteCustomRecurrencePreset(
        record as unknown as Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>
      );
    case 'tour':
      return repository.upsertWasteTour(
        record as unknown as Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>
      );
    case 'locationTourLink':
      return repository.upsertWasteLocationTourLink(
        record as unknown as Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>
      );
    case 'tourAssignment':
      return repository.upsertWasteTourAssignment(
        record as unknown as Omit<WasteTourAssignmentRecord, 'createdAt' | 'updatedAt'>
      );
    case 'globalDateShift':
      return repository.upsertWasteGlobalDateShift(
        record as unknown as Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>
      );
    case 'tourDateShift':
      return repository.upsertWasteTourDateShift(
        record as unknown as Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>
      );
    case 'holidayRule':
      return repository.upsertWasteHolidayRule(
        record as unknown as Omit<WasteHolidayRuleRecord, 'createdAt' | 'updatedAt'>
      );
    case 'portableSettings':
      return repository.upsertWastePdfStaticSettings(record as WastePdfStaticSettingsWriteInput);
    default:
      throw new Error(`unsupported_waste_data_entity:${record.entityType}`);
  }
};

const loadReferenceIds = async (
  repository: WasteMasterDataRepository,
  entityType: string
): Promise<ReadonlySet<string>> => {
  switch (entityType) {
    case 'fraction':
      return new Set((await repository.listWasteFractions()).map(({ id }) => id));
    case 'region':
      return new Set((await repository.listWasteRegions()).map(({ id }) => id));
    case 'city':
      return new Set((await repository.listWasteCities()).map(({ id }) => id));
    case 'street':
      return new Set((await repository.listWasteStreets()).map(({ id }) => id));
    case 'houseNumber':
      return new Set((await repository.listWasteHouseNumbers()).map(({ id }) => id));
    case 'collectionLocation':
      return new Set((await repository.listWasteCollectionLocations()).map(({ id }) => id));
    case 'recurrencePreset':
      return new Set((await repository.listWasteCustomRecurrencePresets()).map(({ id }) => id));
    case 'tour':
      return new Set((await repository.listWasteTours()).map(({ id }) => id));
    default:
      return new Set();
  }
};

const validateReferences = async (
  repository: WasteMasterDataRepository,
  profileId: WasteManagementDataProfileId,
  records: readonly WasteManagementDataExchangeRecord[],
  packageSourceIds?: ReadonlyMap<string, ReadonlySet<string>>
): Promise<void> => {
  const profile = getWasteManagementDataProfile(profileId);
  if (profile === undefined) throw new Error(`unknown_waste_data_profile:${profileId}`);
  const sourceIds = new Map<string, Set<string>>();
  for (const record of records) {
    if (typeof record.id === 'string') {
      const ids = sourceIds.get(record.entityType) ?? new Set<string>();
      ids.add(record.id);
      sourceIds.set(record.entityType, ids);
    }
  }
  const targetIds = new Map<string, ReadonlySet<string>>();
  for (const definition of profile.entities) {
    for (const field of definition.fields) {
      if (field.transfer !== 'included' || field.references === undefined) continue;
      if (!targetIds.has(field.references.entityType)) {
        targetIds.set(
          field.references.entityType,
          await loadReferenceIds(repository, field.references.entityType)
        );
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
        if (
          !sourceIds.get(field.references.entityType)?.has(id) &&
          !packageSourceIds?.get(field.references.entityType)?.has(id) &&
          !targetIds.get(field.references.entityType)?.has(id)
        ) {
          throw new Error(
            `missing_waste_data_reference:${record.entityType}:${String(record.id ?? 'singleton')}:${field.key}:${id}`
          );
        }
      }
    }
  }
};

const applyCanonicalRecords = async (
  repository: WasteMasterDataRepository,
  profileId: WasteManagementDataProfileId,
  records: readonly WasteManagementDataExchangeRecord[],
  dryRun: boolean,
  portableExisting: object | null = null,
  packageSourceIds?: ReadonlyMap<string, ReadonlySet<string>>
): Promise<CanonicalImportResult> => {
  await validateReferences(repository, profileId, records, packageSourceIds);
  const defaultedFields: string[] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const profile = getWasteManagementDataProfile(profileId);
  const entityOrder = new Map(profile?.entities.map((entity, index) => [entity.entityType, index]));
  const orderedRecords = [...records].sort(
    (left, right) =>
      (entityOrder.get(left.entityType) ?? Number.MAX_SAFE_INTEGER) -
      (entityOrder.get(right.entityType) ?? Number.MAX_SAFE_INTEGER)
  );

  for (const record of orderedRecords) {
    const repositoryRecord = await loadExistingRecord(repository, record);
    const existing =
      record.entityType === 'portableSettings' && portableExisting
        ? { ...(repositoryRecord ?? {}), ...portableExisting }
        : repositoryRecord;
    const materialized = materializeRecord(profileId, record, existing, defaultedFields);
    if (existing === null) created += 1;
    else if (comparable(existing) === comparable(materialized)) unchanged += 1;
    else updated += 1;
    if (!dryRun) await upsertRecord(repository, materialized);
  }

  return { created, updated, unchanged, defaultedFields, rowCount: orderedRecords.length };
};

const persistPortableSettings = async (
  deps: WasteOperationRuntimeDeps,
  portableInterface: NonNullable<Awaited<ReturnType<typeof loadSelectedWasteInterfaceRecord>>>,
  portableRecord: WasteManagementDataExchangeRecord
): Promise<void> => {
  const calendarWebUrl = hasOwnProperty(portableRecord, 'calendarWebUrl')
    ? typeof portableRecord.calendarWebUrl === 'string'
      ? portableRecord.calendarWebUrl
      : undefined
    : readWasteManagementCalendarWebUrl(portableInterface.publicConfig);
  const holidayStateCode = hasOwnProperty(portableRecord, 'holidayStateCode')
    ? typeof portableRecord.holidayStateCode === 'string'
      ? (portableRecord.holidayStateCode as never)
      : undefined
    : readWasteManagementHolidayStateCode(portableInterface.publicConfig);
  await (deps.saveInterfaceRecord ?? saveExternalInterfaceRecord)({
    ...portableInterface,
    publicConfig: buildWasteManagementPublicConfig(portableInterface.publicConfig, {
      selected: isWasteManagementInterfaceSelected(portableInterface),
      calendarWebUrl,
      pdfBrandingAssetUrl: readWasteManagementPdfBrandingAssetUrl(portableInterface.publicConfig),
      pdfContactBlock: readWasteManagementPdfContactBlock(portableInterface.publicConfig),
      emailReminderConfig: readWasteManagementEmailReminderConfig(portableInterface.publicConfig),
      emailReminderSigningSecret: readWasteManagementEmailReminderSigningSecret(
        portableInterface.publicConfig
      ),
      holidayStateCode,
      lastHolidaySyncStatus: readWasteManagementHolidaySyncStatus(portableInterface.publicConfig),
      lastSuccessfulHolidaySyncAt: readWasteManagementLastSuccessfulHolidaySyncAt(
        portableInterface.publicConfig
      ),
    }),
  });
};

export const importCanonicalWasteManagementJson = async (
  input: Readonly<{
    deps: WasteOperationRuntimeDeps;
    instanceId: string;
    profileId: WasteManagementDataProfileId;
    blobRef?: string;
    dryRun: boolean;
  }>
): Promise<OperationSummary> => {
  const startedAt = Date.now();
  if (!input.blobRef) throw new Error('missing_blob_ref');
  const source = await (input.deps.readBinarySource ?? defaultReadBinarySource)(input.blobRef);
  const parsed = parseWasteManagementDataExchangeJson(new TextDecoder().decode(source), {
    applyDefaults: false,
  });
  if (!parsed.ok) {
    throw new Error(
      `invalid_waste_data_exchange:${parsed.issues.map((issue) => `${issue.code}:${issue.path}`).join(',')}`
    );
  }
  if (parsed.envelope.profileId !== input.profileId) {
    throw new Error(`waste_data_profile_mismatch:${input.profileId}:${parsed.envelope.profileId}`);
  }

  const portableInterface =
    input.profileId === 'waste-management.portable-einstellungen'
      ? await loadSelectedWasteInterfaceRecord(input.deps, input.instanceId)
      : null;

  const result = await withWasteClient(
    input.deps,
    input.instanceId,
    async ({ client, repository }) => {
      await client.query('BEGIN');
      try {
        const importResult = await applyCanonicalRecords(
          repository,
          input.profileId,
          parsed.envelope.records,
          input.dryRun,
          portableInterface?.publicConfig ?? null
        );
        await client.query(input.dryRun ? 'ROLLBACK' : 'COMMIT');
        return importResult;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  );

  if (!input.dryRun && portableInterface) {
    const portableRecord = parsed.envelope.records.find(
      (record) => record.entityType === 'portableSettings'
    );
    if (portableRecord) {
      await persistPortableSettings(input.deps, portableInterface, portableRecord);
    }
  }

  return {
    durationMs: Math.max(1, Date.now() - startedAt),
    details: {
      operation: 'import-data',
      mode: 'executed',
      importProfileId: input.profileId,
      sourceFormat: 'application/json',
      dryRun: input.dryRun,
      ...result,
    },
  };
};

type WasteDataPackageManifestProfile = Readonly<{
  profileId: WasteManagementDataProfileId;
  fileName: string;
  sha256: string;
}>;

export const importCanonicalWasteManagementPackage = async (
  input: Readonly<{
    deps: WasteOperationRuntimeDeps;
    instanceId: string;
    blobRef?: string;
    dryRun: boolean;
  }>
): Promise<OperationSummary> => {
  const startedAt = Date.now();
  if (!input.blobRef) throw new Error('missing_blob_ref');
  const source = await (input.deps.readBinarySource ?? defaultReadBinarySource)(input.blobRef);
  const files = unzipSync(source);
  const manifestBytes = files['manifest.json'];
  if (!manifestBytes) throw new Error('missing_waste_data_package_manifest');
  const manifest = JSON.parse(strFromU8(manifestBytes)) as {
    formatVersion?: unknown;
    pluginId?: unknown;
    profiles?: unknown;
  };
  if (
    manifest.formatVersion !== '1.0.0' ||
    manifest.pluginId !== 'waste-management' ||
    !Array.isArray(manifest.profiles)
  ) {
    throw new Error('invalid_waste_data_package_manifest');
  }

  const parsedProfiles = manifest.profiles.map(
    (
      raw
    ): Readonly<{
      manifest: WasteDataPackageManifestProfile;
      records: readonly WasteManagementDataExchangeRecord[];
    }> => {
      if (!raw || typeof raw !== 'object') throw new Error('invalid_waste_data_package_profile');
      const candidate = raw as Record<string, unknown>;
      if (
        typeof candidate.profileId !== 'string' ||
        typeof candidate.fileName !== 'string' ||
        typeof candidate.sha256 !== 'string'
      ) {
        throw new Error('invalid_waste_data_package_profile');
      }
      const profileId = candidate.profileId as WasteManagementDataProfileId;
      if (!getWasteManagementDataProfile(profileId))
        throw new Error(`unknown_waste_data_profile:${profileId}`);
      const profileBytes = files[candidate.fileName];
      if (!profileBytes) throw new Error(`missing_waste_data_package_file:${candidate.fileName}`);
      const checksum = createHash('sha256').update(profileBytes).digest('hex');
      if (checksum !== candidate.sha256)
        throw new Error(`waste_data_package_checksum_mismatch:${candidate.fileName}`);
      const parsed = parseWasteManagementDataExchangeJson(strFromU8(profileBytes), {
        applyDefaults: false,
      });
      if (!parsed.ok || parsed.envelope.profileId !== profileId) {
        throw new Error(`invalid_waste_data_package_file:${candidate.fileName}`);
      }
      return {
        manifest: { profileId, fileName: candidate.fileName, sha256: candidate.sha256 },
        records: parsed.envelope.records,
      };
    }
  );
  if (
    new Set(parsedProfiles.map(({ manifest: profile }) => profile.profileId)).size !==
    parsedProfiles.length
  ) {
    throw new Error('duplicate_waste_data_package_profile');
  }

  const profileOrder = new Map(
    wasteManagementDataProfiles.map((profile, index) => [profile.profileId, index])
  );
  parsedProfiles.sort(
    (left, right) =>
      (profileOrder.get(left.manifest.profileId) ?? Number.MAX_SAFE_INTEGER) -
      (profileOrder.get(right.manifest.profileId) ?? Number.MAX_SAFE_INTEGER)
  );
  const packageSourceIds = new Map<string, Set<string>>();
  for (const { records } of parsedProfiles) {
    for (const record of records) {
      if (typeof record.id !== 'string') continue;
      const ids = packageSourceIds.get(record.entityType) ?? new Set<string>();
      ids.add(record.id);
      packageSourceIds.set(record.entityType, ids);
    }
  }
  const portableProfile = parsedProfiles.find(
    ({ manifest: profile }) => profile.profileId === 'waste-management.portable-einstellungen'
  );
  const portableInterface = portableProfile
    ? await loadSelectedWasteInterfaceRecord(input.deps, input.instanceId)
    : null;

  const results = await withWasteClient(
    input.deps,
    input.instanceId,
    async ({ client, repository }) => {
      await client.query('BEGIN');
      try {
        const imported: Record<string, CanonicalImportResult> = {};
        for (const profile of parsedProfiles) {
          imported[profile.manifest.profileId] = await applyCanonicalRecords(
            repository,
            profile.manifest.profileId,
            profile.records,
            input.dryRun,
            portableInterface?.publicConfig ?? null,
            packageSourceIds
          );
        }
        await client.query(input.dryRun ? 'ROLLBACK' : 'COMMIT');
        return imported;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  );

  const portableRecord = portableProfile?.records.find(
    (record) => record.entityType === 'portableSettings'
  );
  if (!input.dryRun && portableInterface && portableRecord) {
    await persistPortableSettings(input.deps, portableInterface, portableRecord);
  }
  return {
    durationMs: Math.max(1, Date.now() - startedAt),
    details: {
      operation: 'import-data',
      mode: 'executed',
      importProfileId: 'waste-management.datenpaket',
      sourceFormat: 'application/zip',
      dryRun: input.dryRun,
      profiles: results,
    },
  };
};
