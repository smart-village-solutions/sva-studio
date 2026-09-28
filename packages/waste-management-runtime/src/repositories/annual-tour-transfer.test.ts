import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listWasteTours: vi.fn<() => Promise<readonly unknown[]>>(),
  listWasteLocationTourLinks: vi.fn<() => Promise<readonly unknown[]>>(),
  listWasteLocationTourPickupDates: vi.fn<() => Promise<readonly unknown[]>>(),
  listWasteTourAssignments: vi.fn<() => Promise<readonly unknown[]>>(),
  listWasteTourDateShifts: vi.fn<() => Promise<readonly unknown[]>>(),
  buildPreview: vi.fn(),
  fingerprint: vi.fn(),
  writeMappedTours: vi.fn(),
}));

vi.mock('./master-data.js', () => ({
  createWasteMasterDataRepository: () => ({
    listWasteTours: mocks.listWasteTours,
    listWasteLocationTourLinks: mocks.listWasteLocationTourLinks,
    listWasteLocationTourPickupDates: mocks.listWasteLocationTourPickupDates,
    listWasteTourAssignments: mocks.listWasteTourAssignments,
    listWasteTourDateShifts: mocks.listWasteTourDateShifts,
  }),
}));

vi.mock('./annual-tour-transfer-write.js', () => ({
  writeWasteAnnualMappedTours: mocks.writeMappedTours,
}));

vi.mock('@sva/waste-management-contracts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/waste-management-contracts')>()),
  buildWasteAnnualTourTransferPreview: mocks.buildPreview,
  buildWasteAnnualTourTransferFingerprint: mocks.fingerprint,
  toWasteAnnualTourTransferPublicPreview: (preview: unknown) => preview,
}));

import {
  createWasteAnnualTourTransferInTransaction,
  loadWasteAnnualTourTransferSource,
} from './annual-tour-transfer.js';

const sourceTourId = '11111111-1111-4111-8111-111111111111';
const targetTourId = '22222222-2222-4222-8222-222222222222';
const targetTour = {
  id: targetTourId,
  name: 'Bio Nord',
  wasteFractionIds: ['bio'],
  recurrence: 'weekly',
  firstDate: '2027-01-04',
  endDate: '2027-12-31',
  customDates: [],
  status: 'draft',
  locationCount: 1,
};
const mappedTour = {
  sourceTourId,
  targetTour,
  locationTourLinks: [{ id: 'link-1', tourId: targetTourId, locationId: 'location-1' }],
  locationTourPickupDates: [],
  tourAssignments: [],
  tourDateShifts: [],
};

const preview = (overrides: Record<string, unknown> = {}) => ({
  sourceYear: 2026,
  targetYear: 2027,
  previewFingerprint: 'preview-1',
  tours: [
    {
      sourceTourId,
      classification: 'transferable',
      mappedTour,
      conflicts: [],
    },
  ],
  summary: { transferable: 1, alreadyEffective: 0, blocked: 0 },
  ...overrides,
});

const createInput = (overrides: Record<string, unknown> = {}) => ({
  client: { query: vi.fn(async () => ({ rowCount: null, rows: [] })) },
  instanceId: 'tenant-a',
  create: {
    sourceYear: 2026,
    selectedTourIds: [sourceTourId],
    replacementDates: [],
    acknowledgedConflictTourIds: [],
    previewFingerprint: 'preview-1',
    ...overrides,
  },
  currentYear: 2026,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listWasteTours.mockResolvedValue([]);
  mocks.listWasteLocationTourLinks.mockResolvedValue([]);
  mocks.listWasteLocationTourPickupDates.mockResolvedValue([]);
  mocks.listWasteTourAssignments.mockResolvedValue([]);
  mocks.listWasteTourDateShifts.mockResolvedValue([]);
  mocks.buildPreview.mockResolvedValue(preview());
  mocks.fingerprint.mockResolvedValue('same');
  mocks.writeMappedTours.mockResolvedValue(undefined);
});

