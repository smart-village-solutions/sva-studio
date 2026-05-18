import { describe, expect, it, vi } from 'vitest';

import { loadNextPublicWasteSelection, loadResolvedPublicWasteCalendar } from './public-waste-api.js';

describe('public waste api', () => {
  it('loads the next selection step from the repository and resolves it locally', async () => {
    const repository = {
      listSelectionOptions: vi.fn().mockResolvedValue({
        step: 'city',
        options: [{ id: 'c-1', label: 'Musterstadt' }],
      }),
      loadCalendarEntries: vi.fn(),
    };

    await expect(
      loadNextPublicWasteSelection({
        repository,
        input: {
          selection: { regionId: 'r-1' },
        },
      })
    ).resolves.toEqual({
      step: 'city',
      status: 'incomplete',
      options: [{ id: 'c-1', label: 'Musterstadt' }],
    });
  });

  it('projects calendar entries after the location is fully resolved', async () => {
    const repository = {
      listSelectionOptions: vi.fn(),
      loadCalendarEntries: vi.fn().mockResolvedValue([
        {
          id: 'pickup-1',
          date: '2026-05-19',
          fractionId: 'bio',
          fractionLabel: 'Bioabfall',
          note: null,
        },
      ]),
    };

    await expect(
      loadResolvedPublicWasteCalendar({
        repository,
        input: {
          selection: {
            regionId: 'r-1',
            cityId: 'c-1',
            streetId: 's-1',
            houseNumberId: 'h-1',
          },
          referenceDate: '2026-05-18',
        },
      })
    ).resolves.toMatchObject({
      locationKey: 'r-1:c-1:s-1:h-1',
      nextPickupDate: '2026-05-19',
    });
  });
});
