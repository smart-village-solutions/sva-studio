import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import {
  serializeWasteManagementDataExchangeJson,
  type ExternalInterfaceRecord,
  type StudioJobResultArtifact,
  type WasteFractionRecord,
  type WastePdfStaticSettingsRecord,
  type WasteTourRecord,
} from '@sva/core';

/*
 * Keep package construction independent from the export path so import tests can
 * distinguish source settings from the target interface that must be restored.
 */
const createPortablePackage = (calendarWebUrl: string): Uint8Array => {
  const fileName = 'portable-einstellungen.json';
  const contents = serializeWasteManagementDataExchangeJson({
    profileId: 'waste-management.portable-einstellungen',
    exportedAt: '2026-08-16T09:00:00.000Z',
    records: [{ entityType: 'portableSettings', calendarWebUrl, holidayStateCode: 'BB' }],
  });
  return zipSync({
    'manifest.json': strToU8(
      JSON.stringify({
        formatVersion: '1.0.0',
        pluginId: 'waste-management',
        profiles: [
          {
            profileId: 'waste-management.portable-einstellungen',
            fileName,
            sha256: createHash('sha256').update(contents).digest('hex'),
          },
        ],
      })
    ),
    [fileName]: strToU8(contents),
  });
};

const repository = vi.hoisted(() => ({
  listWasteFractions: vi.fn(async (): Promise<WasteFractionRecord[]> => []),
  getWasteFractionById: vi.fn(async () => null),
  upsertWasteFraction: vi.fn(async () => undefined),
  listWasteRegions: vi.fn(async () => []),
  getWasteRegionById: vi.fn(async () => null),
  upsertWasteRegion: vi.fn(async () => undefined),
  listWasteCities: vi.fn(async () => []),
  getWasteCityById: vi.fn(async () => null),
  upsertWasteCity: vi.fn(async () => undefined),
  listWasteStreets: vi.fn(async () => []),
  getWasteStreetById: vi.fn(async () => null),
  upsertWasteStreet: vi.fn(async () => undefined),
  listWasteHouseNumbers: vi.fn(async () => []),
  getWasteHouseNumberById: vi.fn(async () => null),
  upsertWasteHouseNumber: vi.fn(async () => undefined),
  listWasteCollectionLocations: vi.fn(async () => []),
  getWasteCollectionLocationById: vi.fn(async () => null),
  upsertWasteCollectionLocation: vi.fn(async () => undefined),
  listWasteCustomRecurrencePresets: vi.fn(async () => []),
  getWasteCustomRecurrencePresetById: vi.fn(async () => null),
  upsertWasteCustomRecurrencePreset: vi.fn(async () => undefined),
  listWasteTours: vi.fn(async (): Promise<WasteTourRecord[]> => []),
  getWasteTourById: vi.fn(async () => null),
  upsertWasteTour: vi.fn(async () => undefined),
  listWasteLocationTourLinks: vi.fn(async () => []),
  getWasteLocationTourLinkById: vi.fn(async () => null),
  upsertWasteLocationTourLink: vi.fn(async () => undefined),
  listWasteTourAssignments: vi.fn(async () => []),
  getWasteTourAssignmentById: vi.fn(async () => null),
  upsertWasteTourAssignment: vi.fn(async () => undefined),
  listWasteGlobalDateShifts: vi.fn(async () => []),
  getWasteGlobalDateShiftById: vi.fn(async () => null),
  upsertWasteGlobalDateShift: vi.fn(async () => undefined),
  listWasteTourDateShifts: vi.fn(async () => []),
  getWasteTourDateShiftById: vi.fn(async () => null),
  upsertWasteTourDateShift: vi.fn(async () => undefined),
  listWasteHolidayRules: vi.fn(async () => []),
  upsertWasteHolidayRule: vi.fn(async () => undefined),
  getWastePdfStaticSettings: vi.fn(async (): Promise<WastePdfStaticSettingsRecord | null> => null),
  upsertWastePdfStaticSettings: vi.fn(async () => undefined),
}));

vi.mock('@sva/data-repositories', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/data-repositories')>()),
  createWasteMasterDataRepository: vi.fn(() => repository),
}));

import { createExportDataOperation } from './waste-management-operations.export.server.js';
import {
  importCanonicalWasteManagementJson,
  importCanonicalWasteManagementPackage,
} from './waste-management-operations.data-exchange-import.server.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const createInterfaceRecord = (): ExternalInterfaceRecord => ({
  id: 'iface-1',
  instanceId: 'instance-1',
  typeKey: 'postgresql',
  ownerKind: 'host',
  ownerId: 'host',
  displayName: 'Waste PostgreSQL',
  alias: 'default',
  enabled: true,
  isDefault: true,
  category: 'database',
  authMode: 'database_url',
  publicConfig: { schemaName: 'wm' },
  secretConfigCiphertext: 'ciphertext',
  statusCheckKind: 'postgresql',
  visibleStatus: 'ok',
  updatedAt: '2026-08-16T09:00:00.000Z',
});

