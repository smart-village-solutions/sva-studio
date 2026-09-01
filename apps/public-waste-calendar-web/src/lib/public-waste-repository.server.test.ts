import { describe, expect, it, vi } from 'vitest';

import { createPublicWasteRepository } from './public-waste-repository.server.js';

describe('public waste repository', () => {
  it('lists only regions backed by active locations and tours', async () => {
    const execute = vi.fn().mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        { id: 'region-1', label: 'Amt Bad Wilsnack/Weisen' },
        { id: 'region-2', label: 'Groß Pankow (Prignitz)' },
      ],
    });
    const repository = createPublicWasteRepository({ schemaName: 'waste', execute });

    await expect(repository.listPublicRegions()).resolves.toEqual([
      { id: 'region-1', label: 'Amt Bad Wilsnack/Weisen' },
      { id: 'region-2', label: 'Groß Pankow (Prignitz)' },
    ]);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('INNER JOIN "waste".waste_regions'),
      })
    );
    expect(execute.mock.calls[0]?.[0].text).toContain('cl.active = true');
    expect(execute.mock.calls[0]?.[0].text).toContain('t.active = true');
  });

  it('projects, deduplicates and sorts active public collection locations', async () => {
    const execute = vi.fn().mockResolvedValueOnce({
      rowCount: 4,
      rows: [
        {
          region_id: 'region-2',
          region_name: 'Wittenberge',
          city_id: 'city-2',
          city_name: 'Bentwisch',
          street_id: null,
          street_name: null,
          house_number_id: null,
          house_number_label: null,
        },
        {
          region_id: 'region-1',
          region_name: 'Karstädt',
          city_id: 'city-1',
          city_name: 'Birkholz',
          street_id: 'street-1',
          street_name: 'Dorfstraße',
          house_number_id: 'house-1',
          house_number_label: '1–9',
        },
        {
          region_id: 'region-1',
          region_name: 'Karstädt',
          city_id: 'city-1',
          city_name: 'Birkholz',
          street_id: 'street-1',
          street_name: 'Dorfstraße',
          house_number_id: 'house-1',
          house_number_label: '1–9',
        },
        {
          region_id: null,
          region_name: null,
          city_id: 'city-3',
          city_name: 'Musterort',
          street_id: 'street-3',
          street_name: 'Hauptstraße',
          house_number_id: null,
          house_number_label: null,
        },
      ],
    });
    const repository = createPublicWasteRepository({ schemaName: 'waste', execute });

    await expect(repository.listPublicLocations()).resolves.toEqual([
      {
        id: 'region-1:city-1:street-1:house-1',
        municipality: { id: 'region-1', name: 'Karstädt' },
        district: { id: 'city-1', name: 'Birkholz' },
        streetOrCollectionDistrict: { id: 'street-1', name: 'Dorfstraße' },
        houseNumber: { id: 'house-1', label: '1–9' },
        mappingComplete: true,
        missingFields: [],
        calendarQuery: {
          regionId: 'region-1',
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
        },
      },
      {
        id: '~:city-3:street-3:~',
        municipality: null,
        district: { id: 'city-3', name: 'Musterort' },
        streetOrCollectionDistrict: { id: 'street-3', name: 'Hauptstraße' },
        houseNumber: { id: 'all', label: 'Alle Hausnummern' },
        mappingComplete: false,
        missingFields: ['municipality'],
        calendarQuery: {
          cityId: 'city-3',
          streetId: 'street-3',
        },
      },
      {
        id: 'region-2:city-2:all:~',
        municipality: { id: 'region-2', name: 'Wittenberge' },
        district: { id: 'city-2', name: 'Bentwisch' },
        streetOrCollectionDistrict: { id: 'all', name: 'Alle Straßen' },
        houseNumber: { id: 'all', label: 'Alle Hausnummern' },
        mappingComplete: true,
        missingFields: [],
        calendarQuery: {
          regionId: 'region-2',
          cityId: 'city-2',
          streetId: 'all',
        },
      },
    ]);

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('WHERE cl.active = true'),
      })
    );
    expect(execute.mock.calls[0]?.[0].text).toContain('t.active = true');
    expect(execute.mock.calls[0]?.[0].text).not.toContain('waste_email_reminder');
  });

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

  it('rejects an unknown explicit region before loading shared or regional locations', async () => {
    const execute = vi.fn().mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'r-1', label: 'Prignitz' }],
    });
    const repository = createPublicWasteRepository({ schemaName: 'waste', execute });

    await expect(
      repository.listSelectionOptions({ selection: { regionId: 'unknown-region' } })
    ).resolves.toEqual({
      step: 'city',
      options: [],
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('accepts an uppercase UUID for a known explicit region', async () => {
    const regionId = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: regionId.toLowerCase(), label: 'Prignitz' }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'c-1', label: 'Wittenberge' }],
      });
    const repository = createPublicWasteRepository({ schemaName: 'waste', execute });

    await expect(
      repository.listSelectionOptions({ selection: { regionId } })
    ).resolves.toMatchObject({
      step: 'city',
      options: [{ id: 'c-1', label: 'Wittenberge' }],
    });
    expect(execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ values: [regionId.toLowerCase()] })
    );
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
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'shift-1',
            tour_id: 'tour-1',
            original_date: '2026-05-19',
            actual_date: '2026-05-20',
            description: 'Verschoben',
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
        date: '2026-05-20',
        fractionId: 'fraction-1',
        fractionLabel: 'Restmuell',
        fractionShortLabel: 'RM',
        tourDescription: 'Importierte Sammeltermine.',
        isShifted: true,
        note: 'Dienstag 14:00-16:30 Uhr, Parkplatz am Rathaus',
      })
    );

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          'ORDER BY pickup_date ASC, tour_name ASC, fraction_label ASC, assignment_id ASC'
        ),
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
    const tourShiftQuery = execute.mock.calls[1]?.[0];
    expect(tourShiftQuery?.text).not.toContain('ANY($1::text[])');
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
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            assignment_id: 'assignment-1',
            pickup_date: '2026-01-01',
            tour_id: 'tour-1',
            tour_name: 'Restmuell',
            tour_description: 'Leerung fuer den Innenstadtbereich.',
            fraction_id: 'fraction-1',
            fraction_label: 'Restmuell',
            fraction_pdf_short_label: 'RM',
            fraction_color: '#111111',
            note: 'Sondertermin',
          },
        ],
      })
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
        id: 'assignment-1:fraction-1',
        date: '2026-01-02',
        isShifted: true,
        note: 'Sondertermin',
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

  it('keeps calendar window boundaries inclusive without shifting an offset reference date', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 4,
        rows: [
          {
            assignment_id: 'before-window',
            pickup_date: '2024-12-31',
            tour_id: 'tour-1',
            tour_name: 'Restmüll',
            tour_description: null,
            fraction_id: 'rest',
            fraction_label: 'Restmüll',
            fraction_description: null,
            fraction_pdf_short_label: null,
            fraction_color: null,
            note: null,
          },
          {
            assignment_id: 'window-start',
            pickup_date: '2025-01-01',
            tour_id: 'tour-1',
            tour_name: 'Restmüll',
            tour_description: null,
            fraction_id: 'rest',
            fraction_label: 'Restmüll',
            fraction_description: null,
            fraction_pdf_short_label: null,
            fraction_color: null,
            note: null,
          },
          {
            assignment_id: 'window-end',
            pickup_date: '2027-01-01',
            tour_id: 'tour-1',
            tour_name: 'Restmüll',
            tour_description: null,
            fraction_id: 'rest',
            fraction_label: 'Restmüll',
            fraction_description: null,
            fraction_pdf_short_label: null,
            fraction_color: null,
            note: null,
          },
          {
            assignment_id: 'after-window',
            pickup_date: '2027-01-02',
            tour_id: 'tour-1',
            tour_name: 'Restmüll',
            tour_description: null,
            fraction_id: 'rest',
            fraction_label: 'Restmüll',
            fraction_description: null,
            fraction_pdf_short_label: null,
            fraction_color: null,
            note: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const repository = createPublicWasteRepository({ schemaName: 'waste', execute });

    await expect(
      repository.loadCalendarEntries({
        selection: { cityId: 'city-1', streetId: 'street-1' },
        referenceDate: '2026-01-01T23:30:00-11:00',
      })
    ).resolves.toEqual([
      expect.objectContaining({ id: 'window-start:rest', date: '2025-01-01' }),
      expect.objectContaining({ id: 'window-end:rest', date: '2027-01-01' }),
    ]);

    expect(execute.mock.calls[4]?.[0]).toEqual(
      expect.objectContaining({ values: ['2025-01-01', '2027-01-01'] })
    );
  });

  it('uses the same fail-closed selection parameters for recurring and assigned pickups', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const repository = createPublicWasteRepository({ schemaName: 'tenant_public', execute });

    await repository.loadCalendarEntries({
      selection: {
        cityId: 'city-1',
        streetId: 'all',
        regionId: 'region-1',
        houseNumberId: 'house-1',
      },
      referenceDate: '2026-06-15',
    });

    const expectedSelectionValues = ['city-1', 'all', null, 'region-1', 'house-1'];
    expect(execute.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ values: expectedSelectionValues })
    );
    expect(execute.mock.calls[3]?.[0]).toEqual(
      expect.objectContaining({ values: expectedSelectionValues })
    );
    for (const call of execute.mock.calls) {
      expect(call[0].text).toContain('"tenant_public".');
      expect(call[0].text).not.toContain('city-1');
      expect(call[0].text).not.toContain('region-1');
      expect(call[0].text).not.toContain('house-1');
    }
  });

  it('sorts merged assignments by date and then by German fraction label', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 3,
        rows: [
          {
            assignment_id: 'later',
            pickup_date: '2026-05-20',
            tour_id: 'tour-1',
            tour_name: 'Tour',
            tour_description: null,
            fraction_id: 'alpha-later',
            fraction_label: 'Alpha',
            fraction_description: null,
            fraction_pdf_short_label: null,
            fraction_color: null,
            note: null,
          },
          {
            assignment_id: 'zulu',
            pickup_date: '2026-05-19',
            tour_id: 'tour-1',
            tour_name: 'Tour',
            tour_description: null,
            fraction_id: 'zulu',
            fraction_label: 'Zulu',
            fraction_description: null,
            fraction_pdf_short_label: null,
            fraction_color: null,
            note: null,
          },
          {
            assignment_id: 'alpha',
            pickup_date: '2026-05-19',
            tour_id: 'tour-1',
            tour_name: 'Tour',
            tour_description: null,
            fraction_id: 'alpha',
            fraction_label: 'Alpha',
            fraction_description: null,
            fraction_pdf_short_label: null,
            fraction_color: null,
            note: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const repository = createPublicWasteRepository({ schemaName: 'waste', execute });

    const entries = await repository.loadCalendarEntries({
      selection: { cityId: 'city-1', streetId: 'street-1' },
      referenceDate: '2026-01-01',
    });

    expect(entries.map((entry) => entry.id)).toEqual([
      'alpha:alpha',
      'zulu:zulu',
      'later:alpha-later',
    ]);
  });

  it('returns an empty calendar for an invalid reference date without loading holiday rules', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const repository = createPublicWasteRepository({ schemaName: 'waste', execute });

    await expect(
      repository.loadCalendarEntries({
        selection: { cityId: 'city-1', streetId: 'street-1' },
        referenceDate: 'invalid',
      })
    ).resolves.toEqual([]);

    expect(execute).toHaveBeenCalledTimes(4);
    expect(
      execute.mock.calls.some(([statement]) => statement.text.includes('waste_holiday_rules'))
    ).toBe(false);
  });

  it('propagates repository failures without exposing fallback calendar entries', async () => {
    const databaseError = new Error('database_unavailable');
    const execute = vi.fn().mockRejectedValueOnce(databaseError);
    const repository = createPublicWasteRepository({ schemaName: 'waste', execute });

    await expect(
      repository.loadCalendarEntries({
        selection: { cityId: 'city-1', streetId: 'street-1' },
        referenceDate: '2026-01-01',
      })
    ).rejects.toBe(databaseError);
    expect(execute).toHaveBeenCalledTimes(1);
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
