import {
  serializeWasteManagementDataExchangeJson,
  type ExternalInterfaceRecord,
  type WasteManagementDataExchangeRecord,
} from '@sva/core';
import { createHash } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  importCanonicalWasteManagementJson,
  importCanonicalWasteManagementPackage,
} from './waste-management-operations.data-exchange-import.server.js';
import { applySchemaStatements } from './waste-management-operations.schema.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const databaseUrl = process.env.WASTE_DATA_EXCHANGE_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('WASTE_DATA_EXCHANGE_TEST_DATABASE_URL is required for this integration test');
}

const instanceId = 'waste-data-exchange-integration';
const emptyDatabaseFractionId = '10000000-0000-4000-8000-000000000101';
const prefilledDatabaseFractionId = '10000000-0000-4000-8000-000000000102';
const rolledBackFractionId = '10000000-0000-4000-8000-000000000103';
const invalidTourId = '20000000-0000-4000-8000-000000000101';
const missingFractionId = '10000000-0000-4000-8000-000000000199';

const pool = new Pool({ connectionString: databaseUrl, max: 2 });

const interfaceRecord: ExternalInterfaceRecord = {
  id: 'waste-data-exchange-interface',
  instanceId,
  typeKey: 'postgresql',
  ownerKind: 'host',
  ownerId: 'host',
  displayName: 'Waste PostgreSQL integration test',
  alias: 'default',
  enabled: true,
  isDefault: true,
  category: 'database',
  authMode: 'database_url',
  publicConfig: { schemaName: 'public' },
  secretConfigCiphertext: 'integration-test-secret',
  statusCheckKind: 'postgresql',
  visibleStatus: 'ok',
  updatedAt: '2026-08-24T00:00:00.000Z',
};

const createDeps = (body: Uint8Array): WasteOperationRuntimeDeps => ({
  loadDefaultInterfaceRecord: async () => interfaceRecord,
  loadProvisioning: async () => null,
  revealSecret: () => JSON.stringify({ databaseUrl }),
  readBinarySource: async () => body,
});

const jsonBody = (input: Readonly<{
  profileId: 'waste-management.fraktionen' | 'waste-management.touren';
  records: readonly WasteManagementDataExchangeRecord[];
}>): Uint8Array =>
  strToU8(serializeWasteManagementDataExchangeJson({
    profileId: input.profileId,
    exportedAt: '2026-08-24T00:00:00.000Z',
    records: input.records,
  }));

const packageBody = (files: Readonly<Record<string, Readonly<{
  profileId: 'waste-management.fraktionen' | 'waste-management.touren';
  body: Uint8Array;
}>>>): Uint8Array => {
  const profiles = Object.entries(files).map(([fileName, file]) => ({
    profileId: file.profileId,
    fileName,
    sha256: createHash('sha256').update(file.body).digest('hex'),
  }));
  return zipSync({
    'manifest.json': strToU8(JSON.stringify({
      formatVersion: '1.0.0',
      pluginId: 'waste-management',
      profiles,
    })),
    ...Object.fromEntries(Object.entries(files).map(([fileName, file]) => [fileName, file.body])),
  });
};

describe('Waste data exchange against PostgreSQL', () => {
  beforeAll(async () => {
    for (const statement of applySchemaStatements('public')) {
      await pool.query(statement);
    }
  }, 60_000);

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE waste_fractions CASCADE;');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('imports canonical data into an empty Waste database', async () => {
    const body = jsonBody({
      profileId: 'waste-management.fraktionen',
      records: [{
        entityType: 'fraction',
        id: emptyDatabaseFractionId,
        name: 'Bioabfall',
        pdfShortLabel: 'BIO',
        color: '#228833',
      }],
    });

    const result = await importCanonicalWasteManagementJson({
      deps: createDeps(body),
      instanceId,
      profileId: 'waste-management.fraktionen',
      blobRef: 'integration:test',
      dryRun: false,
    });

    expect(result.details).toMatchObject({ created: 1, updated: 0, unchanged: 0 });
    const stored = await pool.query<{ name: string; active: boolean }>(
      'SELECT name, active FROM waste_fractions WHERE id = $1::uuid;',
      [emptyDatabaseFractionId]
    );
    expect(stored.rows).toEqual([{ name: 'Bioabfall', active: true }]);
  });

  it('updates canonical data in a prefilled Waste database without replacing omitted values', async () => {
    await pool.query(
      `INSERT INTO waste_fractions (id, name, pdf_short_label, color, description, active)
       VALUES ($1::uuid, 'Altpapier', 'PPK', '#112233', 'bestehend', false);`,
      [prefilledDatabaseFractionId]
    );
    const body = strToU8(JSON.stringify({
      formatVersion: '1.0.0',
      pluginId: 'waste-management',
      profileId: 'waste-management.fraktionen',
      exportedAt: '2026-08-24T00:00:00.000Z',
      records: [{
        entityType: 'fraction',
        id: prefilledDatabaseFractionId,
        name: 'Papier',
        pdfShortLabel: 'PAP',
        color: '#334455',
      }],
    }));

    const result = await importCanonicalWasteManagementJson({
      deps: createDeps(body),
      instanceId,
      profileId: 'waste-management.fraktionen',
      blobRef: 'integration:test',
      dryRun: false,
    });

    expect(result.details).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
    const stored = await pool.query<{
      name: string;
      pdf_short_label: string;
      color: string;
      description: string;
      active: boolean;
    }>(
      'SELECT name, pdf_short_label, color, description, active FROM waste_fractions WHERE id = $1::uuid;',
      [prefilledDatabaseFractionId]
    );
    expect(stored.rows).toEqual([{
      name: 'Papier',
      pdf_short_label: 'PAP',
      color: '#334455',
      description: 'bestehend',
      active: false,
    }]);
  });

  it('rolls back earlier profile writes when a later package profile is invalid', async () => {
    const fractions = jsonBody({
      profileId: 'waste-management.fraktionen',
      records: [{
        entityType: 'fraction',
        id: rolledBackFractionId,
        name: 'Restabfall',
        pdfShortLabel: 'RES',
        color: '#222222',
      }],
    });
    const tours = jsonBody({
      profileId: 'waste-management.touren',
      records: [{
        entityType: 'tour',
        id: invalidTourId,
        name: 'Ungültige Tour',
        wasteFractionIds: [missingFractionId],
      }],
    });
    const body = packageBody({
      'fraktionen.json': { profileId: 'waste-management.fraktionen', body: fractions },
      'touren.json': { profileId: 'waste-management.touren', body: tours },
    });

    await expect(importCanonicalWasteManagementPackage({
      deps: createDeps(body),
      instanceId,
      blobRef: 'integration:test-package',
      dryRun: false,
    })).rejects.toThrow('missing_waste_data_reference');

    const stored = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM waste_fractions WHERE id = $1::uuid;',
      [rolledBackFractionId]
    );
    expect(stored.rows).toEqual([{ count: '0' }]);
  });
});
