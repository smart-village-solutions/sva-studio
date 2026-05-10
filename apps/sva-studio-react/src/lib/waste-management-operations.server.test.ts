import { describe, expect, it, vi } from 'vitest';

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
