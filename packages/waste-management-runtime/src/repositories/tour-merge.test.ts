import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WasteTourRecord } from '@sva/waste-management-contracts';
import type { QueryClient } from './address-mutation-shared.js';
import { processWasteTourMerge } from './tour-merge.js';

const repository = vi.hoisted(() => ({
  listWasteTours: vi.fn<() => Promise<WasteTourRecord[]>>(),
  listWasteTourDateShifts: vi.fn(async () => []),
  listWasteGlobalDateShifts: vi.fn(async () => []),
  listWasteHolidayRules: vi.fn(async () => []),
  updateWasteTourStatusBulk: vi.fn(async () => 1),
}));

vi.mock('./master-data.js', () => ({
  createWasteMasterDataRepository: () => repository,
}));

const sourceId = 'source-tour';
const targetId = 'target-tour';
const input = { tourIds: [sourceId, targetId], targetTourId: targetId };

const tour = (id: string): WasteTourRecord => ({
  id,
  name: id,
  status: 'published',
  wasteFractionIds: ['fraction-1'],
  recurrence: 'weekly',
  firstDate: '2027-01-04',
  endDate: '2027-12-31',
  createdAt: '2026-11-26T12:00:00Z',
  updatedAt: '2026-11-26T12:00:00Z',
});

const createClient = (insertedCount = 1) => {
  const query = vi.fn<QueryClient['query']>().mockImplementation(async (sql) => {
    if (sql.startsWith('SELECT id, tour_id, location_id')) {
      return {
        rowCount: 3,
        rows: [
          { id: 'link-1', tour_id: targetId, location_id: 'shared' },
          { id: 'link-2', tour_id: sourceId, location_id: 'shared' },
          { id: 'link-3', tour_id: sourceId, location_id: 'additional' },
        ],
      };
    }
    if (sql.includes("concat_ws(' / '")) {
      return { rowCount: 1, rows: [{ label: 'Ort / Straße / 1' }] };
    }
    if (sql.includes('INSERT INTO waste_location_tour_links')) {
      return { rowCount: insertedCount, rows: [] };
    }
    if (
      /^(BEGIN\b|COMMIT$|ROLLBACK$|SET LOCAL statement_timeout\b|LOCK TABLE\b)/.test(sql) ||
      sql.includes('FROM waste_tour_assignments')
    ) {
      return { rowCount: 0, rows: [] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  });

  const client: QueryClient = {
    async query<TRow>(...args: Parameters<QueryClient['query']>) {
      const { rowCount, rows } = await query(...args);
      return { rowCount, rows: rows as readonly TRow[] };
    },
  };

  return { client, query };
};

const loadPreview = async ({ client }: ReturnType<typeof createClient>) => {
  const result = await processWasteTourMerge(client, input);
  if (result?.kind !== 'preview') throw new Error('Expected a merge preview');
  return result.preview;
};

describe('processWasteTourMerge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.listWasteTours.mockResolvedValue([tour(sourceId), tour(targetId)]);
  });

  it('previews shared and newly added collection points without making changes', async () => {
    const client = createClient();

    await expect(loadPreview(client)).resolves.toMatchObject({
      addedCount: 1,
      totalCount: 2,
      sharedCount: 1,
      sharedLocationLabel: 'Ort / Straße / 1',
      conflicts: [],
    });
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
    );
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(repository.updateWasteTourStatusBulk).not.toHaveBeenCalled();
  });

  it('inserts only missing links and archives only the source after confirmation', async () => {
    const { token } = await loadPreview(createClient());
    const client = createClient();

    await expect(
      processWasteTourMerge(client.client, { ...input, confirmationToken: token })
    ).resolves.toEqual({ kind: 'merged', totalCount: 2, archivedCount: 1 });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO waste_location_tour_links'),
      [['additional'], targetId]
    );
    expect(repository.updateWasteTourStatusBulk).toHaveBeenCalledExactlyOnceWith({
      tourIds: [sourceId],
      status: 'archived',
    });
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rejects confirmation when the schedule has changed since the preview', async () => {
    const { token } = await loadPreview(createClient());
    repository.listWasteTours.mockResolvedValue([
      { ...tour(sourceId), firstDate: '2027-01-11' },
      { ...tour(targetId), firstDate: '2027-01-11' },
    ]);
    const client = createClient();

    await expect(loadPreview(createClient())).resolves.toMatchObject({ conflicts: [] });
    await expect(
      processWasteTourMerge(client.client, { ...input, confirmationToken: token })
    ).resolves.toEqual({ kind: 'stale' });
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(repository.updateWasteTourStatusBulk).not.toHaveBeenCalled();
  });

  it('rolls back the merge when the number of inserted links differs from the preview', async () => {
    const { token } = await loadPreview(createClient());
    const client = createClient(0);

    await expect(
      processWasteTourMerge(client.client, { ...input, confirmationToken: token })
    ).resolves.toEqual({ kind: 'rolled-back' });
    expect(repository.updateWasteTourStatusBulk).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  });
});
