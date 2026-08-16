import {
  getWasteManagementDataProfile,
  parseWasteManagementDataExchangeJson,
  type WasteManagementDataExchangeRecord,
  type WasteManagementDataProfileId,
} from '@sva/core';
import type { WasteMasterDataRepository } from '@sva/data-repositories';

import {
  defaultReadBinarySource,
  loadSelectedWasteInterfaceRecord,
  withWasteClient,
} from './waste-management-operations.shared.js';
import type {
  OperationSummary,
  WasteOperationRuntimeDeps,
} from './waste-management-operations.types.js';
import {
  comparableWasteDataRecord,
  loadExistingWasteDataRecord,
  materializeWasteDataRecord,
  upsertWasteDataRecord,
} from './waste-management-data-exchange-records.server.js';
import { validateWasteDataReferences } from './waste-management-data-exchange-references.server.js';
import { persistPortableWasteSettings } from './waste-management-data-exchange-portable-settings.server.js';
import {
  collectWasteDataPackageSourceIds,
  readWasteDataPackage,
} from './waste-management-data-exchange-package.server.js';

type CanonicalImportResult = Readonly<{
  created: number;
  updated: number;
  unchanged: number;
  defaultedFields: readonly string[];
  rowCount: number;
}>;

const applyCanonicalRecords = async (
  repository: WasteMasterDataRepository,
  profileId: WasteManagementDataProfileId,
  records: readonly WasteManagementDataExchangeRecord[],
  dryRun: boolean,
  portableExisting: object | null = null,
  packageSourceIds?: ReadonlyMap<string, ReadonlySet<string>>
): Promise<CanonicalImportResult> => {
  await validateWasteDataReferences(repository, profileId, records, packageSourceIds);
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
    const repositoryRecord = await loadExistingWasteDataRecord(repository, record);
    const existing =
      record.entityType === 'portableSettings' && portableExisting
        ? { ...(repositoryRecord ?? {}), ...portableExisting }
        : repositoryRecord;
    const materialized = materializeWasteDataRecord(profileId, record, existing, defaultedFields);
    if (existing === null) created += 1;
    else if (comparableWasteDataRecord(existing) === comparableWasteDataRecord(materialized)) unchanged += 1;
    else updated += 1;
    if (!dryRun) await upsertWasteDataRecord(repository, materialized);
  }

  return { created, updated, unchanged, defaultedFields, rowCount: orderedRecords.length };
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
      await persistPortableWasteSettings(input.deps, portableInterface, portableRecord);
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
  const parsedProfiles = readWasteDataPackage(source);
  const packageSourceIds = collectWasteDataPackageSourceIds(parsedProfiles);
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
    await persistPortableWasteSettings(input.deps, portableInterface, portableRecord);
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
