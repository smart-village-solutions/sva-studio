import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WasteManagementDataSourceRecord } from '@sva/core';
import * as XLSX from 'xlsx';

import { createWasteManagementOperationRuntime } from './waste-management-operations.server.js';

const createDataSourceRecord = (): WasteManagementDataSourceRecord => ({
  instanceId: 'instance-1',
  provider: 'supabase',
  projectUrl: 'https://tenant.supabase.co',
  schemaName: 'wm',
  enabled: true,
  databaseUrlConfigured: true,
  serviceRoleKeyConfigured: true,
  databaseUrlCiphertext: 'enc-db',
  serviceRoleKeyCiphertext: 'enc-key',
  visibleStatus: 'ok',
  lastCheckStatus: 'succeeded',
  lastCheckedAt: '2026-05-10T10:00:00.000Z',
  updatedAt: '2026-05-10T10:00:00.000Z',
});

describe('waste management operations runtime', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('@sva/server-runtime');
    vi.doUnmock('@sva/data-repositories');
  });

  it('applies schema migrations against the resolved waste schema', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValue({ rowCount: 0, rows: requiredTableRows });
    const pool = {
      connect: vi.fn(async () => ({
        query,
        release: vi.fn(),
      })),
      end: vi.fn(async () => undefined),
    };
    const runtime = createWasteManagementOperationRuntime({
      loadDataSourceRecord: vi.fn(async () => createDataSourceRecord()),
      revealSecret: vi.fn((ciphertext) => (ciphertext ? 'postgres://waste:test@localhost:5432/waste' : undefined)),
      createPool: vi.fn(() => pool),
    });

    const result = await runtime.applyMigrations('instance-1', {
      operation: 'apply-migrations',
      targetSchema: 'wm',
    });

    expect(result.details).toMatchObject({
      operation: 'apply-migrations',
      mode: 'executed',
      appliedStatementCount: expect.any(Number),
      schemaInspection: {
        schemaName: 'wm',
        missingTables: [],
      },
    });
    expect(query).toHaveBeenCalledWith('SET search_path TO "wm", public;');
  });

  it('parses geography imports as a dry run from an xlsx workbook', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const pool = {
      connect: vi.fn(async () => ({
        query,
        release: vi.fn(),
      })),
      end: vi.fn(async () => undefined),
    };
    const runtime = createWasteManagementOperationRuntime({
      loadDataSourceRecord: vi.fn(async () => createDataSourceRecord()),
      revealSecret: vi.fn((ciphertext, aad) =>
        ciphertext ? (aad.includes('database_url') ? 'postgres://waste:test@localhost:5432/waste' : 'service-key') : undefined
      ),
      createPool: vi.fn(() => pool),
      readBinarySource: vi.fn(async () => createImportWorkbookBytes()),
    });

    const result = await runtime.importData('instance-1', {
      operation: 'import-data',
      importProfileId: 'waste-management.geografie-abholorte',
      sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dryRun: true,
      blobRef: 'fixture.xlsx',
    });

    expect(result.details).toMatchObject({
      operation: 'import-data',
      mode: 'executed',
      dryRun: true,
      importProfileId: 'waste-management.geografie-abholorte',
    });
  });

  it('initializes the data source with connection check and schema inspection', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: requiredTableRows.length,
      rows: requiredTableRows,
    });
    const release = vi.fn();
    const pool = {
      connect: vi
        .fn()
        .mockResolvedValueOnce({
          release,
        })
        .mockResolvedValueOnce({
          query,
          release,
        }),
      end: vi.fn(async () => undefined),
    };
    const runWasteConnectionCheck = vi.fn(async (input: { readonly probe: (resolved: { readonly databaseUrl: string }) => Promise<void> }) => {
      await input.probe({ databaseUrl: 'postgres://waste:test@localhost:5432/waste' });
      return {
        status: 'succeeded',
        checkedAt: '2026-05-10T10:05:00.000Z',
      };
    });
    const resolveWasteDataSource = vi.fn(async () => ({
      instanceId: 'instance-1',
      schemaName: 'wm',
      databaseUrl: 'postgres://waste:test@localhost:5432/waste',
      serviceRoleKey: 'service-key',
      projectUrl: 'https://tenant.supabase.co',
      enabled: true,
    }));

    vi.doMock('@sva/server-runtime', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/server-runtime')>();
      return {
        ...actual,
        buildWasteDatabaseUrlAad: vi.fn((instanceId: string) => `db:${instanceId}`),
        buildWasteServiceRoleKeyAad: vi.fn((instanceId: string) => `service:${instanceId}`),
        resolveWasteDataSource,
        runWasteConnectionCheck,
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      createPool: vi.fn(() => pool),
      now: () => new Date('2026-05-10T10:05:00.000Z'),
    });

    const result = await runtime.initializeDataSource('instance-1', {
      operation: 'initialize-data-source',
      targetSchema: 'wm',
    });

    expect(resolveWasteDataSource).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'instance-1',
      })
    );
    expect(runWasteConnectionCheck).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('information_schema.tables'),
      ['wm', expect.any(Array)]
    );
    expect(result.details).toMatchObject({
      operation: 'initialize-data-source',
      mode: 'executed',
      connectionCheck: {
        status: 'succeeded',
      },
      schemaInspection: {
        schemaName: 'wm',
        missingTables: [],
      },
    });
  });

  it('imports tours with recurrence and custom dates in non-dry-run mode', async () => {
    const repository = createRepositoryMock();
    const runtime = await createRuntimeWithRepositoryMock(repository);

    const result = await runtime.importData('instance-1', {
      operation: 'import-data',
      importProfileId: 'waste-management.touren',
      sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dryRun: false,
      blobRef: 'fixture.xlsx',
    });

    expect(repository.upsertWasteTour).toHaveBeenCalledWith({
      id: 'tour-1',
      name: 'Restmüll Nord',
      description: 'Standardtour Nord',
      wasteFractionIds: ['rest', 'bio'],
      recurrence: 'weekly',
      firstDate: '2026-01-10',
      endDate: '2026-12-31',
      customDates: [{ date: '2026-01-10' }, { date: '2026-01-24' }],
      active: true,
    });
    expect(result.details).toMatchObject({
      operation: 'import-data',
      dryRun: false,
      upserts: 1,
    });
  });

  it('reads import workbooks from inline base64 data urls', async () => {
    const repository = createRepositoryMock();
    vi.doMock('@sva/data-repositories', () => ({
      createWasteMasterDataRepository: vi.fn(() => repository),
    }));

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      loadDataSourceRecord: vi.fn(async () => createDataSourceRecord()),
      revealSecret: vi.fn((ciphertext) => (ciphertext ? 'postgres://waste:test@localhost:5432/waste' : undefined)),
      createPool: vi.fn(() => ({
        connect: vi.fn(async () => ({
          query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
          release: vi.fn(),
        })),
        end: vi.fn(async () => undefined),
      })),
    });

    const result = await runtime.importData('instance-1', {
      operation: 'import-data',
      importProfileId: 'waste-management.touren',
      sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dryRun: false,
      blobRef: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${Buffer.from(createMinimalToursWorkbookBytes()).toString('base64')}`,
    });

    expect(repository.upsertWasteTour).toHaveBeenCalledWith({
      id: 'tour-inline',
      name: 'Inline Tour',
      description: undefined,
      wasteFractionIds: ['rest'],
      recurrence: null,
      firstDate: undefined,
      endDate: undefined,
      customDates: undefined,
      active: false,
    });
    expect(result.details).toMatchObject({
      operation: 'import-data',
      dryRun: false,
      upserts: 1,
    });
  });

  it('imports global and tour date shifts in non-dry-run mode', async () => {
    const repository = createRepositoryMock();
    const runtime = await createRuntimeWithRepositoryMock(repository, createDateShiftWorkbookBytes());

    const result = await runtime.importData('instance-1', {
      operation: 'import-data',
      importProfileId: 'waste-management.ausweichtermine',
      sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dryRun: false,
      blobRef: 'fixture.xlsx',
    });

    expect(repository.upsertWasteTourDateShift).toHaveBeenCalledWith({
      id: 'shift-tour',
      tourId: 'tour-1',
      originalDate: '2026-04-03',
      actualDate: '2026-04-04',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'good-friday',
      followUpMode: 'propagate-series',
      description: 'Feiertagsverschiebung',
    });
    expect(repository.upsertWasteGlobalDateShift).toHaveBeenCalledWith({
      id: 'shift-global',
      originalDate: '2026-12-25',
      actualDate: '2026-12-24',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'christmas-day',
      description: 'Globale Feiertagsverschiebung',
      tourIds: ['tour-1', 'tour-2'],
    });
    expect(result.details).toMatchObject({
      operation: 'import-data',
      dryRun: false,
      upserts: 2,
    });
  });

  it('seeds baseline entities through the repository', async () => {
    const repository = createRepositoryMock();
    const runtime = await createRuntimeWithRepositoryMock(repository);

    const result = await runtime.seedData('instance-1', {
      operation: 'seed-data',
      seedKey: 'baseline',
    });

    expect(repository.upsertWasteRegion).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteCity).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteStreet).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteHouseNumber).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteCollectionLocation).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteFraction).toHaveBeenCalledTimes(2);
    expect(repository.upsertWasteTour).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteLocationTourLink).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteTourDateShift).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteGlobalDateShift).toHaveBeenCalledTimes(1);
    expect(result.details).toMatchObject({
      operation: 'seed-data',
      seedKey: 'baseline',
      seededEntityCount: 11,
    });
  });

  it('resets all waste tables and rejects blank confirmation tokens', async () => {
    const query = vi.fn(async (text: string) => ({
      rowCount: text.startsWith('DELETE FROM') ? 1 : 0,
      rows: [],
    }));
    const runtime = createWasteManagementOperationRuntime({
      loadDataSourceRecord: vi.fn(async () => createDataSourceRecord()),
      revealSecret: vi.fn((ciphertext) => (ciphertext ? 'postgres://waste:test@localhost:5432/waste' : undefined)),
      createPool: vi.fn(() => ({
        connect: vi.fn(async () => ({
          query,
          release: vi.fn(),
        })),
        end: vi.fn(async () => undefined),
      })),
    });

    await expect(
      runtime.resetData('instance-1', {
        operation: 'reset-data',
        confirmationToken: '   ',
      })
    ).rejects.toThrowError('missing_reset_confirmation_token');

    const result = await runtime.resetData('instance-1', {
      operation: 'reset-data',
      confirmationToken: 'confirm-reset',
    });

    expect(query).toHaveBeenCalledWith('DELETE FROM waste_location_tour_links;');
    expect(query).toHaveBeenCalledWith('DELETE FROM waste_regions;');
    expect(result.details).toMatchObject({
      operation: 'reset-data',
      confirmationTokenLength: 13,
    });
  });
});

const requiredTableRows = [
  { table_name: 'waste_cities' },
  { table_name: 'waste_collection_locations' },
  { table_name: 'waste_fractions' },
  { table_name: 'waste_global_date_shifts' },
  { table_name: 'waste_house_numbers' },
  { table_name: 'waste_location_tour_links' },
  { table_name: 'waste_regions' },
  { table_name: 'waste_streets' },
  { table_name: 'waste_tour_date_shifts' },
  { table_name: 'waste_tours' },
];

const createImportWorkbookBytes = (): Uint8Array => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['region_id', 'region_name', 'city_id', 'city_name', 'location_id', 'active'],
    ['00000000-0000-4000-8000-000000000101', 'Nord', '00000000-0000-4000-8000-000000000102', 'Musterstadt', '00000000-0000-4000-8000-000000000103', 'true'],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Import');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

const createToursWorkbookBytes = (): Uint8Array => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['tour_id', 'tour_name', 'waste_fraction_ids', 'active', 'description', 'recurrence', 'first_date', 'end_date', 'custom_dates'],
    ['tour-1', 'Restmüll Nord', 'rest|bio', 'yes', 'Standardtour Nord', 'weekly', '2026-01-10', '2026-12-31', '2026-01-10|2026-01-24'],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Import');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

const createDateShiftWorkbookBytes = (): Uint8Array => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['shift_id', 'shift_context', 'original_date', 'actual_date', 'has_year', 'tour_id', 'description', 'tour_ids', 'reason_type', 'reason_key', 'follow_up_mode'],
    ['shift-tour', 'tour', '2026-04-03', '2026-04-04', 'true', 'tour-1', 'Feiertagsverschiebung', '', 'holiday', 'good-friday', 'propagate-series'],
    ['shift-global', 'global', '2026-12-25', '2026-12-24', '1', '', 'Globale Feiertagsverschiebung', 'tour-1|tour-2', 'holiday', 'christmas-day', ''],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Import');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

const createMinimalToursWorkbookBytes = (): Uint8Array => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['tour_id', 'tour_name', 'waste_fraction_ids', 'active'],
    ['tour-inline', 'Inline Tour', 'rest', 'false'],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Import');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

const createRepositoryMock = () => ({
  upsertWasteRegion: vi.fn(async () => undefined),
  upsertWasteCity: vi.fn(async () => undefined),
  upsertWasteStreet: vi.fn(async () => undefined),
  upsertWasteHouseNumber: vi.fn(async () => undefined),
  upsertWasteCollectionLocation: vi.fn(async () => undefined),
  upsertWasteFraction: vi.fn(async () => undefined),
  upsertWasteTour: vi.fn(async () => undefined),
  upsertWasteLocationTourLink: vi.fn(async () => undefined),
  upsertWasteTourDateShift: vi.fn(async () => undefined),
  upsertWasteGlobalDateShift: vi.fn(async () => undefined),
});

const createRuntimeWithRepositoryMock = async (
  repository: ReturnType<typeof createRepositoryMock>,
  workbookBytes: Uint8Array = createToursWorkbookBytes()
) => {
  vi.doMock('@sva/data-repositories', () => ({
    createWasteMasterDataRepository: vi.fn(() => repository),
  }));

  const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
  return createRuntime({
    loadDataSourceRecord: vi.fn(async () => createDataSourceRecord()),
    revealSecret: vi.fn((ciphertext) => (ciphertext ? 'postgres://waste:test@localhost:5432/waste' : undefined)),
    createPool: vi.fn(() => ({
      connect: vi.fn(async () => ({
        query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
        release: vi.fn(),
      })),
      end: vi.fn(async () => undefined),
    })),
    readBinarySource: vi.fn(async () => workbookBytes),
  });
};