describe('annual tour transfer transaction', () => {
  it('loads the complete source snapshot before previewing', async () => {
    const repository = {
      listWasteTours: mocks.listWasteTours,
      listWasteLocationTourLinks: mocks.listWasteLocationTourLinks,
      listWasteLocationTourPickupDates: mocks.listWasteLocationTourPickupDates,
      listWasteTourAssignments: mocks.listWasteTourAssignments,
      listWasteTourDateShifts: mocks.listWasteTourDateShifts,
    };
    await expect(
      loadWasteAnnualTourTransferSource(
        repository as Parameters<typeof loadWasteAnnualTourTransferSource>[0]
      )
    ).resolves.toEqual({
      tours: [],
      locationTourLinks: [],
      locationTourPickupDates: [],
      tourAssignments: [],
      tourDateShifts: [],
    });
    expect(mocks.listWasteTours).toHaveBeenCalledOnce();
    expect(mocks.listWasteTourDateShifts).toHaveBeenCalledOnce();
  });

  it('locks the target year and commits only after writing the selected mapped tours', async () => {
    const input = createInput();
    const result = await createWasteAnnualTourTransferInTransaction(input);
    expect(input.client.query).toHaveBeenCalledWith('BEGIN');
    expect(input.client.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));',
      ['tenant-a', 'waste-annual-tour-transfer:2027']
    );
    expect(input.client.query).toHaveBeenCalledWith(expect.stringContaining('LOCK TABLE'));
    expect(mocks.writeMappedTours).toHaveBeenCalledWith(input.client, expect.anything(), [
      mappedTour,
    ]);
    expect(input.client.query).toHaveBeenCalledWith('COMMIT');
    expect(result).toMatchObject({
      sourceYear: 2026,
      targetYear: 2027,
      createdTourIds: [targetTourId],
      createdCount: 1,
      existingCount: 0,
      listTarget: { tourValidityPeriod: 'next', status: 'draft' },
    });
  });

  it('treats an identical existing target as idempotent without writing it again', async () => {
    mocks.listWasteTours.mockResolvedValue([{ ...targetTour, createdAt: 'now', updatedAt: 'now' }]);
    mocks.listWasteLocationTourLinks.mockResolvedValue([
      { ...mappedTour.locationTourLinks[0], createdAt: 'now', updatedAt: 'now' },
    ]);
    const input = createInput();
    const result = await createWasteAnnualTourTransferInTransaction(input);
    expect(mocks.fingerprint).toHaveBeenCalledTimes(2);
    expect(mocks.writeMappedTours).toHaveBeenCalledWith(input.client, expect.anything(), []);
    expect(result).toMatchObject({
      existingTourIds: [targetTourId],
      createdCount: 0,
      existingCount: 1,
    });
    expect(input.client.query).toHaveBeenCalledWith('COMMIT');
  });

  it.each([
    [
      'preview_stale',
      () => mocks.buildPreview.mockResolvedValue(preview({ previewFingerprint: 'new-preview' })),
    ],
    [
      'invalid_transfer_selection',
      () => mocks.buildPreview.mockResolvedValue(preview({ tours: [] })),
    ],
    [
      'unacknowledged_target_conflict',
      () =>
        mocks.buildPreview.mockResolvedValue(
          preview({
            tours: [
              {
                sourceTourId,
                classification: 'transferable',
                mappedTour,
                conflicts: [{ kind: 'possible-parallel-planning' }],
              },
            ],
          })
        ),
    ],
  ])('rolls back %s before writing', async (reason, configure) => {
    configure();
    const input = createInput();
    await expect(createWasteAnnualTourTransferInTransaction(input)).rejects.toThrow(reason);
    expect(mocks.writeMappedTours).not.toHaveBeenCalled();
    expect(input.client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(input.client.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('rejects an existing target with a changed identity and rolls back', async () => {
    mocks.listWasteTours.mockResolvedValue([{ ...targetTour, createdAt: 'now', updatedAt: 'now' }]);
    mocks.fingerprint.mockResolvedValueOnce('current').mockResolvedValueOnce('expected');
    const input = createInput();
    await expect(createWasteAnnualTourTransferInTransaction(input)).rejects.toThrow(
      'target_identity_conflict'
    );
    expect(mocks.writeMappedTours).not.toHaveBeenCalled();
    expect(input.client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rolls back if the set-based write fails', async () => {
    mocks.writeMappedTours.mockRejectedValue(new Error('write failed'));
    const input = createInput();
    await expect(createWasteAnnualTourTransferInTransaction(input)).rejects.toThrow('write failed');
    expect(input.client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(input.client.query).not.toHaveBeenCalledWith('COMMIT');
  });
});
