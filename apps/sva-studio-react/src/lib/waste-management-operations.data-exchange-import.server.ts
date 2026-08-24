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
import {
  persistPortableWasteSettings,
  restorePortableWasteSettings,
} from './waste-management-data-exchange-portable-settings.server.js';
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

type PortableInterface = NonNullable<Awaited<ReturnType<typeof loadSelectedWasteInterfaceRecord>>>;

type PreparedImportRecord = Readonly<{
  source: WasteManagementDataExchangeRecord;
  existing: object | null;
  materialized: WasteManagementDataExchangeRecord;
}>;

const normalizeFractionShortLabel = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLocaleUpperCase('de') : '';

const usesDerivedFractionShortLabel = (entry: PreparedImportRecord): boolean => {
  if (entry.source.entityType !== 'fraction') return false;
  const sourceOwnsLabel = Object.prototype.hasOwnProperty.call(entry.source, 'pdfShortLabel');
  const sourceLabel = normalizeFractionShortLabel(entry.source.pdfShortLabel);
  const existingLabel = normalizeFractionShortLabel(
    (entry.existing as Readonly<Record<string, unknown>> | null)?.pdfShortLabel
  );
  return sourceLabel.length === 0 && (sourceOwnsLabel || existingLabel.length === 0);
};

const allocateFractionShortLabels = async (
  repository: WasteMasterDataRepository,
  entries: readonly PreparedImportRecord[]
): Promise<readonly PreparedImportRecord[]> => {
  const fractionEntries = entries.filter((entry) => entry.source.entityType === 'fraction');
  if (fractionEntries.length === 0) return entries;

  const incomingIds = new Set(fractionEntries.map((entry) => String(entry.source.id ?? '')));
  const usedLabels = new Set(
    (await repository.listWasteFractions())
      .filter((fraction) => fraction.active && !incomingIds.has(fraction.id))
      .map((fraction) => normalizeFractionShortLabel(fraction.pdfShortLabel))
      .filter((label) => label.length > 0)
  );

  for (const entry of fractionEntries.filter((candidate) =>
    candidate.materialized.active !== false && !usesDerivedFractionShortLabel(candidate)
  )) {
    const label = normalizeFractionShortLabel(entry.materialized.pdfShortLabel);
    if (label.length === 0 || usedLabels.has(label)) {
      throw new Error(`duplicate_waste_fraction_short_label:${label}`);
    }
    usedLabels.add(label);
  }

  return entries.map((entry) => {
    if (!usesDerivedFractionShortLabel(entry)) return entry;
    const baseLabel = normalizeFractionShortLabel(entry.materialized.pdfShortLabel) || 'WST';
    if (entry.materialized.active === false) {
      return { ...entry, materialized: { ...entry.materialized, pdfShortLabel: baseLabel } };
    }
    let label = baseLabel;
    let suffix = 2;
    while (usedLabels.has(label)) {
      label = `${baseLabel}-${suffix}`;
      suffix += 1;
    }
    usedLabels.add(label);
    return { ...entry, materialized: { ...entry.materialized, pdfShortLabel: label } };
  });
};

const executeAtomicCanonicalImport = async <T>(input: Readonly<{
  deps: WasteOperationRuntimeDeps;
  instanceId: string;
  dryRun: boolean;
  portableInterface: PortableInterface | null;
  portableRecord?: WasteManagementDataExchangeRecord;
  apply: (repository: WasteMasterDataRepository) => Promise<T>;
}>): Promise<T> =>
  withWasteClient(input.deps, input.instanceId, async ({ client, repository }) => {
    await client.query('BEGIN');
    let portableSettingsPersisted = false;
    try {
      const result = await input.apply(repository);
      if (!input.dryRun && input.portableInterface && input.portableRecord) {
        await persistPortableWasteSettings(
          input.deps,
          input.portableInterface,
          input.portableRecord
        );
        portableSettingsPersisted = true;
      }
      await client.query(input.dryRun ? 'ROLLBACK' : 'COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the import failure; the portable settings compensation below is still required.
      }
      if (portableSettingsPersisted && input.portableInterface) {
        try {
          await restorePortableWasteSettings(input.deps, input.portableInterface);
        } catch (compensationError) {
          throw new AggregateError(
            [error, compensationError],
            'waste_data_import_compensation_failed'
          );
        }
      }
      throw error;
    }
  });

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

  const preparedRecords: PreparedImportRecord[] = [];
  for (const record of orderedRecords) {
    const repositoryRecord = await loadExistingWasteDataRecord(repository, record);
    const existing =
      record.entityType === 'portableSettings' && portableExisting
        ? { ...(repositoryRecord ?? {}), ...portableExisting }
        : repositoryRecord;
    const materialized = materializeWasteDataRecord(profileId, record, existing, defaultedFields);
    preparedRecords.push({ source: record, existing, materialized });
  }

  for (const { existing, materialized } of await allocateFractionShortLabels(
    repository,
    preparedRecords
  )) {
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
  const source = input.deps.readBinarySource
    ? await input.deps.readBinarySource(input.blobRef)
    : await defaultReadBinarySource(input.blobRef, input.instanceId);
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
  const portableRecord = parsed.envelope.records.find(
    (record) => record.entityType === 'portableSettings'
  );
  const result = await executeAtomicCanonicalImport({
    deps: input.deps,
    instanceId: input.instanceId,
    dryRun: input.dryRun,
    portableInterface,
    portableRecord,
    apply: async (repository) =>
      applyCanonicalRecords(
        repository,
        input.profileId,
        parsed.envelope.records,
        input.dryRun,
        portableInterface?.publicConfig ?? null
      ),
  });

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
  const source = input.deps.readBinarySource
    ? await input.deps.readBinarySource(input.blobRef)
    : await defaultReadBinarySource(input.blobRef, input.instanceId);
  const parsedProfiles = readWasteDataPackage(source);
  const packageSourceIds = collectWasteDataPackageSourceIds(parsedProfiles);
  const portableProfile = parsedProfiles.find(
    ({ manifest: profile }) => profile.profileId === 'waste-management.portable-einstellungen'
  );
  const portableInterface = portableProfile
    ? await loadSelectedWasteInterfaceRecord(input.deps, input.instanceId)
    : null;
  const portableRecord = portableProfile?.records.find(
    (record) => record.entityType === 'portableSettings'
  );
  const results = await executeAtomicCanonicalImport({
    deps: input.deps,
    instanceId: input.instanceId,
    dryRun: input.dryRun,
    portableInterface,
    portableRecord,
    apply: async (repository) => {
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
      return imported;
    },
  });
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
