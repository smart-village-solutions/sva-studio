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
        text: expect.stringContaining('SELECT DISTINCT *'),
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
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
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
        text: expect.stringContaining(
          'cl.house_number_id IS NULL OR cl.house_number_id = $5::uuid'
        ),
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
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
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
        text: expect.stringContaining('cl.region_id IS NULL OR cl.region_id = $4::uuid'),
      })
    );
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('cl.street_id IS NULL OR cl.street_id = $3::uuid'),
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
            fraction_description: 'Restabfall aus privaten Haushalten.',
            fraction_color: '#111111',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
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
        fractionDescription: 'Restabfall aus privaten Haushalten.',
        tourName: 'Restmuell',
        tourDescription: 'Leerung fuer den Innenstadtbereich.',
      })
    );
  });

  it('returns past entries back to the start of the previous year when available', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            link_id: 'link-1',
            location_id: 'location-1',
            tour_id: 'tour-1',
            tour_name: 'Papiertour',
            tour_description: null,
            tour_recurrence: null,
            tour_custom_recurrence_interval_days: null,
            tour_first_date: null,
            tour_end_date: null,
            tour_custom_dates: [{ date: '2025-01-08' }],
            fraction_id: 'fraction-1',
            fraction_label: 'Papier',
            fraction_color: '#0000FF',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
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
        referenceDate: '2026-12-31',
      })
    ).resolves.toContainEqual(
      expect.objectContaining({
        id: 'tour-1:2025-01-08:fraction-1',
        date: '2025-01-08',
        fractionLabel: 'Papier',
      })
    );
  });

  it('adds explicit tour assignments when a tour has no reconstructable recurrence dates', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            link_id: 'link-1',
            location_id: 'location-1',
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Importierte Sammeltermine.',
            tour_recurrence: 'on-demand',
            tour_custom_recurrence_interval_days: null,
            tour_first_date: null,
            tour_end_date: null,
            tour_custom_dates: null,
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_pdf_short_label: 'RM',
            fraction_color: '#111111',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            assignment_id: 'assignment-1',
            pickup_date: '2026-05-19',
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Importierte Sammeltermine.',
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_pdf_short_label: 'RM',
            fraction_color: '#111111',
            note: 'Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus',
          },
        ],
      })
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
        referenceDate: '2026-01-01',
      })
    ).resolves.toContainEqual(
      expect.objectContaining({
        id: 'assignment-1:fraction-1',
        date: '2026-05-19',
        fractionId: 'fraction-1',
        fractionLabel: 'Restmuell',
        fractionShortLabel: 'RM',
        tourDescription: 'Importierte Sammeltermine.',
        note: 'Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus',
      })
    );

    const assignmentQuery = execute.mock.calls[3]?.[0];
    expect(assignmentQuery).toEqual(
      expect.objectContaining({
        text: expect.stringContaining('waste_tour_assignment_locations'),
      })
    );
    expect(assignmentQuery?.text).toContain('cl.street_id IS NULL OR cl.street_id = $3::uuid');
    expect(assignmentQuery?.text).toContain(
      'cl.house_number_id IS NULL OR cl.house_number_id = $5::uuid'
    );
    expect(assignmentQuery?.text).not.toContain('waste_location_tour_links');
  });

  it('keeps multiple explicit assignments on one day and suppresses the matching calculated occurrence', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            link_id: 'link-1',
            location_id: 'location-1',
            tour_id: 'tour-1',
            tour_name: 'Schadstoffmobil',
            tour_description: 'Allgemeiner Tourhinweis',
            tour_recurrence: 'custom',
            tour_custom_recurrence_interval_days: null,
            tour_first_date: null,
            tour_end_date: null,
            tour_custom_dates: [{ date: '2026-05-19' }],
            fraction_id: 'fraction-hazardous',
            fraction_label: 'Schadstoffmobil',
            fraction_pdf_short_label: 'SM',
            fraction_color: '#cc0000',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          {
            assignment_id: 'assignment-morning',
            pickup_date: '2026-05-19',
            tour_id: 'tour-1',
            tour_name: 'Schadstoffmobil',
            tour_description: 'Allgemeiner Tourhinweis',
            fraction_id: 'fraction-hazardous',
            fraction_label: 'Schadstoffmobil',
            fraction_pdf_short_label: 'SM',
            fraction_color: '#cc0000',
            note: '09:00–11:00 Uhr',
          },
          {
            assignment_id: 'assignment-afternoon',
            pickup_date: '2026-05-19',
            tour_id: 'tour-1',
            tour_name: 'Schadstoffmobil',
            tour_description: 'Allgemeiner Tourhinweis',
            fraction_id: 'fraction-hazardous',
            fraction_label: 'Schadstoffmobil',
            fraction_pdf_short_label: 'SM',
            fraction_color: '#cc0000',
            note: '14:00–16:00 Uhr',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const repository = createPublicWasteRepository({ schemaName: 'waste', execute });
    const entries = await repository.loadCalendarEntries({
      selection: { cityId: 'city-1', streetId: 'street-1' },
      referenceDate: '2026-01-01',
    });

    expect(entries).toEqual([
      expect.objectContaining({
        id: 'assignment-morning:fraction-hazardous',
        note: '09:00–11:00 Uhr',
      }),
      expect.objectContaining({
        id: 'assignment-afternoon:fraction-hazardous',
        note: '14:00–16:00 Uhr',
      }),
    ]);
    expect(entries).not.toContainEqual(
      expect.objectContaining({ id: 'tour-1:2026-05-19:fraction-hazardous' })
    );
  });

  it('prefers explicit assignment notes over shift descriptions for matching entries', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            link_id: 'link-1',
            location_id: 'location-1',
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Importierte Sammeltermine.',
            tour_recurrence: 'custom',
            tour_custom_recurrence_interval_days: null,
            tour_first_date: null,
            tour_end_date: null,
            tour_custom_dates: [{ date: '2026-05-19' }],
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_pdf_short_label: 'RM',
            fraction_color: '#111111',
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'shift-1',
            tour_id: 'tour-1',
            original_date: '2026-05-19',
            actual_date: '2026-05-19',
            description: 'Verschoben wegen Feiertag',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            assignment_id: 'assignment-1',
            pickup_date: '2026-05-19',
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Importierte Sammeltermine.',
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_pdf_short_label: 'RM',
            fraction_color: '#111111',
            note: 'Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus',
          },
        ],
      })
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
        referenceDate: '2026-01-01',
      })
    ).resolves.toContainEqual(
      expect.objectContaining({
        id: 'assignment-1:fraction-1',
        note: 'Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus',
      })
    );
  });

  it('applies configured holiday rules to public calendar entries', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            link_id: 'link-1',
            location_id: 'location-1',
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Leerung fuer den Innenstadtbereich.',
            tour_recurrence: 'weekly',
            tour_custom_recurrence_interval_days: null,
            tour_first_date: '2026-01-01',
            tour_end_date: '2026-01-08',
            tour_custom_dates: null,
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_pdf_short_label: 'RM',
            fraction_color: '#111111',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'holiday-1',
            holiday_date: '2026-01-01',
            holiday_name: 'Neujahr',
            holiday_year: 2026,
            state_code: 'BB',
            source_status: 'confirmed',
            configuration_status: 'configured',
            conflict_status: 'none',
            scope: 'holiday-only',
            strategy: 'postpone',
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z',
          },
        ],
      });

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
        referenceDate: '2026-01-01',
      })
    ).resolves.toContainEqual(
      expect.objectContaining({
        id: 'tour-1:2026-01-02:fraction-1',
        date: '2026-01-02',
      })
    );
  });

  it('loads explicit assignments independently of location-tour link validity windows', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            link_id: 'link-1',
            location_id: 'location-1',
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Importierte Sammeltermine.',
            tour_recurrence: 'on-demand',
            tour_custom_recurrence_interval_days: null,
            tour_first_date: null,
            tour_end_date: null,
            tour_custom_dates: null,
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_pdf_short_label: 'RM',
            fraction_color: '#111111',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          {
            assignment_id: 'assignment-1',
            pickup_date: '2026-05-19',
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Importierte Sammeltermine.',
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_pdf_short_label: 'RM',
            fraction_color: '#111111',
            note: null,
          },
          {
            assignment_id: 'assignment-2',
            pickup_date: '2026-06-19',
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Importierte Sammeltermine.',
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_pdf_short_label: 'RM',
            fraction_color: '#111111',
            note: null,
          },
        ],
      })
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
        referenceDate: '2026-01-01',
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'assignment-1:fraction-1',
        date: '2026-05-19',
      }),
      expect.objectContaining({
        id: 'assignment-2:fraction-1',
        date: '2026-06-19',
      }),
    ]);
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

  it('loads only email-capable reminder fractions with valid email slots for the current location', async () => {
    const execute = vi.fn().mockResolvedValueOnce({
      rowCount: 3,
      rows: [
        {
          fraction_id: 'bio',
          fraction_label: 'Bioabfall',
          fraction_color: '#008800',
          reminder_config: {
            reminderCount: 'twice',
            channels: {
              push: false,
              email: true,
              calendar: false,
            },
            email: {
              slots: [
                { id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 },
                { id: 'bio:second', maxLeadDays: 5, defaultLeadDays: 3 },
              ],
            },
          },
        },
        {
          fraction_id: 'paper',
          fraction_label: 'Papier',
          fraction_color: '#0000ff',
          reminder_config: {
            reminderCount: 'once',
            channels: {
              push: false,
              email: false,
              calendar: true,
            },
            calendar: {
              slots: [{ id: 'paper:calendar', maxLeadDays: 2, defaultLeadDays: 1 }],
            },
          },
        },
        {
          fraction_id: 'glass',
          fraction_label: 'Altglas',
          fraction_color: '#666666',
          reminder_config: {
            reminderCount: 'once',
            channels: {
              push: false,
              email: true,
              calendar: false,
            },
            email: {
              slots: [],
            },
          },
        },
      ],
    });

    const repository = createPublicWasteRepository({
      schemaName: 'waste',
      execute,
    });

    await expect(
      repository.loadReminderOptions({
        selection: {
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
        },
        channel: 'email',
      })
    ).resolves.toEqual([
      {
        id: 'bio',
        label: 'Bioabfall',
        color: '#008800',
        slots: [
          { id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 },
          { id: 'bio:second', maxLeadDays: 5, defaultLeadDays: 3 },
        ],
      },
    ]);
  });

  it('loads only calendar-capable reminder fractions with valid calendar slots for the current location', async () => {
    const execute = vi.fn().mockResolvedValueOnce({
      rowCount: 3,
      rows: [
        {
          fraction_id: 'bio',
          fraction_label: 'Bioabfall',
          fraction_color: '#008800',
          reminder_config: {
            reminderCount: 'twice',
            channels: {
              push: false,
              email: true,
              calendar: false,
            },
            email: {
              slots: [{ id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 }],
            },
          },
        },
        {
          fraction_id: 'paper',
          fraction_label: 'Papier',
          fraction_color: '#0000ff',
          reminder_config: {
            reminderCount: 'once',
            channels: {
              push: false,
              email: false,
              calendar: true,
            },
            calendar: {
              slots: [{ id: 'paper:calendar', maxLeadDays: 2, defaultLeadDays: 1 }],
            },
          },
        },
        {
          fraction_id: 'glass',
          fraction_label: 'Altglas',
          fraction_color: '#666666',
          reminder_config: {
            reminderCount: 'once',
            channels: {
              push: false,
              email: false,
              calendar: true,
            },
            calendar: {
              slots: [],
            },
          },
        },
      ],
    });

    const repository = createPublicWasteRepository({
      schemaName: 'waste',
      execute,
    });

    await expect(
      repository.loadReminderOptions({
        selection: {
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
        },
        channel: 'calendar',
      })
    ).resolves.toEqual([
      {
        id: 'paper',
        label: 'Papier',
        color: '#0000ff',
        slots: [{ id: 'paper:calendar', maxLeadDays: 2, defaultLeadDays: 1 }],
      },
    ]);
  });
});
