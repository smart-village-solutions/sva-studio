import { describe, expect, it } from 'vitest';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import { createWasteMasterDataRepository, wasteMasterDataStatements } from './master-data.js';

const createExecutor = (rows: readonly Record<string, unknown>[] = []) => {
  const statements: SqlStatement[] = [];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(
      statement: SqlStatement
    ): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      return {
        rowCount: rows.length,
        rows: rows as readonly TRow[],
      };
    },
  };

  return { executor, statements };
};

describe('waste master data repository', () => {
  it('lists tour assignments with normalized filters and maps their locations', async () => {
    const { executor, statements } = createExecutor([
      {
        id: 'assignment-1',
        tour_id: 'tour-1',
        pickup_date: '2026-08-12',
        note: '10–12 Uhr',
        location_ids: ['location-1', 'location-2'],
        created_at: '2026-07-12T10:00:00.000Z',
        updated_at: '2026-07-12T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(executor).listWasteTourAssignments({
        tourId: 'tour-1',
        pickupDate: '2026-08-12',
        locationIds: ['location-2', 'location-2'],
      })
    ).resolves.toEqual([
      {
        id: 'assignment-1',
        tourId: 'tour-1',
        pickupDate: '2026-08-12',
        note: '10–12 Uhr',
        locationIds: ['location-1', 'location-2'],
        createdAt: '2026-07-12T10:00:00.000Z',
        updatedAt: '2026-07-12T11:00:00.000Z',
      },
    ]);

    expect(statements[0]?.text).toContain('FROM waste_tour_assignments AS assignment');
    expect(statements[0]?.text).toContain('INNER JOIN waste_tour_assignment_locations');
    expect(statements[0]?.text).toContain(
      'matched_location.collection_location_id = ANY($3::uuid[])'
    );
    expect(statements[0]?.values).toEqual(['tour-1', '2026-08-12', ['location-2']]);
  });

  it('reads, atomically replaces locations for and deletes tour assignments', async () => {
    const { executor, statements } = createExecutor([
      {
        id: 'assignment-1',
        tour_id: 'tour-1',
        pickup_date: '2026-08-12',
        note: null,
        location_ids: ['location-1'],
        created_at: '2026-07-12T10:00:00.000Z',
        updated_at: '2026-07-12T10:00:00.000Z',
      },
    ]);
    const repository = createWasteMasterDataRepository(executor);

    await expect(repository.getWasteTourAssignmentById('assignment-1')).resolves.toMatchObject({
      id: 'assignment-1',
      locationIds: ['location-1'],
    });
    await repository.upsertWasteTourAssignment({
      id: 'assignment-1',
      tourId: 'tour-1',
      pickupDate: '2026-08-13',
      note: null,
      locationIds: [' location-2 ', 'location-3', 'location-2'],
    });
    await repository.deleteWasteTourAssignment('assignment-1');

    expect(statements[0]?.text).toContain('assignment.id = $1::uuid');
    expect(statements[0]?.values).toEqual(['assignment-1']);
    expect(statements[1]?.text).toContain('WITH saved_assignment AS');
    expect(statements[1]?.text).toContain('removed_locations AS');
    expect(statements[1]?.text).toContain('CROSS JOIN UNNEST($5::uuid[])');
    expect(statements[1]?.values).toEqual([
      'assignment-1',
      'tour-1',
      '2026-08-13',
      null,
      ['location-2', 'location-3'],
    ]);
    expect(statements[2]).toEqual({
      text: 'DELETE FROM waste_tour_assignments WHERE id = $1::uuid;',
      values: ['assignment-1'],
    });
  });

  it('rejects tour assignments without a location before executing SQL', async () => {
    const { executor, statements } = createExecutor();

    await expect(
      createWasteMasterDataRepository(executor).upsertWasteTourAssignment({
        id: 'assignment-1',
        tourId: 'tour-1',
        pickupDate: '2026-08-13',
        note: null,
        locationIds: [' ', ''],
      })
    ).rejects.toThrow('waste_tour_assignment_requires_location');
    expect(statements).toEqual([]);
  });

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
    expect(statements[0]?.text).toContain('reminder_config');
    expect(statements[0]?.text).toContain('label_translations');
    expect(statements[0]?.text).toContain('active = $1');
    expect(statements[0]?.text).toContain('name ILIKE $2');
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
              {
                id: 'push:first',
                max_lead_days: 7,
                default_lead_days: 1,
              },
              {
                id: 'push:second',
                max_lead_days: 2,
                default_lead_days: 1,
              },
            ],
          },
          calendar: {
            slots: [
              {
                id: 'calendar:first',
                max_lead_days: 7,
                default_lead_days: 1,
              },
              {
                id: 'calendar:second',
                max_lead_days: 2,
                default_lead_days: 1,
              },
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

    await expect(repository.getWasteFractionById('fraction-1')).resolves.toEqual({
      id: 'fraction-1',
      name: 'Papier',
      pdfShortLabel: 'PAP',
      translations: { de: 'Papier', en: 'Paper' },
      containerSize: '240l',
      color: '#0000FF',
      description: 'Blaue Tonne',
      active: false,
      reminderConfig: {
        reminderCount: 'twice',
        channels: {
          push: true,
          email: false,
          calendar: true,
        },
        push: {
          slots: [
            {
              id: 'push:first',
              maxLeadDays: 7,
              defaultLeadDays: 1,
            },
            {
              id: 'push:second',
              maxLeadDays: 2,
              defaultLeadDays: 1,
            },
          ],
        },
        calendar: {
          slots: [
            {
              id: 'calendar:first',
              maxLeadDays: 7,
              defaultLeadDays: 1,
            },
            {
              id: 'calendar:second',
              maxLeadDays: 2,
              defaultLeadDays: 1,
            },
          ],
        },
      },
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    const empty = createExecutor();
    await expect(
      createWasteMasterDataRepository(empty.executor).getWasteFractionById('missing')
    ).resolves.toBeNull();

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
          slots: [
            {
              id: 'push:first',
              maxLeadDays: 5,
              defaultLeadDays: 1,
            },
          ],
        },
        email: {
          slots: [
            {
              id: 'email:first',
              maxLeadDays: 5,
              defaultLeadDays: 1,
            },
          ],
        },
      },
    });

    expect(write.statements[0]?.text).toContain('ON CONFLICT (id) DO UPDATE');
    expect(write.statements[0]?.text).toContain('reminder_config');
    expect(write.statements[0]?.values).toEqual([
      'fraction-2',
      'Restmüll',
      'RES',
      JSON.stringify({ de: 'Restmüll', en: 'Residual waste' }),
      null,
      '#444444',
      null,
      true,
      JSON.stringify({
        reminder_count: 'once',
        channels: {
          push: true,
          email: true,
          calendar: false,
        },
        push: {
          slots: [
            {
              id: 'push:first',
              max_lead_days: 5,
              default_lead_days: 1,
            },
          ],
        },
        email: {
          slots: [
            {
              id: 'email:first',
              max_lead_days: 5,
              default_lead_days: 1,
            },
          ],
        },
      }),
      'once',
      5,
      null,
      true,
      true,
      false,
    ]);
  });

  it('fails closed for legacy reminder rows without active channels', async () => {
    const { executor } = createExecutor([
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

    await expect(
      createWasteMasterDataRepository(executor).getWasteFractionById('fraction-legacy')
    ).resolves.toMatchObject({
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
  });

  it('fails closed for json reminder rows without active channels', async () => {
    const { executor } = createExecutor([
      {
        id: 'fraction-json-no-channel',
        name: 'JSON',
        pdf_short_label: null,
        label_translations: {},
        container_size: null,
        color: '#111111',
        description: null,
        active: true,
        reminder_config: {
          reminder_count: 'once',
          channels: {
            push: false,
            email: false,
            calendar: false,
          },
        },
        reminder_count: 'none',
        first_reminder_max_lead_days: null,
        second_reminder_max_lead_days: null,
        reminder_channel_push_enabled: false,
        reminder_channel_email_enabled: false,
        reminder_channel_calendar_enabled: false,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(executor).getWasteFractionById('fraction-json-no-channel')
    ).resolves.toMatchObject({
      id: 'fraction-json-no-channel',
      reminderConfig: {
        reminderCount: 'none',
        channels: {
          push: false,
          email: false,
          calendar: false,
        },
      },
    });
  });

  it('prefers legacy reminder columns when json reminder_config is stale', async () => {
    const { executor } = createExecutor([
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

    await expect(
      createWasteMasterDataRepository(executor).getWasteFractionById('fraction-stale-json')
    ).resolves.toMatchObject({
      id: 'fraction-stale-json',
      reminderConfig: {
        reminderCount: 'once',
        channels: {
          push: true,
          email: false,
          calendar: false,
        },
        push: {
          slots: [{ id: 'fraction-stale-json:push:first', maxLeadDays: 7, defaultLeadDays: 1 }],
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
    expect(region.statements[0]?.text).toContain('FROM waste_regions');

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
    expect(city.statements[0]?.text).toContain('region_id = $1::uuid');
    expect(city.statements[0]?.text).toContain('name ILIKE $2');
  });

  it('reads and upserts regions and cities with nullable region references', async () => {
    const repository = createWasteMasterDataRepository(
      createExecutor([
        {
          id: 'region-1',
          name: 'Süd',
          created_at: '2026-05-09T10:00:00.000Z',
          updated_at: '2026-05-09T11:00:00.000Z',
        },
      ]).executor
    );

    await expect(repository.getWasteRegionById('region-1')).resolves.toEqual({
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
    await expect(
      createWasteMasterDataRepository(city.executor).getWasteCityById('city-2')
    ).resolves.toEqual({
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
      name: 'Hafenstadt',
      regionId: undefined,
    });

    expect(write.statements[0]?.values).toEqual(['region-2', 'West']);
    expect(write.statements[1]?.values).toEqual(['city-3', 'Hafenstadt', null]);
    expect(
      wasteMasterDataStatements.upsertWasteCity({
        id: 'city-4',
        name: 'Oststadt',
        regionId: 'region-9',
      }).values
    ).toEqual(['city-4', 'Oststadt', 'region-9']);
  });

  it('lists streets and house numbers with parent filters and search', async () => {
    const street = createExecutor([
      {
        id: 'street-1',
        name: 'Bahnhofstraße',
        city_id: 'city-1',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(street.executor).listWasteStreets({
        cityId: 'city-1',
        search: 'Bahnhof',
      })
    ).resolves.toEqual([
      {
        id: 'street-1',
        name: 'Bahnhofstraße',
        cityId: 'city-1',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);

    expect(street.statements[0]?.values).toEqual(['city-1', '%Bahnhof%']);
    expect(street.statements[0]?.text).toContain('FROM waste_streets');
    expect(street.statements[0]?.text).toContain('city_id = $1::uuid');
    expect(street.statements[0]?.text).toContain('name ILIKE $2');

    const houseNumber = createExecutor([
      {
        id: 'house-1',
        number: '12a',
        street_id: 'street-1',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(houseNumber.executor).listWasteHouseNumbers({
        streetId: 'street-1',
        search: '12',
      })
    ).resolves.toEqual([
      {
        id: 'house-1',
        number: '12a',
        streetId: 'street-1',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);

    expect(houseNumber.statements[0]?.values).toEqual(['street-1', '%12%']);
    expect(houseNumber.statements[0]?.text).toContain('FROM waste_house_numbers');
    expect(houseNumber.statements[0]?.text).toContain('street_id = $1::uuid');
    expect(houseNumber.statements[0]?.text).toContain('number ILIKE $2');
  });

  it('reads and upserts streets and house numbers', async () => {
    const repository = createWasteMasterDataRepository(
      createExecutor([
        {
          id: 'street-2',
          name: 'Hauptstraße',
          city_id: 'city-2',
          created_at: '2026-05-09T10:00:00.000Z',
          updated_at: '2026-05-09T11:00:00.000Z',
        },
      ]).executor
    );

    await expect(repository.getWasteStreetById('street-2')).resolves.toEqual({
      id: 'street-2',
      name: 'Hauptstraße',
      cityId: 'city-2',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    const houseNumber = createExecutor([
      {
        id: 'house-2',
        number: '7',
        street_id: 'street-2',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(houseNumber.executor).getWasteHouseNumberById('house-2')
    ).resolves.toEqual({
      id: 'house-2',
      number: '7',
      streetId: 'street-2',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    const write = createExecutor();
    const writeRepository = createWasteMasterDataRepository(write.executor);
    await writeRepository.upsertWasteStreet({
      id: 'street-3',
      name: 'Parkweg',
      cityId: 'city-9',
    });
    await writeRepository.upsertWasteHouseNumber({
      id: 'house-3',
      number: '14',
      streetId: 'street-3',
    });

    expect(write.statements[0]?.values).toEqual(['street-3', 'Parkweg', 'city-9']);
    expect(write.statements[1]?.values).toEqual(['house-3', '14', 'street-3']);
    expect(
      wasteMasterDataStatements.upsertWasteHouseNumber({
        id: 'house-4',
        number: '21b',
        streetId: 'street-8',
      }).values
    ).toEqual(['house-4', '21b', 'street-8']);
  });

  it('lists, reads and upserts collection locations with nullable hierarchy references', async () => {
    const list = createExecutor([
      {
        id: 'location-1',
        city_id: 'city-1',
        region_id: 'region-1',
        street_id: null,
        house_number_id: null,
        active: true,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(list.executor).listWasteCollectionLocations({
        cityId: 'city-1',
        regionId: 'region-1',
        streetId: 'street-1',
        houseNumberId: 'house-1',
        active: true,
      })
    ).resolves.toEqual([
      {
        id: 'location-1',
        cityId: 'city-1',
        regionId: 'region-1',
        streetId: undefined,
        houseNumberId: undefined,
        active: true,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);

    expect(list.statements[0]?.values).toEqual(['city-1', 'region-1', 'street-1', 'house-1', true]);
    expect(list.statements[0]?.text).toContain('FROM waste_collection_locations');
    expect(list.statements[0]?.text).toContain('city_id = $1::uuid');
    expect(list.statements[0]?.text).toContain('region_id = $2::uuid');
    expect(list.statements[0]?.text).toContain('street_id = $3::uuid');
    expect(list.statements[0]?.text).toContain('house_number_id = $4::uuid');
    expect(list.statements[0]?.text).toContain('active = $5');

    const single = createExecutor([
      {
        id: 'location-2',
        city_id: 'city-2',
        region_id: null,
        street_id: 'street-2',
        house_number_id: 'house-2',
        active: false,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(single.executor).getWasteCollectionLocationById('location-2')
    ).resolves.toEqual({
      id: 'location-2',
      cityId: 'city-2',
      regionId: undefined,
      streetId: 'street-2',
      houseNumberId: 'house-2',
      active: false,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    const write = createExecutor();
    await createWasteMasterDataRepository(write.executor).upsertWasteCollectionLocation({
      id: 'location-3',
      cityId: 'city-3',
      regionId: undefined,
      streetId: 'street-3',
      houseNumberId: undefined,
      active: true,
    });

    expect(write.statements[0]?.values).toEqual([
      'location-3',
      'city-3',
      null,
      'street-3',
      null,
      true,
    ]);
    expect(
      wasteMasterDataStatements.upsertWasteCollectionLocation({
        id: 'location-4',
        cityId: 'city-4',
        regionId: 'region-4',
        streetId: 'street-4',
        houseNumberId: 'house-4',
        active: false,
      }).values
    ).toEqual(['location-4', 'city-4', 'region-4', 'street-4', 'house-4', false]);

    expect(wasteMasterDataStatements.listWasteCollectionLocations({}).values).toEqual([]);
    expect(wasteMasterDataStatements.listWasteCollectionLocations({}).text).not.toContain('WHERE');
  });

  it('lists, reads and upserts tours with location counts and custom date payloads', async () => {
    const list = createExecutor([
      {
        id: 'tour-1',
        name: 'Tour Nord',
        description: 'Restmüll',
        waste_fraction_ids: ['fraction-1', 'fraction-2'],
        recurrence: 'custom',
        custom_recurrence_id: null,
        custom_recurrence_name: null,
        custom_recurrence_interval_days: null,
        first_date: '2026-01-15',
        end_date: null,
        custom_dates: [{ date: '2026-01-15', description: 'Sonderleerung' }],
        active: true,
        location_count: 3,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(list.executor).listWasteTours({
        active: true,
        recurrence: 'custom',
        wasteFractionId: 'fraction-1',
        search: 'Nord',
      })
    ).resolves.toEqual([
      {
        id: 'tour-1',
        name: 'Tour Nord',
        description: 'Restmüll',
        wasteFractionIds: ['fraction-1', 'fraction-2'],
        recurrence: 'custom',
        customRecurrenceId: undefined,
        customRecurrenceName: undefined,
        customRecurrenceIntervalDays: undefined,
        firstDate: '2026-01-15',
        endDate: undefined,
        customDates: [{ date: '2026-01-15', description: 'Sonderleerung' }],
        active: true,
        locationCount: 3,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);

    expect(list.statements[0]?.values).toEqual([true, 'custom', 'fraction-1', '%Nord%']);
    expect(list.statements[0]?.text).toContain('FROM waste_tours t');
    expect(list.statements[0]?.text).toContain('COUNT(ltl.id)::int AS location_count');

    const single = createExecutor([
      {
        id: 'tour-2',
        name: 'Tour Süd',
        description: null,
        waste_fraction_ids: null,
        recurrence: null,
        custom_recurrence_id: 'preset-10',
        custom_recurrence_name: '10 Tage',
        custom_recurrence_interval_days: 10,
        first_date: null,
        end_date: '2026-12-31',
        custom_dates: [{ invalid: true }],
        active: false,
        location_count: null,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(single.executor).getWasteTourById('tour-2')
    ).resolves.toEqual({
      id: 'tour-2',
      name: 'Tour Süd',
      description: undefined,
      wasteFractionIds: [],
      recurrence: null,
      customRecurrenceId: 'preset-10',
      customRecurrenceName: '10 Tage',
      customRecurrenceIntervalDays: 10,
      firstDate: undefined,
      endDate: '2026-12-31',
      customDates: [],
      active: false,
      locationCount: undefined,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    const write = createExecutor();
    await createWasteMasterDataRepository(write.executor).upsertWasteTour({
      id: 'tour-3',
      name: 'Tour West',
      description: undefined,
      wasteFractionIds: ['fraction-3'],
      recurrence: null,
      customRecurrenceId: 'preset-14',
      customRecurrenceName: '14 Tage',
      customRecurrenceIntervalDays: 14,
      firstDate: '2026-02-01',
      endDate: undefined,
      customDates: [{ date: '2026-02-01' }],
      active: true,
      locationCount: undefined,
    });

    expect(write.statements[0]?.values).toEqual([
      'tour-3',
      'Tour West',
      null,
      ['fraction-3'],
      null,
      'preset-14',
      '2026-02-01',
      null,
      JSON.stringify([{ date: '2026-02-01' }]),
      true,
    ]);
  });

  it('lists, reads and upserts custom recurrence presets', async () => {
    const list = createExecutor([
      {
        id: 'preset-10',
        name: '10 Tage',
        description: 'Ferienmodus',
        interval_days: 10,
        created_at: '2026-05-31T10:00:00.000Z',
        updated_at: '2026-05-31T10:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(list.executor).listWasteCustomRecurrencePresets()
    ).resolves.toEqual([
      {
        id: 'preset-10',
        name: '10 Tage',
        description: 'Ferienmodus',
        intervalDays: 10,
        createdAt: '2026-05-31T10:00:00.000Z',
        updatedAt: '2026-05-31T10:00:00.000Z',
      },
    ]);

    expect(list.statements[0]?.text).toContain('FROM waste_custom_recurrence_presets');

    const single = createExecutor([
      {
        id: 'preset-14',
        name: '14 Tage',
        description: null,
        interval_days: 14,
        created_at: '2026-05-31T10:00:00.000Z',
        updated_at: '2026-05-31T10:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(single.executor).getWasteCustomRecurrencePresetById(
        'preset-14'
      )
    ).resolves.toEqual({
      id: 'preset-14',
      name: '14 Tage',
      description: undefined,
      intervalDays: 14,
      createdAt: '2026-05-31T10:00:00.000Z',
      updatedAt: '2026-05-31T10:00:00.000Z',
    });

    const write = createExecutor();
    await createWasteMasterDataRepository(write.executor).upsertWasteCustomRecurrencePreset({
      id: 'preset-21',
      name: '21 Tage',
      description: undefined,
      intervalDays: 21,
    });

    expect(write.statements[0]?.values).toEqual(['preset-21', '21 Tage', null, 21]);
  });

  it('reads and upserts waste pdf static settings', async () => {
    const single = createExecutor([
      {
        pdf_branding_asset_url: 'https://cdn.example/logo.svg',
        pdf_contact_block: 'Abfallberatung 03395 / 1234',
        updated_at: '2026-06-30T10:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(single.executor).getWastePdfStaticSettings()
    ).resolves.toEqual({
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 1234',
      updatedAt: '2026-06-30T10:00:00.000Z',
    });

    expect(single.statements[0]?.text).toContain('FROM waste_settings');

    const write = createExecutor();
    await createWasteMasterDataRepository(write.executor).upsertWastePdfStaticSettings({
      pdfBrandingAssetUrl: 'https://cdn.example/logo-next.svg',
      pdfContactBlock: undefined,
    });

    expect(write.statements[0]?.values).toEqual([true, 'https://cdn.example/logo-next.svg', null]);
  });

  it('treats an all-empty waste pdf settings row as missing', async () => {
    const single = createExecutor([
      {
        pdf_branding_asset_url: null,
        pdf_contact_block: null,
        updated_at: '2026-06-30T10:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(single.executor).getWastePdfStaticSettings()
    ).resolves.toBeNull();
  });

  it('lists, reads and upserts location-tour links with date windows', async () => {
    const list = createExecutor([
      {
        id: 'link-1',
        location_id: 'location-1',
        tour_id: 'tour-1',
        start_date: '2026-05-01',
        end_date: '2026-12-31',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(list.executor).listWasteLocationTourLinks({
        locationId: 'location-1',
        tourId: 'tour-1',
      })
    ).resolves.toEqual([
      {
        id: 'link-1',
        locationId: 'location-1',
        tourId: 'tour-1',
        startDate: '2026-05-01',
        endDate: '2026-12-31',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);

    expect(list.statements[0]?.values).toEqual(['location-1', 'tour-1']);
    expect(list.statements[0]?.text).toContain('FROM waste_location_tour_links');

    const single = createExecutor([
      {
        id: 'link-2',
        location_id: 'location-2',
        tour_id: 'tour-2',
        start_date: '2026-06-01',
        end_date: null,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(single.executor).getWasteLocationTourLinkById('link-2')
    ).resolves.toEqual({
      id: 'link-2',
      locationId: 'location-2',
      tourId: 'tour-2',
      startDate: '2026-06-01',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    const write = createExecutor();
    await createWasteMasterDataRepository(write.executor).upsertWasteLocationTourLink({
      id: 'link-3',
      locationId: 'location-3',
      tourId: 'tour-3',
      startDate: '2026-07-01',
      endDate: '2026-12-31',
    });

    expect(write.statements[0]?.values).toEqual([
      'link-3',
      'location-3',
      'tour-3',
      '2026-07-01',
      '2026-12-31',
    ]);
    expect(write.statements[0]?.text).toContain('start_date');
    expect(write.statements[0]?.text).toContain('end_date');
  });

  it('lists, reads and upserts location-tour pickup dates idempotently by location, tour and pickup date', async () => {
    const list = createExecutor([
      {
        id: 'pickup-1',
        location_id: 'location-1',
        tour_id: 'tour-1',
        pickup_date: '2026-01-10',
        note: 'Nur bei Schnee',
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(list.executor).listWasteLocationTourPickupDates({
        locationId: 'location-1',
        tourId: 'tour-1',
        pickupDate: '2026-01-10',
      })
    ).resolves.toEqual([
      {
        id: 'pickup-1',
        locationId: 'location-1',
        tourId: 'tour-1',
        pickupDate: '2026-01-10',
        note: 'Nur bei Schnee',
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);

    expect(list.statements[0]?.values).toEqual(['location-1', 'tour-1', '2026-01-10']);
    expect(list.statements[0]?.text).toContain('FROM waste_location_tour_pickup_dates');
    expect(list.statements[0]?.text).toContain(
      `to_jsonb(waste_location_tour_pickup_dates)->>'note' AS note`
    );

    const single = createExecutor([
      {
        id: 'pickup-2',
        location_id: 'location-2',
        tour_id: 'tour-2',
        pickup_date: '2026-02-15',
        note: null,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(single.executor).getWasteLocationTourPickupDateById(
        'pickup-2'
      )
    ).resolves.toEqual({
      id: 'pickup-2',
      locationId: 'location-2',
      tourId: 'tour-2',
      pickupDate: '2026-02-15',
      note: null,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    const write = createExecutor();
    await createWasteMasterDataRepository(write.executor).upsertWasteLocationTourPickupDate({
      id: 'pickup-3',
      locationId: 'location-3',
      tourId: 'tour-3',
      pickupDate: '2026-03-20',
      note: 'Ersatztermin',
    });

    expect(write.statements[0]?.values).toEqual([
      'pickup-3',
      'location-3',
      'tour-3',
      '2026-03-20',
      'Ersatztermin',
    ]);
    expect(write.statements[0]?.text).toContain(
      'ON CONFLICT (location_id, tour_id, pickup_date) DO UPDATE'
    );
    expect(write.statements[0]?.text).toContain('SET note = EXCLUDED.note');
  });

  it('lists, reads and upserts tour and global date shifts', async () => {
    const tourShift = createExecutor([
      {
        id: 'shift-1',
        tour_id: 'tour-1',
        original_date: '12-24',
        actual_date: '12-23',
        has_year: false,
        reason_type: 'manual-adjustment',
        reason_key: 'xmas-pull-forward',
        follow_up_mode: 'none',
        description: null,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(tourShift.executor).listWasteTourDateShifts({
        tourId: 'tour-1',
        hasYear: false,
      })
    ).resolves.toEqual([
      {
        id: 'shift-1',
        tourId: 'tour-1',
        originalDate: '12-24',
        actualDate: '12-23',
        hasYear: false,
        reasonType: 'manual-adjustment',
        reasonKey: 'xmas-pull-forward',
        followUpMode: 'none',
        description: undefined,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);

    expect(tourShift.statements[0]?.values).toEqual(['tour-1', false]);
    expect(tourShift.statements[0]?.text).toContain('FROM waste_tour_date_shifts');

    const globalShift = createExecutor([
      {
        id: 'global-1',
        original_date: '2026-05-01',
        actual_date: '2026-05-02',
        has_year: true,
        reason_type: 'holiday',
        reason_key: 'labour-day',
        description: 'Feiertagsverschiebung',
        tour_ids: ['tour-1'],
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(globalShift.executor).listWasteGlobalDateShifts({
        hasYear: true,
        appliesToTourId: 'tour-1',
      })
    ).resolves.toEqual([
      {
        id: 'global-1',
        originalDate: '2026-05-01',
        actualDate: '2026-05-02',
        hasYear: true,
        reasonType: 'holiday',
        reasonKey: 'labour-day',
        description: 'Feiertagsverschiebung',
        tourIds: ['tour-1'],
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);

    expect(globalShift.statements[0]?.values).toEqual([true, 'tour-1']);
    expect(globalShift.statements[0]?.text).toContain('tour_ids IS NULL OR $2 = ANY(tour_ids)');

    const single = createExecutor([
      {
        id: 'global-2',
        original_date: '01-06',
        actual_date: '01-07',
        has_year: false,
        reason_type: null,
        reason_key: null,
        description: null,
        tour_ids: null,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(
      createWasteMasterDataRepository(single.executor).getWasteGlobalDateShiftById('global-2')
    ).resolves.toEqual({
      id: 'global-2',
      originalDate: '01-06',
      actualDate: '01-07',
      hasYear: false,
      reasonType: undefined,
      reasonKey: undefined,
      description: undefined,
      tourIds: undefined,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    const write = createExecutor();
    const repository = createWasteMasterDataRepository(write.executor);
    await repository.upsertWasteTourDateShift({
      id: 'shift-2',
      tourId: 'tour-2',
      originalDate: '2026-10-03',
      actualDate: '2026-10-04',
      hasYear: true,
      reasonType: 'manual-adjustment',
      reasonKey: 'national-day-delay',
      followUpMode: 'propagate-series',
      description: 'Einmalige Verschiebung',
    });
    await repository.upsertWasteGlobalDateShift({
      id: 'global-3',
      originalDate: '12-31',
      actualDate: '01-02',
      hasYear: false,
      reasonType: 'global-deviation',
      reasonKey: 'new-year-service-window',
      description: undefined,
      tourIds: ['tour-3', 'tour-4'],
    });

    expect(write.statements[0]?.values).toEqual([
      'shift-2',
      'tour-2',
      '2026-10-03',
      '2026-10-04',
      true,
      'manual-adjustment',
      'national-day-delay',
      'propagate-series',
      'Einmalige Verschiebung',
    ]);
    expect(write.statements[1]?.values).toEqual([
      'global-3',
      '12-31',
      '01-02',
      false,
      'global-deviation',
      'new-year-service-window',
      null,
      ['tour-3', 'tour-4'],
    ]);
  });
});

it('lists, upserts, and deletes holiday rule records with scope and strategy filters', async () => {
  const write = createExecutor();
  const writeRepository = createWasteMasterDataRepository(write.executor);

  await writeRepository.upsertWasteHolidayRule({
    id: 'holiday-rule-1',
    holidayDate: '2026-01-01',
    holidayName: 'Neujahr',
    year: 2026,
    stateCode: 'NW',
    sourceStatus: 'confirmed',
    configurationStatus: 'draft',
    conflictStatus: 'none',
    scope: 'holiday-only',
    strategy: 'advance',
    createdAt: '2026-05-31T10:00:00.000Z',
    updatedAt: '2026-05-31T10:00:00.000Z',
  });

  expect(write.statements[0]?.text).toContain('waste_holiday_rules');
  expect(write.statements[0]?.values).toEqual([
    'holiday-rule-1',
    '2026-01-01',
    'Neujahr',
    2026,
    'NW',
    'confirmed',
    'draft',
    'none',
    'holiday-only',
    'advance',
  ]);

  await writeRepository.deleteWasteHolidayRule('holiday-rule-1');

  expect(write.statements[1]?.text).toContain('DELETE FROM waste_holiday_rules');
  expect(write.statements[1]?.values).toEqual(['holiday-rule-1']);

  const list = createExecutor([
    {
      id: 'holiday-rule-1',
      holiday_date: '2026-01-01',
      holiday_name: 'Neujahr',
      year: 2026,
      state_code: 'NW',
      source_status: 'confirmed',
      configuration_status: 'configured',
      conflict_status: 'manual-global-rule',
      scope: 'full_week',
      strategy: 'postpone',
      created_at: '2026-05-31T10:00:00.000Z',
      updated_at: '2026-05-31T11:00:00.000Z',
    },
  ]);

  await expect(
    createWasteMasterDataRepository(list.executor).listWasteHolidayRules({
      stateCode: 'NW',
      year: 2026,
    })
  ).resolves.toEqual([
    {
      id: 'holiday-rule-1',
      holidayDate: '2026-01-01',
      holidayName: 'Neujahr',
      year: 2026,
      stateCode: 'NW',
      sourceStatus: 'confirmed',
      configurationStatus: 'configured',
      conflictStatus: 'manual-global-rule',
      scope: 'full-week',
      strategy: 'postpone',
      createdAt: '2026-05-31T10:00:00.000Z',
      updatedAt: '2026-05-31T11:00:00.000Z',
    },
  ]);

  expect(list.statements[0]?.text).toContain('FROM waste_holiday_rules');
  expect(list.statements[0]?.values).toEqual(['NW', 2026]);
});
