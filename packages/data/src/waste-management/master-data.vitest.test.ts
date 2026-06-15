import { describe, expect, it } from 'vitest';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../index.js';
import { createWasteMasterDataRepository } from '../index.js';

const createExecutor = (rows: readonly Record<string, unknown>[] = []) => {
  const statements: SqlStatement[] = [];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      return {
        rowCount: rows.length,
        rows: rows as readonly TRow[],
      };
    },
  };

  return { executor, statements };
};

const createQueuedExecutor = (queuedRows: readonly (readonly Record<string, unknown>[])[]) => {
  const statements: SqlStatement[] = [];
  const queue = [...queuedRows];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      const rows = queue.shift() ?? [];
      return {
        rowCount: rows.length,
        rows: rows as readonly TRow[],
      };
    },
  };

  return { executor, statements };
};

describe('waste master data repository (data package coverage)', () => {
  it('lists waste fractions with filters and maps nullable fields fail-closed', async () => {
    const { executor, statements } = createExecutor([
      {
        id: 'fraction-1',
        name: 'Bioabfall',
        pdf_short_label: null,
        label_translations: { de: 'Bioabfall', en: 'Organic waste' },
        container_size: null,
        color: '#00AA00',
        description: null,
        active: true,
        reminder_config: {
          reminder_count: 'once',
          channels: {
            push: true,
            email: false,
            calendar: false,
          },
          push: {
            slots: [
              {
                id: 'push:first',
                max_lead_days: 3,
                default_lead_days: 1,
              },
            ],
          },
        },
        reminder_count: 'none',
        first_reminder_max_lead_days: null,
        second_reminder_max_lead_days: null,
        reminder_channel_push_enabled: false,
        reminder_channel_email_enabled: true,
        reminder_channel_calendar_enabled: true,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(executor).listWasteFractions({
        active: true,
        search: 'Bio',
      })
    ).resolves.toEqual([
      {
        id: 'fraction-1',
        name: 'Bioabfall',
        pdfShortLabel: undefined,
        translations: { de: 'Bioabfall', en: 'Organic waste' },
        containerSize: undefined,
        color: '#00AA00',
        description: undefined,
        active: true,
        reminderConfig: {
          reminderCount: 'once',
          channels: {
            push: true,
            email: false,
            calendar: false,
          },
          push: {
            slots: [
              {
                id: 'push:first',
                maxLeadDays: 3,
                defaultLeadDays: 1,
              },
            ],
          },
        },
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);

    expect(statements[0]?.values).toEqual([true, '%Bio%']);
    expect(statements[0]?.text).toContain('FROM waste_fractions');
  });

  it('reads single waste fractions and upserts normalized nullable values', async () => {
    const { executor } = createExecutor([
      {
        id: 'fraction-1',
        name: 'Papier',
        pdf_short_label: 'PAP',
        label_translations: { de: 'Papier', en: 'Paper' },
        container_size: '240l',
        color: '#0000FF',
        description: 'Blaue Tonne',
        active: false,
        reminder_config: {
          reminder_count: 'twice',
          channels: {
            push: true,
            email: false,
            calendar: true,
          },
          push: {
            slots: [
              { id: 'push:first', max_lead_days: 7, default_lead_days: 1 },
              { id: 'push:second', max_lead_days: 2, default_lead_days: 1 },
            ],
          },
          calendar: {
            slots: [
              { id: 'calendar:first', max_lead_days: 7, default_lead_days: 1 },
              { id: 'calendar:second', max_lead_days: 2, default_lead_days: 1 },
            ],
          },
        },
        reminder_count: 'none',
        first_reminder_max_lead_days: 1,
        second_reminder_max_lead_days: 1,
        reminder_channel_push_enabled: false,
        reminder_channel_email_enabled: true,
        reminder_channel_calendar_enabled: false,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);
    const repository = createWasteMasterDataRepository(executor);

    await expect(repository.getWasteFractionById('fraction-1')).resolves.toMatchObject({
      id: 'fraction-1',
      name: 'Papier',
      pdfShortLabel: 'PAP',
      containerSize: '240l',
      color: '#0000FF',
      active: false,
    });

    const empty = createExecutor();
    await expect(createWasteMasterDataRepository(empty.executor).getWasteFractionById('missing')).resolves.toBeNull();

    const write = createExecutor();
    await createWasteMasterDataRepository(write.executor).upsertWasteFraction({
      id: 'fraction-2',
      name: 'Restmüll',
      pdfShortLabel: 'RES',
      translations: { de: 'Restmüll', en: 'Residual waste' },
      containerSize: undefined,
      color: '#444444',
      description: undefined,
      active: true,
      reminderConfig: {
        reminderCount: 'once',
        channels: {
          push: true,
          email: true,
          calendar: false,
        },
        push: {
          slots: [{ id: 'push:first', maxLeadDays: 5, defaultLeadDays: 1 }],
        },
        email: {
          slots: [{ id: 'email:first', maxLeadDays: 5, defaultLeadDays: 1 }],
        },
      },
    });

    expect(write.statements[0]?.text).toContain('ON CONFLICT (id) DO UPDATE');
    expect(write.statements[0]?.text).toContain('reminder_config');
    expect(write.statements[0]?.values[0]).toBe('fraction-2');
  });

  it('fails closed for legacy and stale reminder shapes', async () => {
    const legacy = createExecutor([
      {
        id: 'fraction-legacy',
        name: 'Legacy',
        pdf_short_label: null,
        label_translations: {},
        container_size: null,
        color: '#111111',
        description: null,
        active: true,
        reminder_config: null,
        reminder_count: 'once',
        first_reminder_max_lead_days: 7,
        second_reminder_max_lead_days: null,
        reminder_channel_push_enabled: false,
        reminder_channel_email_enabled: false,
        reminder_channel_calendar_enabled: false,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(createWasteMasterDataRepository(legacy.executor).getWasteFractionById('fraction-legacy')).resolves.toMatchObject({
      id: 'fraction-legacy',
      reminderConfig: {
        reminderCount: 'none',
        channels: {
          push: false,
          email: false,
          calendar: false,
        },
      },
    });

    const stale = createExecutor([
      {
        id: 'fraction-stale-json',
        name: 'Stale',
        pdf_short_label: 'STA',
        label_translations: {},
        container_size: null,
        color: '#111111',
        description: null,
        active: true,
        reminder_config: {
          reminder_count: 'none',
          channels: {
            push: false,
            email: false,
            calendar: false,
          },
        },
        reminder_count: 'once',
        first_reminder_max_lead_days: 7,
        second_reminder_max_lead_days: null,
        reminder_channel_push_enabled: true,
        reminder_channel_email_enabled: false,
        reminder_channel_calendar_enabled: false,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(createWasteMasterDataRepository(stale.executor).getWasteFractionById('fraction-stale-json')).resolves.toMatchObject({
      id: 'fraction-stale-json',
      reminderConfig: {
        reminderCount: 'once',
        channels: {
          push: true,
          email: false,
          calendar: false,
        },
      },
    });
  });

  it('lists regions and cities with search and region filters', async () => {
    const region = createExecutor([
      {
        id: 'region-1',
        name: 'Nord',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(region.executor).listWasteRegions({
        search: 'No',
      })
    ).resolves.toEqual([
      {
        id: 'region-1',
        name: 'Nord',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);
    expect(region.statements[0]?.values).toEqual(['%No%']);

    const city = createExecutor([
      {
        id: 'city-1',
        name: 'Musterstadt',
        region_id: 'region-1',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(city.executor).listWasteCities({
        regionId: 'region-1',
        search: 'Muster',
      })
    ).resolves.toEqual([
      {
        id: 'city-1',
        name: 'Musterstadt',
        regionId: 'region-1',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);

    expect(city.statements[0]?.values).toEqual(['region-1', '%Muster%']);
  });

  it('reads and upserts regions and cities with nullable region references', async () => {
    const regionRepository = createWasteMasterDataRepository(
      createExecutor([
        {
          id: 'region-1',
          name: 'Süd',
          created_at: '2026-05-09T10:00:00.000Z',
          updated_at: '2026-05-09T11:00:00.000Z',
        },
      ]).executor
    );

    await expect(regionRepository.getWasteRegionById('region-1')).resolves.toEqual({
      id: 'region-1',
      name: 'Süd',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    const city = createExecutor([
      {
        id: 'city-2',
        name: 'Freistadt',
        region_id: null,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);
    await expect(createWasteMasterDataRepository(city.executor).getWasteCityById('city-2')).resolves.toEqual({
      id: 'city-2',
      name: 'Freistadt',
      regionId: undefined,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    const write = createExecutor();
    const writeRepository = createWasteMasterDataRepository(write.executor);
    await writeRepository.upsertWasteRegion({
      id: 'region-2',
      name: 'West',
    });
    await writeRepository.upsertWasteCity({
      id: 'city-3',
      name: 'Weststadt',
      regionId: undefined,
    });

    expect(write.statements[0]?.text).toContain('ON CONFLICT (id) DO UPDATE');
    expect(write.statements[1]?.values).toEqual(['city-3', 'Weststadt', null]);
  });

  it('lists, reads, upserts and deletes collection locations with optional hierarchy filters', async () => {
    const { executor, statements } = createQueuedExecutor([
      [{
        id: 'location-1',
        city_id: 'city-1',
        region_id: 'region-1',
        street_id: 'street-1',
        house_number_id: null,
        active: true,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [{
        id: 'location-1',
        city_id: 'city-1',
        region_id: 'region-1',
        street_id: 'street-1',
        house_number_id: null,
        active: true,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [],
      [],
    ]);
    const repository = createWasteMasterDataRepository(executor);

    await expect(
      repository.listWasteCollectionLocations({
        cityId: 'city-1',
        regionId: 'region-1',
        streetId: 'street-1',
        active: true,
      })
    ).resolves.toEqual([
      {
        id: 'location-1',
        cityId: 'city-1',
        regionId: 'region-1',
        streetId: 'street-1',
        houseNumberId: undefined,
        active: true,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);
    expect(statements[0]?.values).toEqual(['city-1', 'region-1', 'street-1', true]);

    await expect(repository.getWasteCollectionLocationById('location-1')).resolves.toEqual({
      id: 'location-1',
      cityId: 'city-1',
      regionId: 'region-1',
      streetId: 'street-1',
      houseNumberId: undefined,
      active: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    await repository.upsertWasteCollectionLocation({
      id: 'location-2',
      cityId: 'city-2',
      regionId: undefined,
      streetId: undefined,
      houseNumberId: 'house-2',
      active: false,
    });
    await repository.deleteWasteCollectionLocation('location-2');

    expect(statements[2]?.values).toEqual(['location-2', 'city-2', null, null, 'house-2', false]);
    expect(statements[3]?.text).toContain('DELETE FROM waste_collection_locations');
  });

  it('lists, upserts and deletes holiday rules including scope normalization', async () => {
    const { executor, statements } = createQueuedExecutor([
      [{
        id: 'holiday-1',
        holiday_date: '2026-12-25',
        holiday_name: 'Weihnachten',
        year: 2026,
        state_code: 'DE-BB',
        source_status: 'imported',
        configuration_status: 'configured',
        conflict_status: 'none',
        scope: 'holiday_only',
        strategy: 'next_workday',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [],
      [],
    ]);
    const repository = createWasteMasterDataRepository(executor);

    await expect(
      repository.listWasteHolidayRules({
        stateCode: 'BB',
        year: 2026,
        sourceStatus: 'confirmed',
        configurationStatus: 'configured',
        conflictStatus: 'none',
      })
    ).resolves.toEqual([
      {
        id: 'holiday-1',
        holidayDate: '2026-12-25',
        holidayName: 'Weihnachten',
        year: 2026,
        stateCode: 'DE-BB',
        sourceStatus: 'imported',
        configurationStatus: 'configured',
        conflictStatus: 'none',
        scope: 'holiday-only',
        strategy: 'next_workday',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);
    expect(statements[0]?.values).toEqual(['BB', 2026, 'confirmed', 'configured', 'none']);

    await repository.upsertWasteHolidayRule({
      id: 'holiday-2',
      holidayDate: '2026-01-01',
      holidayName: 'Neujahr',
      year: 2026,
      stateCode: 'BB',
      sourceStatus: 'not-confirmed',
      configurationStatus: 'configured',
      conflictStatus: 'none',
      scope: 'full-week',
      strategy: undefined,
    });
    await repository.deleteWasteHolidayRule('holiday-2');

    expect(statements[1]?.values).toEqual([
      'holiday-2',
      '2026-01-01',
      'Neujahr',
      2026,
      'BB',
      'not-confirmed',
      'configured',
      'none',
      'full-week',
      null,
    ]);
    expect(statements[2]?.text).toContain('DELETE FROM waste_holiday_rules');
  });

  it('lists, reads, upserts and deletes tours with recurrence and custom dates', async () => {
    const { executor, statements } = createQueuedExecutor([
      [{
        id: 'tour-1',
        name: 'Tour A',
        description: null,
        waste_fraction_ids: ['fraction-1', 'fraction-2'],
        recurrence: 'weekly',
        custom_recurrence_id: null,
        custom_recurrence_name: null,
        custom_recurrence_interval_days: null,
        first_date: '2026-05-10',
        end_date: null,
        custom_dates: ['2026-06-01', '2026-06-15'],
        active: true,
        location_count: 3,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [{
        id: 'tour-1',
        name: 'Tour A',
        description: null,
        waste_fraction_ids: ['fraction-1', 'fraction-2'],
        recurrence: 'weekly',
        custom_recurrence_id: null,
        custom_recurrence_name: null,
        custom_recurrence_interval_days: null,
        first_date: '2026-05-10',
        end_date: null,
        custom_dates: ['2026-06-01'],
        active: true,
        location_count: 1,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [],
      [],
    ]);
    const repository = createWasteMasterDataRepository(executor);

    await expect(
      repository.listWasteTours({
        active: true,
        recurrence: 'weekly',
        wasteFractionId: 'fraction-1',
        search: 'Tour',
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'tour-1',
        name: 'Tour A',
        wasteFractionIds: ['fraction-1', 'fraction-2'],
        customDates: [],
        locationCount: 3,
      }),
    ]);
    expect(statements[0]?.values).toEqual([true, 'weekly', 'fraction-1', '%Tour%']);

    await expect(repository.getWasteTourById('tour-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'tour-1',
        customDates: [],
        locationCount: 1,
      })
    );

    await repository.upsertWasteTour({
      id: 'tour-2',
      name: 'Tour B',
      description: undefined,
      wasteFractionIds: ['fraction-3'],
      recurrence: null,
      customRecurrenceId: 'preset-1',
      firstDate: undefined,
      endDate: '2026-12-31',
      customDates: [{ date: '2026-07-01' }],
      active: false,
    });
    await repository.deleteWasteTour('tour-2');

    expect(statements[2]?.values).toEqual([
      'tour-2',
      'Tour B',
      null,
      ['fraction-3'],
      null,
      'preset-1',
      null,
      '2026-12-31',
      JSON.stringify([{ date: '2026-07-01' }]),
      false,
    ]);
    expect(statements[3]?.text).toContain('DELETE FROM waste_tours');
  });

  it('lists, reads and upserts streets and house numbers with filters', async () => {
    const { executor, statements } = createQueuedExecutor([
      [{
        id: 'street-1',
        name: 'Musterweg',
        city_id: 'city-1',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [{
        id: 'street-1',
        name: 'Musterweg',
        city_id: 'city-1',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [],
      [{
        id: 'house-1',
        number: '12a',
        street_id: 'street-1',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [{
        id: 'house-1',
        number: '12a',
        street_id: 'street-1',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [],
    ]);
    const repository = createWasteMasterDataRepository(executor);

    await expect(repository.listWasteStreets({ cityId: 'city-1', search: 'Muster' })).resolves.toEqual([
      {
        id: 'street-1',
        name: 'Musterweg',
        cityId: 'city-1',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);
    await expect(repository.getWasteStreetById('street-1')).resolves.toEqual({
      id: 'street-1',
      name: 'Musterweg',
      cityId: 'city-1',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });
    await repository.upsertWasteStreet({ id: 'street-2', name: 'Nebenweg', cityId: 'city-2' });

    await expect(repository.listWasteHouseNumbers({ streetId: 'street-1', search: '12' })).resolves.toEqual([
      {
        id: 'house-1',
        number: '12a',
        streetId: 'street-1',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);
    await expect(repository.getWasteHouseNumberById('house-1')).resolves.toEqual({
      id: 'house-1',
      number: '12a',
      streetId: 'street-1',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });
    await repository.upsertWasteHouseNumber({ id: 'house-2', number: '7', streetId: 'street-2' });

    expect(statements[0]?.values).toEqual(['city-1', '%Muster%']);
    expect(statements[2]?.values).toEqual(['street-2', 'Nebenweg', 'city-2']);
    expect(statements[3]?.values).toEqual(['street-1', '%12%']);
    expect(statements[5]?.values).toEqual(['house-2', '7', 'street-2']);
  });

  it('covers links, pickup dates, tour date shifts and global date shifts', async () => {
    const { executor, statements } = createQueuedExecutor([
      [{
        id: 'link-1',
        location_id: 'location-1',
        tour_id: 'tour-1',
        start_date: '2026-01-01',
        end_date: null,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [{
        id: 'link-1',
        location_id: 'location-1',
        tour_id: 'tour-1',
        start_date: '2026-01-01',
        end_date: null,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [],
      [],
      [{
        id: 'pickup-1',
        location_id: 'location-1',
        tour_id: 'tour-1',
        pickup_date: '2026-06-01',
        note: 'Feiertagsverschiebung',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [{
        id: 'pickup-1',
        location_id: 'location-1',
        tour_id: 'tour-1',
        pickup_date: '2026-06-01',
        note: 'Feiertagsverschiebung',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [],
      [],
      [{
        id: 'shift-1',
        tour_id: 'tour-1',
        original_date: '2026-12-24',
        actual_date: '2026-12-23',
        has_year: true,
        reason_type: 'holiday',
        reason_key: 'christmas_eve',
        follow_up_mode: 'none',
        description: null,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [{
        id: 'shift-1',
        tour_id: 'tour-1',
        original_date: '2026-12-24',
        actual_date: '2026-12-23',
        has_year: true,
        reason_type: 'holiday',
        reason_key: 'christmas_eve',
        follow_up_mode: 'none',
        description: null,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [],
      [],
      [{
        id: 'global-1',
        original_date: '2026-05-01',
        actual_date: '2026-05-02',
        has_year: true,
        reason_type: 'holiday',
        reason_key: 'labour_day',
        description: 'bundesweit',
        tour_ids: ['tour-1'],
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [{
        id: 'global-1',
        original_date: '2026-05-01',
        actual_date: '2026-05-02',
        has_year: true,
        reason_type: 'holiday',
        reason_key: 'labour_day',
        description: 'bundesweit',
        tour_ids: ['tour-1'],
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      }],
      [],
      [],
    ]);
    const repository = createWasteMasterDataRepository(executor);

    await expect(repository.listWasteLocationTourLinks({ locationId: 'location-1', tourId: 'tour-1' })).resolves.toEqual([
      {
        id: 'link-1',
        locationId: 'location-1',
        tourId: 'tour-1',
        startDate: '2026-01-01',
        endDate: undefined,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);
    await expect(repository.getWasteLocationTourLinkById('link-1')).resolves.toEqual({
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '2026-01-01',
      endDate: undefined,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });
    await repository.upsertWasteLocationTourLink({
      id: 'link-2',
      locationId: 'location-2',
      tourId: 'tour-2',
      startDate: undefined,
      endDate: '2026-12-31',
    });
    await repository.deleteWasteLocationTourLink('link-2');

    await expect(
      repository.listWasteLocationTourPickupDates({
        locationId: 'location-1',
        tourId: 'tour-1',
        pickupDate: '2026-06-01',
      })
    ).resolves.toEqual([
      {
        id: 'pickup-1',
        locationId: 'location-1',
        tourId: 'tour-1',
        pickupDate: '2026-06-01',
        note: 'Feiertagsverschiebung',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);
    await expect(repository.getWasteLocationTourPickupDateById('pickup-1')).resolves.toEqual({
      id: 'pickup-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      pickupDate: '2026-06-01',
      note: 'Feiertagsverschiebung',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });
    await repository.upsertWasteLocationTourPickupDate({
      id: 'pickup-2',
      locationId: 'location-2',
      tourId: 'tour-2',
      pickupDate: '2026-07-01',
      note: null,
    });
    await repository.deleteWasteLocationTourPickupDate('pickup-2');

    await expect(repository.listWasteTourDateShifts({ tourId: 'tour-1', hasYear: true })).resolves.toEqual([
      {
        id: 'shift-1',
        tourId: 'tour-1',
        originalDate: '2026-12-24',
        actualDate: '2026-12-23',
        hasYear: true,
        reasonType: 'holiday',
        reasonKey: 'christmas_eve',
        followUpMode: 'none',
        description: undefined,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);
    await expect(repository.getWasteTourDateShiftById('shift-1')).resolves.toEqual({
      id: 'shift-1',
      tourId: 'tour-1',
      originalDate: '2026-12-24',
      actualDate: '2026-12-23',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'christmas_eve',
      followUpMode: 'none',
      description: undefined,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });
    await repository.upsertWasteTourDateShift({
      id: 'shift-2',
      tourId: 'tour-2',
      originalDate: '2026-08-01',
      actualDate: '2026-08-02',
      hasYear: false,
      reasonType: undefined,
      reasonKey: undefined,
      followUpMode: undefined,
      description: 'Verschoben',
    });
    await repository.deleteWasteTourDateShift('shift-2');

    await expect(repository.listWasteGlobalDateShifts({ hasYear: true, appliesToTourId: 'tour-1' })).resolves.toEqual([
      {
        id: 'global-1',
        originalDate: '2026-05-01',
        actualDate: '2026-05-02',
        hasYear: true,
        reasonType: 'holiday',
        reasonKey: 'labour_day',
        description: 'bundesweit',
        tourIds: ['tour-1'],
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);
    await expect(repository.getWasteGlobalDateShiftById('global-1')).resolves.toEqual({
      id: 'global-1',
      originalDate: '2026-05-01',
      actualDate: '2026-05-02',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'labour_day',
      description: 'bundesweit',
      tourIds: ['tour-1'],
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });
    await repository.upsertWasteGlobalDateShift({
      id: 'global-2',
      originalDate: '2026-10-03',
      actualDate: '2026-10-04',
      hasYear: true,
      reasonType: undefined,
      reasonKey: undefined,
      description: undefined,
      tourIds: undefined,
    });
    await repository.deleteWasteGlobalDateShift('global-2');

    expect(statements[0]?.values).toEqual(['location-1', 'tour-1']);
    expect(statements[2]?.values).toEqual(['link-2', 'location-2', 'tour-2', null, '2026-12-31']);
    expect(statements[4]?.values).toEqual(['location-1', 'tour-1', '2026-06-01']);
    expect(statements[6]?.values).toEqual(['pickup-2', 'location-2', 'tour-2', '2026-07-01', null]);
    expect(statements[8]?.values).toEqual(['tour-1', true]);
    expect(statements[10]?.values).toEqual(['shift-2', 'tour-2', '2026-08-01', '2026-08-02', false, null, null, null, 'Verschoben']);
    expect(statements[12]?.values).toEqual([true, 'tour-1']);
    expect(statements[14]?.values).toEqual(['global-2', '2026-10-03', '2026-10-04', true, null, null, null, null]);
  });
});
