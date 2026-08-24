import { buildWasteAnnualTourTransferPreview, type WasteAnnualTourTransferSource } from '@sva/core';
import { createWasteMasterDataRepository } from '@sva/data-repositories';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createWasteAnnualTourTransferInTransaction } from '../../../../packages/auth-runtime/src/waste-management/server-loaders.js';
import { applySchemaStatements } from './waste-management-operations.schema.js';
import { createSqlExecutor } from './waste-management-operations.shared.js';

const sourceTourId = '71000000-0000-4000-8000-000000000001';
const staleSourceTourId = '71000000-0000-4000-8000-000000000002';
const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('WASTE_DATE_SHIFT_TEST_DATABASE_URL is required for this integration test');
}

const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const repository = createWasteMasterDataRepository(createSqlExecutor(pool));

const loadSource = async (): Promise<WasteAnnualTourTransferSource> => {
  const [tours, locationTourLinks, locationTourPickupDates, tourAssignments, tourDateShifts] =
    await Promise.all([
      repository.listWasteTours(),
      repository.listWasteLocationTourLinks(),
      repository.listWasteLocationTourPickupDates(),
      repository.listWasteTourAssignments(),
      repository.listWasteTourDateShifts(),
    ]);
  return { tours, locationTourLinks, locationTourPickupDates, tourAssignments, tourDateShifts };
};

const previewTour = async (tourId: string) => {
  const source = await loadSource();
  const preview = await buildWasteAnnualTourTransferPreview({
    instanceId: 'postgres-integration',
    sourceYear: 2026,
    currentYear: 2026,
    source,
    target: source,
    selectedTourIds: [tourId],
  });
  const mappedTour = preview.tours.find((tour) => tour.sourceTourId === tourId)?.mappedTour;
  expect(mappedTour).toBeDefined();
  return { preview, mappedTour };
};

describe('Waste annual tour transfer against PostgreSQL', () => {
  beforeAll(async () => {
    for (const statement of applySchemaStatements('public')) await pool.query(statement);
    await repository.upsertWasteTour({
      id: sourceTourId,
      name: 'Jahrestour Integration',
      wasteFractionIds: ['bio'],
      recurrence: 'weekly',
      firstDate: '2026-01-05',
      endDate: '2026-12-31',
      active: true,
    });
    await repository.upsertWasteTour({
      id: staleSourceTourId,
      name: 'Jahrestour Rollback',
      wasteFractionIds: ['rest'],
      recurrence: 'biweekly',
      firstDate: '2026-01-12',
      endDate: '2026-12-31',
      active: true,
    });
  }, 60_000);

  afterAll(async () => {
    await pool.end();
  });

  it('commits an inactive following-year tour atomically and replays its stable identity', async () => {
    const { preview, mappedTour } = await previewTour(sourceTourId);
    const create = {
      sourceYear: 2026,
      selectedTourIds: [sourceTourId],
      acknowledgedConflictTourIds: [],
      replacementDates: [],
      previewFingerprint: preview.previewFingerprint,
    } as const;

    const firstClient = await pool.connect();
    try {
      await expect(
        createWasteAnnualTourTransferInTransaction({
          client: firstClient,
          instanceId: 'postgres-integration',
          create,
          currentYear: 2026,
        })
      ).resolves.toMatchObject({ createdCount: 1, existingCount: 0 });
    } finally {
      firstClient.release();
    }

    await expect(
      repository.getWasteTourById(mappedTour?.targetTour.id as string)
    ).resolves.toMatchObject({
      active: false,
      firstDate: mappedTour?.targetTour.firstDate,
      endDate: '2027-12-31',
    });

    const replay = await previewTour(sourceTourId);
    const replayClient = await pool.connect();
    try {
      await expect(
        createWasteAnnualTourTransferInTransaction({
          client: replayClient,
          instanceId: 'postgres-integration',
          create: { ...create, previewFingerprint: replay.preview.previewFingerprint },
          currentYear: 2026,
        })
      ).resolves.toMatchObject({ createdCount: 0, existingCount: 1 });
    } finally {
      replayClient.release();
    }
  });

  it('rolls the transaction back when the confirmed preview is stale', async () => {
    const { mappedTour } = await previewTour(staleSourceTourId);
    const client = await pool.connect();
    try {
      await expect(
        createWasteAnnualTourTransferInTransaction({
          client,
          instanceId: 'postgres-integration',
          create: {
            sourceYear: 2026,
            selectedTourIds: [staleSourceTourId],
            acknowledgedConflictTourIds: [],
            replacementDates: [],
            previewFingerprint: 'stale-preview',
          },
          currentYear: 2026,
        })
      ).rejects.toThrow(/^preview_stale:/u);
    } finally {
      client.release();
    }

    await expect(
      repository.getWasteTourById(mappedTour?.targetTour.id as string)
    ).resolves.toBeNull();
  });
});