const createDeps = () => {
  const query = vi.fn(async (_statement: string) => ({ rowCount: 0, rows: [] }));
  const storedBodies: Uint8Array[] = [];
  const deps: WasteOperationRuntimeDeps = {
    now: () => new Date('2026-08-16T09:00:00.000Z'),
    loadDefaultInterfaceRecord: vi.fn(async () => createInterfaceRecord()),
    loadProvisioning: vi.fn(async () => null),
    revealSecret: vi.fn(() => JSON.stringify({ databaseUrl: 'postgres://waste.test/db' })),
    createPool: vi.fn(() => ({
      connect: vi.fn(async () => ({ query, release: vi.fn() })),
      end: vi.fn(async () => undefined),
    })),
    storeJobArtifact: vi.fn(async (input) => {
      storedBodies.push(input.body);
      return {
        artifactId: '00000000-0000-4000-8000-000000000001',
        contentType: input.contentType,
        fileName: input.fileName,
        sizeBytes: input.body.byteLength,
        sha256: 'sha256',
        expiresAt: '2026-08-17T09:00:00.000Z',
      } satisfies StudioJobResultArtifact;
    }),
  };
  return { deps, query, storedBodies };
};

describe('Waste data exchange operations', () => {
  it('exports a single profile without timestamps or subscriber data', async () => {
    repository.listWasteFractions.mockResolvedValueOnce([
      {
        id: 'fraction-1',
        name: 'Restmüll',
        pdfShortLabel: 'RES',
        color: '#112233',
        active: true,
        reminderConfig: {
          reminderCount: 'none',
          channels: { push: false, email: false, calendar: false },
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    const { deps, storedBodies } = createDeps();

    const result = await createExportDataOperation(deps)(
      'instance-1',
      {
        operation: 'export-data',
        profileIds: ['waste-management.fraktionen'],
        targetFormat: 'application/json',
      },
      { jobId: 'job-1' }
    );
    const payload = strFromU8(storedBodies[0] ?? new Uint8Array());

    expect(result.artifacts).toEqual([
      expect.objectContaining({ contentType: 'application/json' }),
    ]);
    expect(payload).toContain('fraction-1');
    expect(payload).not.toContain('createdAt');
    expect(payload).not.toMatch(/subscription|consent|outbox|token/i);
  });

  it('creates a manifest-backed multi-profile ZIP', async () => {
    const { deps, query, storedBodies } = createDeps();
    await createExportDataOperation(deps)(
      'instance-1',
      {
        operation: 'export-data',
        profileIds: ['waste-management.fraktionen', 'waste-management.geografie-abholorte'],
        targetFormat: 'application/zip',
      },
      { jobId: 'job-1' }
    );

    const archive = unzipSync(storedBodies[0] ?? new Uint8Array());
    const manifest = JSON.parse(strFromU8(archive['manifest.json'] ?? new Uint8Array()));
    expect(Object.keys(archive).sort()).toEqual([
      'fraktionen.json',
      'geografie-abholorte.json',
      'manifest.json',
    ]);
    expect(manifest.profiles).toEqual([
      expect.objectContaining({
        profileId: 'waste-management.fraktionen',
        sha256: expect.any(String),
      }),
      expect.objectContaining({
        profileId: 'waste-management.geografie-abholorte',
        sha256: expect.any(String),
      }),
    ]);
    expect(query.mock.calls.map(([statement]) => statement).slice(1)).toEqual([
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
      'COMMIT',
    ]);
  });

  it('rolls back the export snapshot when a profile read fails', async () => {
    const { deps, query } = createDeps();
    repository.listWasteTours.mockRejectedValueOnce(new Error('tour_read_failed'));

    await expect(
      createExportDataOperation(deps)(
        'instance-1',
        {
          operation: 'export-data',
          profileIds: ['waste-management.fraktionen', 'waste-management.touren'],
          targetFormat: 'application/zip',
        },
        { jobId: 'job-1' }
      )
    ).rejects.toThrow('tour_read_failed');

    expect(query.mock.calls.map(([statement]) => statement).slice(1)).toEqual([
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
      'ROLLBACK',
    ]);
  });

  it('imports JSON atomically and applies create defaults', async () => {
    const { deps, query } = createDeps();
    const envelope = {
      formatVersion: '1.0.0',
      pluginId: 'waste-management',
      profileId: 'waste-management.fraktionen',
      exportedAt: '2026-08-16T09:00:00.000Z',
      records: [
        {
          entityType: 'fraction',
          id: 'fraction-1',
          name: 'Bio',
          pdfShortLabel: 'BIO',
          color: '#00aa00',
        },
      ],
    };
    const importDeps = {
      ...deps,
      readBinarySource: vi.fn(async () => new TextEncoder().encode(JSON.stringify(envelope))),
    };

    const result = await importCanonicalWasteManagementJson({
      deps: importDeps,
      instanceId: 'instance-1',
      profileId: 'waste-management.fraktionen',
      blobRef: 'blob:import',
      dryRun: false,
    });

    expect(repository.upsertWasteFraction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fraction-1',
        active: true,
        reminderConfig: expect.any(Object),
      })
    );
    expect(query).toHaveBeenCalledWith('BEGIN');
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(result.details).toMatchObject({ created: 1, updated: 0, unchanged: 0 });
  });

  it('allocates collision-free labels for fractions without an optional PDF short label', async () => {
    repository.listWasteFractions.mockResolvedValueOnce([
      {
        id: 'existing-fraction',
        name: 'Bio',
        pdfShortLabel: 'BIO',
        color: '#008800',
        active: true,
        reminderConfig: {
          reminderCount: 'none',
          channels: { push: false, email: false, calendar: false },
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const { deps } = createDeps();
    const envelope = {
      formatVersion: '1.0.0',
      pluginId: 'waste-management',
      profileId: 'waste-management.fraktionen',
      exportedAt: '2026-08-16T09:00:00.000Z',
      records: [
        { entityType: 'fraction', id: 'fraction-1', name: 'Bioabfall', color: '#00aa00' },
        { entityType: 'fraction', id: 'fraction-2', name: 'Biomüll', color: '#00bb00' },
      ],
    };

    await importCanonicalWasteManagementJson({
      deps: {
        ...deps,
        readBinarySource: vi.fn(async () => new TextEncoder().encode(JSON.stringify(envelope))),
      },
      instanceId: 'instance-1',
      profileId: 'waste-management.fraktionen',
      blobRef: 'blob:import-collisions',
      dryRun: false,
    });

    expect(repository.upsertWasteFraction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fraction-1', pdfShortLabel: 'BIO-2' })
    );
    expect(repository.upsertWasteFraction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fraction-2', pdfShortLabel: 'BIO-3' })
    );
  });

  it('rolls back a profile with unresolved references', async () => {
    const { deps, query } = createDeps();
    const importDeps = {
      ...deps,
      readBinarySource: vi.fn(async () =>
        new TextEncoder().encode(
          JSON.stringify({
            formatVersion: '1.0.0',
            pluginId: 'waste-management',
            profileId: 'waste-management.touren',
            exportedAt: '2026-08-16T09:00:00.000Z',
            records: [
              {
                entityType: 'tour',
                id: 'tour-1',
                name: 'Tour 1',
                wasteFractionIds: ['missing-fraction'],
              },
            ],
          })
        )
      ),
    };

    await expect(
      importCanonicalWasteManagementJson({
        deps: importDeps,
        instanceId: 'instance-1',
        profileId: 'waste-management.touren',
        blobRef: 'blob:import',
        dryRun: false,
      })
    ).rejects.toThrow('missing_waste_data_reference');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(repository.upsertWasteTour).not.toHaveBeenCalled();
  });

  it('reimports a multi-profile ZIP in one transaction and resolves package references', async () => {
    repository.listWasteFractions.mockResolvedValueOnce([
      {
        id: 'fraction-package',
        name: 'Bio',
        pdfShortLabel: 'BIO',
        color: '#00aa00',
        active: true,
        reminderConfig: {
          reminderCount: 'none',
          channels: { push: false, email: false, calendar: false },
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    repository.listWasteTours.mockResolvedValueOnce([
      {
        id: 'tour-package',
        name: 'Bio-Tour',
        wasteFractionIds: ['fraction-package'],
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const exported = createDeps();
    await createExportDataOperation(exported.deps)(
      'instance-1',
      {
        operation: 'export-data',
        profileIds: ['waste-management.fraktionen', 'waste-management.touren'],
        targetFormat: 'application/zip',
      },
      { jobId: 'job-package' }
    );
    const archive = exported.storedBodies[0] ?? new Uint8Array();
    const imported = createDeps();
    const result = await importCanonicalWasteManagementPackage({
      deps: { ...imported.deps, readBinarySource: vi.fn(async () => archive) },
      instanceId: 'instance-1',
      blobRef: 'blob:package',
      dryRun: false,
    });

    expect(imported.query.mock.calls.filter(([statement]) => statement === 'BEGIN')).toHaveLength(
      1
    );
    expect(imported.query.mock.calls.filter(([statement]) => statement === 'COMMIT')).toHaveLength(
      1
    );
    expect(repository.upsertWasteFraction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fraction-package' })
    );
    expect(repository.upsertWasteTour).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tour-package' })
    );
    expect(result.details).toMatchObject({
      importProfileId: 'waste-management.datenpaket',
      sourceFormat: 'application/zip',
    });
  });

  it('rolls back all Waste writes when portable package settings cannot be saved', async () => {
    const targetInterface: ExternalInterfaceRecord = {
      ...createInterfaceRecord(),
      publicConfig: { schemaName: 'wm', calendarWebUrl: 'https://old.example' },
    };
    const { deps, query } = createDeps();
    const saveInterfaceRecord = vi.fn(async () => {
      throw new Error('interface_save_failed');
    });

    await expect(
      importCanonicalWasteManagementPackage({
        deps: {
          ...deps,
          loadDefaultInterfaceRecord: vi.fn(async () => targetInterface),
          readBinarySource: vi.fn(async () => createPortablePackage('https://new.example')),
          saveInterfaceRecord,
        },
        instanceId: 'instance-1',
        blobRef: 'blob:portable-package',
        dryRun: false,
      })
    ).rejects.toThrow('interface_save_failed');

    expect(saveInterfaceRecord).toHaveBeenCalledTimes(1);
    expect(
      query.mock.calls
        .map(([statement]) => statement)
        .filter((statement) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement))
    ).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('restores portable settings when the Waste commit fails after their update', async () => {
    const targetInterface: ExternalInterfaceRecord = {
      ...createInterfaceRecord(),
      publicConfig: { schemaName: 'wm', calendarWebUrl: 'https://old.example' },
    };
    const { deps, query } = createDeps();
    query.mockImplementation(async (statement: string) => {
      if (statement === 'COMMIT') throw new Error('waste_commit_failed');
      return { rowCount: 0, rows: [] };
    });
    const savedInterfaces: ExternalInterfaceRecord[] = [];
    const saveInterfaceRecord = vi.fn(async (record: ExternalInterfaceRecord) => {
      savedInterfaces.push(record);
    });

    await expect(
      importCanonicalWasteManagementPackage({
        deps: {
          ...deps,
          loadDefaultInterfaceRecord: vi.fn(async () => targetInterface),
          readBinarySource: vi.fn(async () => createPortablePackage('https://new.example')),
          saveInterfaceRecord,
        },
        instanceId: 'instance-1',
        blobRef: 'blob:portable-package',
        dryRun: false,
      })
    ).rejects.toThrow('waste_commit_failed');

    expect(savedInterfaces).toHaveLength(2);
    expect(savedInterfaces[0]?.publicConfig).toMatchObject({
      calendarWebUrl: 'https://new.example',
    });
    expect(savedInterfaces[1]).toEqual(targetInterface);
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('transfers portable public settings while excluding and preserving email configuration', async () => {
    repository.getWastePdfStaticSettings.mockResolvedValueOnce({
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Abfallberatung',
      disruptionLocationEnabled: false,
      disruptionAllLocationsEnabled: false,
      updatedAt: '2026-08-16T08:00:00.000Z',
    });
    const sourceInterface: ExternalInterfaceRecord = {
      ...createInterfaceRecord(),
      publicConfig: {
        schemaName: 'wm',
        calendarWebUrl: 'https://calendar.example',
        holidayStateCode: 'BB',
        emailReminderConfig: { enabled: true, senderName: 'Private' },
      },
    };
    const exported = createDeps();
    const exportDeps = {
      ...exported.deps,
      loadDefaultInterfaceRecord: vi.fn(async () => sourceInterface),
    };
    await createExportDataOperation(exportDeps)(
      'instance-1',
      {
        operation: 'export-data',
        profileIds: ['waste-management.portable-einstellungen'],
        targetFormat: 'application/json',
      },
      { jobId: 'job-portable' }
    );
    const json = strFromU8(exported.storedBodies[0] ?? new Uint8Array());
    expect(json).toContain('https://calendar.example');
    expect(json).toContain('holidayStateCode');
    expect(json).not.toContain('emailReminderConfig');
    expect(json).not.toContain('Private');

    const savedInterfaces: ExternalInterfaceRecord[] = [];
    const imported = createDeps();
    const importDeps = {
      ...imported.deps,
      loadDefaultInterfaceRecord: vi.fn(async () => sourceInterface),
      readBinarySource: vi.fn(async () => new TextEncoder().encode(json)),
      saveInterfaceRecord: vi.fn(async (record: ExternalInterfaceRecord) => {
        savedInterfaces.push(record);
      }),
    };
    await importCanonicalWasteManagementJson({
      deps: importDeps,
      instanceId: 'instance-1',
      profileId: 'waste-management.portable-einstellungen',
      blobRef: 'blob:portable',
      dryRun: false,
    });

    expect(savedInterfaces[0]?.publicConfig).toMatchObject({
      calendarWebUrl: 'https://calendar.example',
      holidayStateCode: 'BB',
      emailReminderConfig: { enabled: true, senderName: 'Private' },
    });
  });
});
