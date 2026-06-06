import { describe, expect, it, vi } from 'vitest';

import { createPublicWasteRepository } from './public-waste-repository.server.js';

describe('public waste repository', () => {
  it('lists only the next valid step options for a partially selected location', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'r-1', label: 'Prignitz' }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 's-1', label: 'Hauptstraße', is_catch_all: false }],
      });

    const repository = createPublicWasteRepository({
      schemaName: 'waste',
      execute,
    });

    await expect(
      repository.listSelectionOptions({
        selection: { regionId: 'r-1', cityId: 'c-1' },
      })
    ).resolves.toMatchObject({
      step: 'street',
      options: [{ id: 's-1', label: 'Hauptstraße' }],
    });
  });

  it('surfaces the catch-all street option for city-wide collection locations', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'r-1', label: 'Prignitz' }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'all', label: 'Alle Straßen', is_catch_all: true }],
      });

    const repository = createPublicWasteRepository({
      schemaName: 'waste',
      execute,
    });

    await expect(
      repository.listSelectionOptions({
        selection: { regionId: 'r-1', cityId: 'c-1' },
      })
    ).resolves.toMatchObject({
      step: 'street',
      options: [{ id: 'all', label: 'Alle Straßen' }],
    });

    expect(execute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("SELECT DISTINCT *"),
      })
    );
  });

  it('includes street-wide collection locations when a specific house number is selected', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            link_id: 'link-1',
            location_id: 'location-1',
            link_start_date: '2026-01-01',
            link_end_date: null,
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Leerung fuer den Innenstadtbereich.',
            tour_recurrence: 'weekly',
            tour_custom_recurrence_interval_days: null,
            tour_first_date: '2026-01-07',
            tour_end_date: null,
            tour_custom_dates: null,
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_color: '#111111',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const repository = createPublicWasteRepository({
      schemaName: 'waste',
      execute,
    });

    await repository.loadCalendarEntries({
      selection: {
        cityId: 'city-1',
        streetId: 'street-1',
        regionId: 'region-1',
        houseNumberId: 'house-1',
      },
      referenceDate: '2026-05-19',
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('cl.house_number_id IS NULL OR cl.house_number_id = $5::uuid'),
      })
    );
  });

  it('includes all-street and all-region collection locations for concrete selections', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            link_id: 'link-1',
            location_id: 'location-1',
            link_start_date: '2026-01-01',
            link_end_date: null,
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Leerung fuer den Innenstadtbereich.',
            tour_recurrence: 'weekly',
            tour_custom_recurrence_interval_days: null,
            tour_first_date: '2026-01-07',
            tour_end_date: null,
            tour_custom_dates: null,
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_color: '#111111',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const repository = createPublicWasteRepository({
      schemaName: 'waste',
      execute,
    });

    await repository.loadCalendarEntries({
      selection: {
        cityId: 'city-1',
        streetId: 'street-1',
        regionId: 'region-1',
      },
      referenceDate: '2026-05-19',
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("cl.region_id IS NULL OR cl.region_id = $4::uuid"),
      })
    );
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("cl.street_id IS NULL OR cl.street_id = $3::uuid"),
      })
    );
  });

  it('projects the public tour description into returned calendar entries', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            link_id: 'link-1',
            location_id: 'location-1',
            link_start_date: '2026-01-01',
            link_end_date: null,
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Leerung fuer den Innenstadtbereich.',
            tour_recurrence: 'weekly',
            tour_custom_recurrence_interval_days: null,
            tour_first_date: '2026-05-20',
            tour_end_date: '2026-05-20',
            tour_custom_dates: null,
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_color: '#111111',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const repository = createPublicWasteRepository({
      schemaName: 'waste',
      execute,
    });

    await expect(
      repository.loadCalendarEntries({
        selection: {
          cityId: 'city-1',
          streetId: 'street-1',
        },
        referenceDate: '2026-05-19',
      })
    ).resolves.toContainEqual(
      expect.objectContaining({
        tourName: 'Restmuell',
        tourDescription: 'Leerung fuer den Innenstadtbereich.',
      })
    );
  });

  it('prefers exact street matches over catch-all rows for selection summaries', async () => {
    const execute = vi.fn().mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ city_label: 'Rathenow', street_label: 'Hauptstraße', house_number_label: null }],
    });

    const repository = createPublicWasteRepository({
      schemaName: 'waste',
      execute,
    });

    await expect(
      repository.loadSelectionSummary({
        selection: {
          cityId: 'city-1',
          streetId: 'street-1',
        },
      })
    ).resolves.toBe('Rathenow, Hauptstraße');

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('CASE WHEN cl.street_id = $3::uuid THEN 0 ELSE 1 END ASC'),
      })
    );
  });
});
