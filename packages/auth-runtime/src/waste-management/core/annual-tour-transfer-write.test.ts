import { describe, expect, it, vi } from 'vitest';

import type { WasteAnnualTourTransferMappedTour } from '@sva/core';
import type { WasteMasterDataRepository } from '@sva/data-repositories';

import { writeWasteAnnualMappedTours } from './annual-tour-transfer-write.js';

const mappedTour = (index: number): WasteAnnualTourTransferMappedTour => ({
  sourceTourId: `source-${index}`,
  targetTour: {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Tour ${index}`,
    wasteFractionIds: ['bio'],
    recurrence: 'weekly',
    firstDate: '2027-01-04',
    endDate: '2027-12-31',
    customDates: [],
    active: false,
  },
  locationTourLinks: [],
  locationTourPickupDates: [],
  tourAssignments: [],
  tourDateShifts: [],
});

describe('writeWasteAnnualMappedTours', () => {
  it('writes the supported 1,000 tours in one set-based database round trip', async () => {
    const query = vi.fn(async () => undefined);
    const repository = {
      upsertWasteTour: vi.fn(async () => undefined),
    } as unknown as WasteMasterDataRepository;

    await writeWasteAnnualMappedTours(
      { query },
      repository,
      Array.from({ length: 1_000 }, (_, index) => mappedTour(index))
    );

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain('INSERT INTO waste_tours');
    expect(JSON.parse(query.mock.calls[0]?.[1]?.[0] as string)).toHaveLength(1_000);
    expect(repository.upsertWasteTour).not.toHaveBeenCalled();
  });
});
