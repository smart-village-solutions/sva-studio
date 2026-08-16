import { storePluginOperationArtifact } from '@sva/auth-runtime/server';
import {
  getWasteManagementDataProfile,
  readWasteManagementCalendarWebUrl,
  readWasteManagementHolidayStateCode,
  serializeWasteManagementDataExchangeJson,
  wasteManagementDataProfileIds,
  type WasteManagementDataExchangeRecord,
  type WasteManagementDataProfileId,
} from '@sva/core';
import type { WasteMasterDataRepository } from '@sva/data-repositories';
import { createHash } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';

import {
  buildOperationSummary,
  loadSelectedWasteInterfaceRecord,
  withWasteClient,
} from './waste-management-operations.shared.js';
import type {
  WasteManagementOperationRuntime,
  WasteOperationRuntimeDeps,
} from './waste-management-operations.types.js';

const withEntityType = (
  entityType: string,
  records: readonly object[]
): readonly WasteManagementDataExchangeRecord[] =>
  records.map((record) => ({ entityType, ...record }) as WasteManagementDataExchangeRecord);

const loadProfileRecords = async (
  repository: WasteMasterDataRepository,
  profileId: WasteManagementDataProfileId,
  portablePublicConfig: Readonly<Record<string, unknown>> = {}
): Promise<readonly WasteManagementDataExchangeRecord[]> => {
  switch (profileId) {
    case wasteManagementDataProfileIds.fractions:
      return withEntityType('fraction', await repository.listWasteFractions());
    case wasteManagementDataProfileIds.geographyCollectionLocations:
      return [
        ...withEntityType('region', await repository.listWasteRegions()),
        ...withEntityType('city', await repository.listWasteCities()),
        ...withEntityType('street', await repository.listWasteStreets()),
        ...withEntityType('houseNumber', await repository.listWasteHouseNumbers()),
        ...withEntityType('collectionLocation', await repository.listWasteCollectionLocations()),
      ];
    case wasteManagementDataProfileIds.recurrencePresets:
      return withEntityType(
        'recurrencePreset',
        await repository.listWasteCustomRecurrencePresets()
      );
    case wasteManagementDataProfileIds.tours:
      return withEntityType('tour', await repository.listWasteTours());
    case wasteManagementDataProfileIds.locationTourLinks:
      return withEntityType('locationTourLink', await repository.listWasteLocationTourLinks());
    case wasteManagementDataProfileIds.tourAssignments:
      return withEntityType('tourAssignment', await repository.listWasteTourAssignments());
    case wasteManagementDataProfileIds.dateShifts:
      return [
        ...withEntityType('globalDateShift', await repository.listWasteGlobalDateShifts()),
        ...withEntityType('tourDateShift', await repository.listWasteTourDateShifts()),
      ];
    case wasteManagementDataProfileIds.holidayRules:
      return withEntityType('holidayRule', await repository.listWasteHolidayRules());
    case wasteManagementDataProfileIds.portableSettings: {
      const settings = await repository.getWastePdfStaticSettings();
      return [
        {
          entityType: 'portableSettings',
          ...(settings ?? {}),
          calendarWebUrl: readWasteManagementCalendarWebUrl(portablePublicConfig),
          holidayStateCode: readWasteManagementHolidayStateCode(portablePublicConfig),
        },
      ];
    }
  }
};

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const profileFileName = (profileId: WasteManagementDataProfileId): string =>
  `${profileId.slice('waste-management.'.length)}.json`;

export const createExportDataOperation =
  (deps: WasteOperationRuntimeDeps): WasteManagementOperationRuntime['exportData'] =>
  async (instanceId, input) => {
    const startedAt = Date.now();
    const exportedAt = (deps.now ?? (() => new Date()))().toISOString();
    const uniqueProfileIds = [...new Set(input.profileIds)];
    if (uniqueProfileIds.length === 0) throw new Error('missing_waste_export_profile');
    if (input.targetFormat === 'application/json' && uniqueProfileIds.length !== 1) {
      throw new Error('single_profile_required_for_json_export');
    }

    const portableInterface = uniqueProfileIds.includes(
      wasteManagementDataProfileIds.portableSettings
    )
      ? await loadSelectedWasteInterfaceRecord(deps, instanceId)
      : null;
    const files = await withWasteClient(deps, instanceId, async ({ repository }) =>
      Promise.all(
        uniqueProfileIds.map(async (profileId) => {
          const profile = getWasteManagementDataProfile(profileId);
          if (profile === undefined) throw new Error(`unknown_waste_data_profile:${profileId}`);
          const records = await loadProfileRecords(
            repository,
            profileId,
            portableInterface?.publicConfig
          );
          const contents = serializeWasteManagementDataExchangeJson({
            profileId,
            exportedAt,
            records,
          });
          return {
            profileId,
            fileName: profileFileName(profileId),
            contents,
            recordCount: records.length,
            sha256: sha256(contents),
            dependencies: profile.dependencies,
          };
        })
      )
    );

    const manifest = {
      formatVersion: '1.0.0',
      pluginId: 'waste-management',
      exportedAt,
      profiles: files.map(({ contents: _contents, ...file }) => file),
    };
    const body =
      input.targetFormat === 'application/json'
        ? strToU8(files[0]?.contents ?? '')
        : zipSync({
            'manifest.json': strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
            ...Object.fromEntries(files.map((file) => [file.fileName, strToU8(file.contents)])),
          });
    const contentType = input.targetFormat;
    const fileName =
      input.targetFormat === 'application/json'
        ? (files[0]?.fileName ?? 'waste-export.json')
        : `waste-daten-${exportedAt.slice(0, 10)}.zip`;
    const artifact = await (deps.storeJobArtifact ?? storePluginOperationArtifact)({
      instanceId,
      body,
      contentType,
      fileName,
    });

    return {
      ...buildOperationSummary(startedAt, {
        operation: 'export-data',
        mode: 'executed',
        profileIds: uniqueProfileIds,
        targetFormat: input.targetFormat,
        recordCounts: Object.fromEntries(files.map((file) => [file.profileId, file.recordCount])),
      }),
      artifacts: [artifact],
    };
  };
