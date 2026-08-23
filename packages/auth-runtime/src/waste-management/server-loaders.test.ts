import { beforeEach, describe, expect, it, vi } from 'vitest';

const expectedTechnicalHistoryJobTypeIds = [
  'waste-management.initialize-data-source',
  'waste-management.apply-migrations',
  'waste-management.import-data',
  'waste-management.seed-data',
  'waste-management.reset-data',
  'waste-management.sync-waste-types',
  'waste-management.enrich-postal-codes',
] as const;

const resolveWasteDataSourceMock = vi.hoisted(() =>
  vi.fn(async () => ({
    instanceId: 'tenant-a',
    schemaName: 'wm',
    databaseUrl: 'postgres://waste:test@localhost:5432/waste',
    enabled: true,
  }))
);

const listWasteManagementAuditRecordsMock = vi.hoisted(() =>
  vi.fn(async () => ({
    items: [{ id: 'audit-1', occurredAt: '2026-05-09T08:00:00.000Z' }],
    total: 1,
  }))
);

const listWasteManagementTechnicalAuditRecordsMock = vi.hoisted(() =>
  vi.fn(async () => ({
    items: [
      {
        id: 'technical-audit-1',
        eventType: 'connection.check.failed',
        outcome: 'failure',
        occurredAt: '2026-05-09T09:00:00.000Z',
        source: 'audit',
      },
    ],
    total: 1,
  }))
);

const instanceDbQueryMock = vi.hoisted(() =>
  vi.fn(async () => ({
    rowCount: 3,
    rows: [
      {
        id: 'job-1',
        job_type_id: 'waste-management.apply-migrations',
        status: 'succeeded',
        finished_at: '2026-05-09T12:00:00.000Z',
        updated_at: '2026-05-09T12:00:00.000Z',
        request_id: 'req-1',
        latest_event_message: 'done',
        error_code: null,
        total_count: 4,
      },
      {
        id: 'job-2',
        job_type_id: 'waste-management.import-data',
        status: 'failed',
        finished_at: '2026-05-09T11:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
        request_id: 'req-2',
        latest_event_message: 'failed',
        error_code: 'import_failed',
        error_message: 'Import request failed loudly',
        total_count: 4,
      },
      {
        id: 'job-3',
        job_type_id: 'waste-management.seed-data',
        status: 'cancelled',
        finished_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T10:00:00.000Z',
        request_id: 'req-3',
        latest_event_message: 'cancelled',
        error_code: 'cancelled',
        error_message: null,
        total_count: 4,
      },
      {
        id: 'job-4',
        job_type_id: 'waste-management.sync-waste-types',
        status: 'succeeded',
        finished_at: '2026-05-09T09:00:00.000Z',
        updated_at: '2026-05-09T09:00:00.000Z',
        request_id: 'req-4',
        latest_event_message: 'synced',
        error_code: null,
        error_message: null,
        total_count: 4,
      },
    ],
  }))
);

const withInstanceDbMock = vi.hoisted(() =>
  vi.fn(async (instanceId: string, work: (client: object) => Promise<unknown>) =>
    work({ instanceId, kind: 'db-client', query: instanceDbQueryMock })
  )
);

const withStudioJobRepositoryMock = vi.hoisted(() =>
  vi.fn(
    async (
      instanceId: string,
      work: (repository: {
        listJobs: typeof listJobsMock;
        getJobDetail: typeof getJobDetailMock;
      }) => Promise<unknown>
    ) =>
      work({
        listJobs: listJobsMock,
        getJobDetail: getJobDetailMock,
      })
  )
);

const listJobsMock = vi.hoisted(() =>
  vi.fn(async () => ({
    items: [],
    total: 0,
  }))
);
const getJobDetailMock = vi.hoisted(() => vi.fn(async () => null));

const revealFieldMock = vi.hoisted(() => vi.fn(() => 'revealed-secret'));
const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const repositoryMocks = vi.hoisted(() => ({
  listWasteFractions: vi.fn(async () => [{ id: 'fraction-1' }]),
  listWasteRegions: vi.fn(async () => [{ id: 'region-1' }]),
  listWasteCities: vi.fn(async () => [{ id: 'city-1' }]),
  listWasteStreets: vi.fn(async () => [{ id: 'street-1' }]),
  listWasteHouseNumbers: vi.fn(async () => [{ id: 'house-1' }]),
  listWasteCollectionLocations: vi.fn(async () => [{ id: 'location-1' }]),
  getWastePdfStaticSettings: vi.fn(async () => ({
    pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
    pdfContactBlock: 'Abfallberatung',
  })),
  listWasteCustomRecurrencePresets: vi.fn(async () => [{ id: 'preset-1' }]),
  listWasteLocationTourLinks: vi.fn(async () => [{ id: 'link-1' }]),
  listWasteLocationTourLinksByTourId: vi.fn(async () => [{ id: 'link-1' }]),
  listWasteTourAssignments: vi.fn(async () => []),
  listWasteLocationTourPickupDates: vi.fn(async () => [{ id: 'pickup-date-1' }]),
  listWasteHolidayRules: vi.fn(async () => [{ id: 'holiday-rule-1' }]),
  listWasteTours: vi.fn(async () => [{ id: 'tour-1' }]),
  listWasteTourDateShifts: vi.fn(async () => [{ id: 'shift-1' }]),
  listWasteTourDateShiftsByTourId: vi.fn(async () => [{ id: 'shift-1' }]),
  listWasteGlobalDateShifts: vi.fn(async () => [{ id: 'global-shift-1' }]),
  getWasteFractionById: vi.fn(async (_id: string) => ({ id: 'fraction-1' })),
  upsertWasteFraction: vi.fn(async () => undefined),
  deleteWasteFraction: vi.fn(async () => undefined),
  getWasteRegionById: vi.fn(async (_id: string) => ({ id: 'region-1' })),
  upsertWasteRegion: vi.fn(async () => undefined),
  getWasteCityById: vi.fn(async (_id: string) => ({ id: 'city-1' })),
  upsertWasteCity: vi.fn(async () => undefined),
  updateWasteCity: vi.fn(async () => undefined),
  getWasteStreetById: vi.fn(async (_id: string) => ({ id: 'street-1' })),
  upsertWasteStreet: vi.fn(async () => undefined),
  getWasteHouseNumberById: vi.fn(async (_id: string) => ({ id: 'house-1' })),
  upsertWasteHouseNumber: vi.fn(async () => undefined),
  getWasteCollectionLocationById: vi.fn(async (_id: string) => ({ id: 'location-1' })),
  upsertWasteCollectionLocation: vi.fn(async () => undefined),
  deleteWasteCollectionLocation: vi.fn(async () => undefined),
  upsertWastePdfStaticSettings: vi.fn(async () => undefined),
  getWasteLocationTourLinkById: vi.fn(async (id: string) => ({
    id,
    locationId: 'location-1',
    tourId: 'tour-1',
  })),
  upsertWasteLocationTourLink: vi.fn(async () => undefined),
  deleteWasteLocationTourLink: vi.fn(async () => undefined),
  getWasteLocationTourPickupDateById: vi.fn(async (id: string) => ({ id })),
  upsertWasteLocationTourPickupDate: vi.fn(async () => undefined),
  deleteWasteLocationTourPickupDate: vi.fn(async () => undefined),
  getWasteCustomRecurrencePresetById: vi.fn(async (_id: string) => ({ id: 'preset-1' })),
  upsertWasteCustomRecurrencePreset: vi.fn(async () => undefined),
  deleteWasteCustomRecurrencePreset: vi.fn(async () => undefined),
  upsertWasteHolidayRule: vi.fn(async () => undefined),
  deleteWasteHolidayRule: vi.fn(async () => undefined),
  getWasteTourById: vi.fn(async (_id: string) => ({ id: 'tour-1' })),
  lockWasteToursByIds: vi.fn(async (ids: readonly string[]) =>
    ids.map((id) => ({
      id,
      recurrence: 'weekly',
      firstDate: '2026-01-01',
      endDate: '2026-12-31',
    }))
  ),
  updateWasteTourValidityBulk: vi.fn(
    async (input: { tourIds: readonly string[] }) => input.tourIds.length
  ),
  upsertWasteTour: vi.fn(async () => undefined),
  upsertWasteTourAssignment: vi.fn(async () => undefined),
  getWasteTourDateShiftById: vi.fn(async (_id: string) => ({ id: 'shift-1' })),
  insertWasteTourDateShift: vi.fn(async () => undefined),
  upsertWasteTourDateShift: vi.fn(async () => undefined),
  deleteWasteTourDateShift: vi.fn(async () => undefined),
  getWasteGlobalDateShiftById: vi.fn(async (_id: string) => ({ id: 'global-shift-1' })),
  upsertWasteGlobalDateShift: vi.fn(async () => undefined),
  deleteWasteGlobalDateShift: vi.fn(async () => undefined),
}));

const createWasteMasterDataRepositoryMock = vi.hoisted(() => vi.fn(() => repositoryMocks));
const poolFactoryInstances: Array<{
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}> = [];
const PoolMock = vi.hoisted(() =>
  vi.fn(function MockPool() {
    const query = vi.fn(async (text: string) => {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    });
    const release = vi.fn();
    const end = vi.fn(async () => undefined);
    poolFactoryInstances.push({ query, release, end });
    return {
      connect: vi.fn(async () => ({ query, release })),
      end,
    };
  })
);

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    createSdkLogger: vi.fn(() => loggerMock),
    resolveWasteDataSource: resolveWasteDataSourceMock,
  };
});

vi.mock('@sva/iam-governance', () => ({
  listWasteManagementAuditRecords: listWasteManagementAuditRecordsMock,
  listWasteManagementTechnicalAuditRecords: listWasteManagementTechnicalAuditRecordsMock,
}));

vi.mock('../db.js', () => ({
  withInstanceDb: withInstanceDbMock,
}));

vi.mock('../iam-account-management/encryption.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../iam-account-management/encryption.js')>();
  return {
    ...actual,
    revealField: revealFieldMock,
  };
});

vi.mock('../plugin-operations/repository.js', () => ({
  withStudioJobRepository: withStudioJobRepositoryMock,
}));

vi.mock('@sva/data-repositories', () => ({
  createWasteMasterDataRepository: createWasteMasterDataRepositoryMock,
}));

vi.mock('pg', () => ({
  Pool: PoolMock,
}));

import {
  wasteManagementEntityLoaders,
  wasteManagementEntitySavers,
  wasteManagementOverviewLoaders,
  wasteManagementServerLoaderInternals,
} from './server-loaders.js';

describe('waste-management server loaders', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    poolFactoryInstances.length = 0;
    await wasteManagementServerLoaderInternals.resetWastePoolCache();
  });

  it('loads overviews and maps technical job history deterministically', async () => {
    const masterDataOverview =
      await wasteManagementOverviewLoaders.loadMasterDataOverview('tenant-a');
    const toursOverview = await wasteManagementOverviewLoaders.loadToursOverview('tenant-a');
    const schedulingOverview =
      await wasteManagementOverviewLoaders.loadSchedulingOverview('tenant-a');
    const historyOverview = await wasteManagementOverviewLoaders.loadWasteHistoryOverview({
      instanceId: 'tenant-a',
      search: 'fraction',
      page: 1,
      pageSize: 10,
    });

    expect(resolveWasteDataSourceMock).toHaveBeenCalled();
    expect(masterDataOverview).toMatchObject({
      fractions: [{ id: 'fraction-1' }],
      regions: [{ id: 'region-1' }],
      cities: [{ id: 'city-1' }],
      streets: [{ id: 'street-1' }],
      houseNumbers: [{ id: 'house-1' }],
      collectionLocations: [{ id: 'location-1' }],
      locationTourLinks: [{ id: 'link-1' }],
    });
    expect(toursOverview).toEqual({
      tours: [{ id: 'tour-1' }],
      customRecurrencePresets: [{ id: 'preset-1' }],
    });
    expect(schedulingOverview).toEqual({
      tourAssignments: [],
      locationTourPickupDates: [{ id: 'pickup-date-1' }],
      tourDateShifts: [{ id: 'shift-1' }],
      globalDateShifts: [{ id: 'global-shift-1' }],
      holidayRules: [{ id: 'holiday-rule-1' }],
    });
    expect(withInstanceDbMock).toHaveBeenCalledTimes(3);
    expect(instanceDbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('FROM iam.studio_jobs j'),
      ['tenant-a', expect.any(Array), '%fraction%', 10]
    );
    expect(historyOverview.audit.total).toBe(1);
    expect(historyOverview.technical.total).toBe(5);
    expect(historyOverview.technical.items).toHaveLength(5);
    expect(historyOverview.technical.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'job:job-1:succeeded', eventType: 'migration.succeeded' }),
        expect.objectContaining({
          id: 'job:job-2:failed',
          eventType: 'import.failed',
          errorCode: 'import_failed',
          message: 'failed',
        }),
        expect.objectContaining({ id: 'job:job-3:cancelled', eventType: 'seed.failed' }),
        expect.objectContaining({
          id: 'job:job-4:succeeded',
          eventType: 'sync.succeeded',
          message: 'synced',
        }),
        expect.objectContaining({ id: 'technical-audit-1' }),
      ])
    );
    expect(PoolMock).toHaveBeenCalledTimes(1);
    expect(poolFactoryInstances.at(0)?.end).not.toHaveBeenCalled();
    expect(poolFactoryInstances.at(0)?.query).toHaveBeenCalledWith(
      'SET search_path TO "wm", public;'
    );
  });

  it('reuses the same scoped pool across multiple waste loader calls for one datasource', async () => {
    await wasteManagementOverviewLoaders.loadMasterDataOverview('tenant-a');
    await wasteManagementOverviewLoaders.loadToursOverview('tenant-a');
    await wasteManagementOverviewLoaders.loadSchedulingOverview('tenant-a');

    expect(resolveWasteDataSourceMock).toHaveBeenCalledTimes(3);
    expect(PoolMock).toHaveBeenCalledTimes(1);
    expect(poolFactoryInstances).toHaveLength(1);
    expect(poolFactoryInstances[0]?.end).not.toHaveBeenCalled();
  });

  it('emits timing logs for each master-data repository query', async () => {
    await wasteManagementOverviewLoaders.loadMasterDataOverview('tenant-a');

    const loggedRepositorySteps = loggerMock.info.mock.calls
      .filter(([message]) => message === 'waste_management_loader_timing')
      .map(([, payload]) => payload)
      .filter(
        (payload): payload is { readonly step: string } =>
          typeof payload === 'object' &&
          payload !== null &&
          'step' in payload &&
          typeof payload.step === 'string'
      )
      .map((payload) => payload.step);

    expect(loggedRepositorySteps).toEqual(
      expect.arrayContaining([
        'repository.list_waste_fractions',
        'repository.list_waste_regions',
        'repository.list_waste_cities',
        'repository.list_waste_streets',
        'repository.list_waste_house_numbers',
        'repository.list_waste_collection_locations',
        'repository.list_waste_location_tour_links',
      ])
    );
  });

  it('evicts stale waste pools after the idle ttl expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T09:00:00.000Z'));

    resolveWasteDataSourceMock.mockResolvedValueOnce({
      instanceId: 'tenant-a',
      schemaName: 'wm',
      databaseUrl: 'postgres://waste:test@localhost:5432/waste',
      enabled: true,
    });

    await wasteManagementOverviewLoaders.loadMasterDataOverview('tenant-a');

    vi.setSystemTime(new Date('2026-05-15T09:06:00.000Z'));
    resolveWasteDataSourceMock.mockResolvedValueOnce({
      instanceId: 'tenant-b',
      schemaName: 'wm',
      databaseUrl: 'postgres://waste:test@localhost:5432/waste-b',
      enabled: true,
    });

    await wasteManagementOverviewLoaders.loadToursOverview('tenant-b');

    expect(poolFactoryInstances).toHaveLength(2);
    expect(poolFactoryInstances[0]?.end).toHaveBeenCalledTimes(1);
    expect(poolFactoryInstances[1]?.end).not.toHaveBeenCalled();
  });

  it('loads a fractions-only master-data overview without the location hierarchy', async () => {
    const overview =
      await wasteManagementOverviewLoaders.loadMasterDataFractionsOverview('tenant-a');

    expect(overview).toEqual({
      fractions: [{ id: 'fraction-1' }],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    });
    expect(repositoryMocks.listWasteFractions).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listWasteRegions).not.toHaveBeenCalled();
    expect(repositoryMocks.listWasteCities).not.toHaveBeenCalled();
    expect(repositoryMocks.listWasteStreets).not.toHaveBeenCalled();
    expect(repositoryMocks.listWasteHouseNumbers).not.toHaveBeenCalled();
    expect(repositoryMocks.listWasteCollectionLocations).not.toHaveBeenCalled();
    expect(repositoryMocks.listWasteLocationTourLinks).not.toHaveBeenCalled();
  });

  it('loads a locations-only master-data overview with tour links and without fractions', async () => {
    const overview =
      await wasteManagementOverviewLoaders.loadMasterDataLocationsOverview('tenant-a');

    expect(overview).toEqual({
      fractions: [],
      regions: [{ id: 'region-1' }],
      cities: [{ id: 'city-1' }],
      streets: [{ id: 'street-1' }],
      houseNumbers: [{ id: 'house-1' }],
      collectionLocations: [{ id: 'location-1' }],
      locationTourLinks: [{ id: 'link-1' }],
    });
    expect(repositoryMocks.listWasteFractions).not.toHaveBeenCalled();
    expect(repositoryMocks.listWasteRegions).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listWasteCities).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listWasteStreets).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listWasteHouseNumbers).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listWasteCollectionLocations).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listWasteLocationTourLinks).toHaveBeenCalledTimes(1);
  });

  it('loads a targeting-only master-data overview without tour links or fractions', async () => {
    const overview =
      await wasteManagementOverviewLoaders.loadMasterDataTargetingOverview('tenant-a');

    expect(overview).toEqual({
      fractions: [],
      regions: [{ id: 'region-1' }],
      cities: [{ id: 'city-1' }],
      streets: [{ id: 'street-1' }],
      houseNumbers: [{ id: 'house-1' }],
      collectionLocations: [{ id: 'location-1' }],
      locationTourLinks: [],
    });
    expect(repositoryMocks.listWasteFractions).not.toHaveBeenCalled();
    expect(repositoryMocks.listWasteRegions).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listWasteCities).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listWasteStreets).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listWasteHouseNumbers).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listWasteCollectionLocations).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listWasteLocationTourLinks).not.toHaveBeenCalled();
  });

  it('normalizes technical job timestamps when pg returns Date objects', async () => {
    instanceDbQueryMock.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        {
          id: 'job-date-1',
          job_type_id: 'waste-management.apply-migrations',
          status: 'succeeded',
          finished_at: new Date('2026-05-09T12:00:00.000Z'),
          updated_at: new Date('2026-05-09T12:00:00.000Z'),
          request_id: 'req-date-1',
          latest_event_message: 'done',
          error_code: null,
          error_message: null,
          total_count: 2,
        },
        {
          id: 'job-date-2',
          job_type_id: 'waste-management.import-data',
          status: 'failed',
          finished_at: null,
          updated_at: new Date('2026-05-09T11:30:00.000Z'),
          request_id: 'req-date-2',
          latest_event_message: 'failed',
          error_code: 'import_failed',
          error_message: 'Import request failed loudly',
          total_count: 2,
        },
      ],
    });

    const historyOverview = await wasteManagementOverviewLoaders.loadWasteHistoryOverview({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 10,
    });

    expect(historyOverview.technical.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'job:job-date-1:succeeded',
          occurredAt: '2026-05-09T12:00:00.000Z',
        }),
        expect.objectContaining({
          id: 'job:job-date-2:failed',
          occurredAt: '2026-05-09T11:30:00.000Z',
        }),
      ])
    );
  });

  it('delegates entity loaders, savers, and bulk link creation through the scoped repository', async () => {
    await expect(
      wasteManagementEntityLoaders.loadWasteCustomRecurrencePresets('tenant-a')
    ).resolves.toEqual([{ id: 'preset-1' }]);
    await expect(
      wasteManagementEntityLoaders.loadWasteFractionById('tenant-a', 'fraction-1')
    ).resolves.toEqual({ id: 'fraction-1' });
    await expect(
      wasteManagementEntityLoaders.loadWasteRegionById('tenant-a', 'region-1')
    ).resolves.toEqual({ id: 'region-1' });
    await expect(
      wasteManagementEntityLoaders.loadWasteCityById('tenant-a', 'city-1')
    ).resolves.toEqual({ id: 'city-1' });
    await expect(
      wasteManagementEntityLoaders.loadWasteStreetById('tenant-a', 'street-1')
    ).resolves.toEqual({ id: 'street-1' });
    await expect(
      wasteManagementEntityLoaders.loadWasteHouseNumberById('tenant-a', 'house-1')
    ).resolves.toEqual({ id: 'house-1' });
    await expect(
      wasteManagementEntityLoaders.loadWasteCollectionLocationById('tenant-a', 'location-1')
    ).resolves.toEqual({ id: 'location-1' });
    await expect(
      wasteManagementEntityLoaders.loadWasteLocationTourLinkById('tenant-a', 'link-1')
    ).resolves.toEqual({
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
    });
    await expect(
      wasteManagementEntityLoaders.listWasteLocationTourLinksByTourId('tenant-a', 'tour-1')
    ).resolves.toEqual([{ id: 'link-1' }]);
    await expect(
      wasteManagementEntityLoaders.loadWasteTourById('tenant-a', 'tour-1')
    ).resolves.toEqual({ id: 'tour-1' });
    await expect(
      wasteManagementEntityLoaders.loadWasteTourDateShiftById('tenant-a', 'shift-1')
    ).resolves.toEqual({ id: 'shift-1' });
    await expect(
      wasteManagementEntityLoaders.listWasteTourDateShiftsByTourId('tenant-a', 'tour-1')
    ).resolves.toEqual([{ id: 'shift-1' }]);
    await expect(
      wasteManagementEntityLoaders.loadWasteGlobalDateShiftById('tenant-a', 'global-shift-1')
    ).resolves.toEqual({ id: 'global-shift-1' });

    await wasteManagementEntitySavers.saveWasteCustomRecurrencePresets('tenant-a', {
      nextItems: [{ id: 'preset-2', name: '14 Tage', intervalDays: 14 }],
      deletedPresetFallbacks: {},
    });
    await wasteManagementEntitySavers.saveWasteFraction('tenant-a', { id: 'fraction-2' } as never);
    await wasteManagementEntitySavers.saveWasteRegion('tenant-a', { id: 'region-2' } as never);
    await wasteManagementEntitySavers.saveWasteCity('tenant-a', { id: 'city-2' } as never);
    await wasteManagementEntitySavers.patchWasteCity('tenant-a', 'city-2', {
      postalCode: '19336',
    });
    await wasteManagementEntitySavers.saveWasteStreet('tenant-a', { id: 'street-2' } as never);
    await wasteManagementEntitySavers.saveWasteHouseNumber('tenant-a', { id: 'house-2' } as never);
    await wasteManagementEntitySavers.saveWasteCollectionLocation('tenant-a', {
      id: 'location-2',
    } as never);
    await wasteManagementEntitySavers.deleteWasteCollectionLocation('tenant-a', 'location-2');
    await wasteManagementEntitySavers.saveWasteLocationTourLink('tenant-a', {
      id: 'link-2',
    } as never);
    await wasteManagementEntitySavers.deleteWasteLocationTourLink('tenant-a', 'link-2');
    await wasteManagementEntitySavers.saveWasteTour('tenant-a', { id: 'tour-2' } as never);
    await wasteManagementEntitySavers.deleteWasteTourDateShift('tenant-a', 'shift-2');
    await wasteManagementEntitySavers.createWasteTourDateShift('tenant-a', {
      id: 'shift-created',
    } as never);
    await wasteManagementEntitySavers.saveWasteTourDateShift('tenant-a', {
      id: 'shift-2',
    } as never);
    await wasteManagementEntitySavers.deleteWasteGlobalDateShift('tenant-a', 'global-shift-2');
    await wasteManagementEntitySavers.saveWasteGlobalDateShift('tenant-a', {
      id: 'global-shift-2',
    } as never);

    const bulkResult = await wasteManagementEntitySavers.saveWasteLocationTourLinksBulk(
      'tenant-a',
      {
        locationIds: ['location-10', 'location-11'],
        tourId: 'tour-1',
        startDate: '2026-05-01',
        endDate: '2026-12-31',
      }
    );

    expect(repositoryMocks.upsertWasteCustomRecurrencePreset).toHaveBeenCalledWith({
      id: 'preset-2',
      name: '14 Tage',
      intervalDays: 14,
    });
    expect(repositoryMocks.upsertWasteFraction).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteRegion).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteCity).toHaveBeenCalled();
    expect(repositoryMocks.updateWasteCity).toHaveBeenCalledWith('city-2', {
      postalCode: '19336',
    });
    expect(repositoryMocks.upsertWasteStreet).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteHouseNumber).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteCollectionLocation).toHaveBeenCalled();
    expect(repositoryMocks.deleteWasteCollectionLocation).toHaveBeenCalledWith('location-2');
    expect(repositoryMocks.upsertWasteLocationTourLink).toHaveBeenCalled();
    expect(repositoryMocks.deleteWasteLocationTourLink).toHaveBeenCalledWith('link-2');
    expect(repositoryMocks.upsertWasteTour).toHaveBeenCalled();
    expect(repositoryMocks.insertWasteTourDateShift).toHaveBeenCalledWith({
      id: 'shift-created',
    });
    expect(repositoryMocks.deleteWasteTourDateShift).toHaveBeenCalledWith('shift-2');
    expect(repositoryMocks.upsertWasteTourDateShift).toHaveBeenCalled();
    expect(repositoryMocks.deleteWasteGlobalDateShift).toHaveBeenCalledWith('global-shift-2');
    expect(repositoryMocks.upsertWasteGlobalDateShift).toHaveBeenCalled();
    expect(repositoryMocks.listWasteLocationTourLinksByTourId).toHaveBeenCalledWith('tour-1');
    expect(repositoryMocks.listWasteTourDateShiftsByTourId).toHaveBeenCalledWith('tour-1');
    expect(bulkResult).toHaveLength(2);
    expect(PoolMock).toHaveBeenCalledTimes(1);
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('BEGIN');
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('COMMIT');
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith(
      'SET search_path TO "wm", public;'
    );
    expect(poolFactoryInstances.at(-1)?.end).not.toHaveBeenCalled();
  });

  it('updates tour validity atomically after locking and validating every tour', async () => {
    const result = await wasteManagementEntitySavers.updateWasteTourValidityBulk('tenant-a', {
      tourIds: ['tour-1', 'tour-2'],
      firstDate: { mode: 'set', value: '2026-02-01' },
      endDate: { mode: 'clear' },
    });

    expect(result).toEqual({ updatedCount: 2 });
    expect(repositoryMocks.lockWasteToursByIds).toHaveBeenCalledWith(['tour-1', 'tour-2']);
    expect(repositoryMocks.updateWasteTourValidityBulk).toHaveBeenCalledWith({
      tourIds: ['tour-1', 'tour-2'],
      firstDate: { mode: 'set', value: '2026-02-01' },
      endDate: { mode: 'clear' },
    });
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('BEGIN');
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('COMMIT');
  });

  it('creates the selected annual tour set under an advisory lock in one transaction', async () => {
    const sourceTour = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Bio Nord',
      wasteFractionIds: ['bio'],
      recurrence: 'weekly' as const,
      firstDate: '2026-01-05',
      endDate: '2026-12-31',
      active: true,
      locationCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    repositoryMocks.listWasteTours
      .mockResolvedValueOnce([sourceTour])
      .mockResolvedValueOnce([sourceTour]);
    repositoryMocks.listWasteLocationTourLinks
      .mockResolvedValueOnce([
        {
          id: '22222222-2222-4222-8222-222222222222',
          tourId: sourceTour.id,
          locationId: '33333333-3333-4333-8333-333333333333',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: '22222222-2222-4222-8222-222222222222',
          tourId: sourceTour.id,
          locationId: '33333333-3333-4333-8333-333333333333',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
    repositoryMocks.listWasteLocationTourPickupDates
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    repositoryMocks.listWasteTourAssignments.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    repositoryMocks.listWasteTourDateShifts.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const preview = await wasteManagementOverviewLoaders.previewWasteAnnualTourTransfer({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      selectedTourIds: [sourceTour.id],
    });
    const result = await wasteManagementEntitySavers.createWasteAnnualTourTransfer({
      instanceId: 'tenant-a',
      create: {
        sourceYear: 2026,
        selectedTourIds: [sourceTour.id],
        replacementDates: [],
        acknowledgedConflictTourIds: [],
        previewFingerprint: preview.previewFingerprint,
      },
    });

    expect(result).toMatchObject({ sourceYear: 2026, targetYear: 2027, createdCount: 1 });
    expect(repositoryMocks.upsertWasteTour).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bio Nord', active: false })
    );
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));',
      ['tenant-a', 'waste-annual-tour-transfer:2027']
    );
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith(
      expect.stringContaining('IN SHARE ROW EXCLUSIVE MODE')
    );
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('COMMIT');

    const persistedTargetTour = {
      ...repositoryMocks.upsertWasteTour.mock.calls.at(-1)?.[0],
      createdAt: '2027-01-01T00:00:00.000Z',
      updatedAt: '2027-01-01T00:00:00.000Z',
    };
    const persistedTargetLink = {
      ...repositoryMocks.upsertWasteLocationTourLink.mock.calls.at(-1)?.[0],
      createdAt: '2027-01-01T00:00:00.000Z',
      updatedAt: '2027-01-01T00:00:00.000Z',
    };
    const sourceLink = {
      id: '22222222-2222-4222-8222-222222222222',
      tourId: sourceTour.id,
      locationId: '33333333-3333-4333-8333-333333333333',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    repositoryMocks.listWasteTours
      .mockResolvedValueOnce([sourceTour, persistedTargetTour])
      .mockResolvedValueOnce([sourceTour, persistedTargetTour]);
    repositoryMocks.listWasteLocationTourLinks
      .mockResolvedValueOnce([sourceLink, persistedTargetLink])
      .mockResolvedValueOnce([sourceLink, persistedTargetLink]);
    repositoryMocks.listWasteLocationTourPickupDates
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    repositoryMocks.listWasteTourAssignments.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    repositoryMocks.listWasteTourDateShifts.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const repeatedPreview = await wasteManagementOverviewLoaders.previewWasteAnnualTourTransfer({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      selectedTourIds: [sourceTour.id],
    });
    const repeated = await wasteManagementEntitySavers.createWasteAnnualTourTransfer({
      instanceId: 'tenant-a',
      create: {
        sourceYear: 2026,
        selectedTourIds: [sourceTour.id],
        replacementDates: [],
        acknowledgedConflictTourIds: [],
        previewFingerprint: repeatedPreview.previewFingerprint,
      },
    });

    expect(repeated).toMatchObject({ createdCount: 0, existingCount: 1 });
  });

  it('writes large annual relationship sets in bounded JSON batches', async () => {
    const sourceTour = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Bio Nord',
      wasteFractionIds: ['bio'],
      recurrence: 'weekly' as const,
      firstDate: '2026-01-05',
      endDate: '2026-12-31',
      active: true,
      locationCount: 101,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    const links = Array.from({ length: 101 }, (_, index) => ({
      id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
      tourId: sourceTour.id,
      locationId: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    repositoryMocks.listWasteTours
      .mockResolvedValueOnce([sourceTour])
      .mockResolvedValueOnce([sourceTour]);
    repositoryMocks.listWasteLocationTourLinks
      .mockResolvedValueOnce(links)
      .mockResolvedValueOnce(links);
    repositoryMocks.listWasteLocationTourPickupDates
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    repositoryMocks.listWasteTourAssignments.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    repositoryMocks.listWasteTourDateShifts.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const preview = await wasteManagementOverviewLoaders.previewWasteAnnualTourTransfer({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      selectedTourIds: [sourceTour.id],
    });
    await wasteManagementEntitySavers.createWasteAnnualTourTransfer({
      instanceId: 'tenant-a',
      create: {
        sourceYear: 2026,
        selectedTourIds: [sourceTour.id],
        replacementDates: [],
        acknowledgedConflictTourIds: [],
        previewFingerprint: preview.previewFingerprint,
      },
    });

    expect(repositoryMocks.upsertWasteLocationTourLink).not.toHaveBeenCalled();
    const bulkCall = poolFactoryInstances
      .at(-1)
      ?.query.mock.calls.find(([text]) =>
        String(text).includes('INSERT INTO waste_location_tour_links')
      );
    expect(bulkCall).toBeDefined();
    expect(JSON.parse(String(bulkCall?.[1]?.[0]))).toHaveLength(101);
  });

  it('rolls back the complete annual tour set when a relationship write fails', async () => {
    const sourceTour = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Bio Nord',
      wasteFractionIds: ['bio'],
      recurrence: 'weekly' as const,
      firstDate: '2026-01-05',
      endDate: '2026-12-31',
      active: true,
      locationCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    repositoryMocks.listWasteTours
      .mockResolvedValueOnce([sourceTour])
      .mockResolvedValueOnce([sourceTour]);
    repositoryMocks.listWasteLocationTourLinks
      .mockResolvedValueOnce([
        {
          id: '22222222-2222-4222-8222-222222222222',
          tourId: sourceTour.id,
          locationId: '33333333-3333-4333-8333-333333333333',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: '22222222-2222-4222-8222-222222222222',
          tourId: sourceTour.id,
          locationId: '33333333-3333-4333-8333-333333333333',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
    repositoryMocks.listWasteLocationTourPickupDates
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    repositoryMocks.listWasteTourAssignments.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    repositoryMocks.listWasteTourDateShifts.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const preview = await wasteManagementOverviewLoaders.previewWasteAnnualTourTransfer({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      selectedTourIds: [sourceTour.id],
    });
    repositoryMocks.upsertWasteLocationTourLink.mockRejectedValueOnce(new Error('write failed'));

    await expect(
      wasteManagementEntitySavers.createWasteAnnualTourTransfer({
        instanceId: 'tenant-a',
        create: {
          sourceYear: 2026,
          selectedTourIds: [sourceTour.id],
          replacementDates: [],
          acknowledgedConflictTourIds: [],
          previewFingerprint: preview.previewFingerprint,
        },
      })
    ).rejects.toThrow('write failed');
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('ROLLBACK');
    expect(poolFactoryInstances.at(-1)?.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('rolls back tour validity changes when one resulting range is invalid', async () => {
    repositoryMocks.lockWasteToursByIds.mockResolvedValueOnce([
      {
        id: 'tour-1',
        recurrence: 'weekly',
        firstDate: '2026-05-01',
        endDate: '2026-12-31',
      },
    ]);

    await expect(
      wasteManagementEntitySavers.updateWasteTourValidityBulk('tenant-a', {
        tourIds: ['tour-1'],
        firstDate: { mode: 'unchanged' },
        endDate: { mode: 'set', value: '2026-04-30' },
      })
    ).rejects.toThrow('bulk_tour_validity_invalid_range:tour-1');

    expect(repositoryMocks.updateWasteTourValidityBulk).not.toHaveBeenCalled();
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rolls back instead of clearing the recurrence start anchor', async () => {
    await expect(
      wasteManagementEntitySavers.updateWasteTourValidityBulk('tenant-a', {
        tourIds: ['tour-1'],
        firstDate: { mode: 'clear' },
        endDate: { mode: 'unchanged' },
      })
    ).rejects.toThrow('bulk_tour_validity_first_date_required:tour-1');

    expect(repositoryMocks.updateWasteTourValidityBulk).not.toHaveBeenCalled();
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('requires explicit fallback mappings before deleting referenced custom recurrence presets', async () => {
    repositoryMocks.listWasteCustomRecurrencePresets.mockResolvedValueOnce([
      {
        id: 'preset-10',
        name: '10 Tage',
        intervalDays: 10,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
    ]);
    repositoryMocks.listWasteTours.mockResolvedValueOnce([
      {
        id: 'tour-1',
        name: 'Tour Nord',
        wasteFractionIds: ['fraction-1'],
        recurrence: null,
        customRecurrenceId: 'preset-10',
        active: true,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
    ]);

    await expect(
      wasteManagementEntitySavers.saveWasteCustomRecurrencePresets('tenant-a', {
        nextItems: [],
        deletedPresetFallbacks: {},
      })
    ).rejects.toThrowError('custom_recurrence_fallback_required:preset-10');
  });

  it('validates custom recurrence fallback targets before persisting updated presets', async () => {
    repositoryMocks.listWasteCustomRecurrencePresets.mockResolvedValueOnce([
      {
        id: 'preset-10',
        name: '10 Tage',
        intervalDays: 10,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
      {
        id: 'preset-20',
        name: '14 Tage',
        intervalDays: 14,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
    ]);
    repositoryMocks.listWasteTours.mockResolvedValueOnce([
      {
        id: 'tour-1',
        name: 'Tour Nord',
        wasteFractionIds: ['fraction-1'],
        recurrence: null,
        customRecurrenceId: 'preset-10',
        active: true,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
    ]);

    await expect(
      wasteManagementEntitySavers.saveWasteCustomRecurrencePresets('tenant-a', {
        nextItems: [{ id: 'preset-20', name: '14 Tage (neu)', intervalDays: 21 }],
        deletedPresetFallbacks: {
          'preset-10': {
            kind: 'preset',
            value: 'preset-999',
          },
        },
      })
    ).rejects.toThrowError('custom_recurrence_fallback_invalid:preset-10');

    expect(repositoryMocks.upsertWasteCustomRecurrencePreset).not.toHaveBeenCalledWith({
      id: 'preset-20',
      name: '14 Tage (neu)',
      intervalDays: 21,
    });
  });

  it('rolls back the bulk location-tour-link transaction when verification fails', async () => {
    repositoryMocks.getWasteLocationTourLinkById.mockResolvedValueOnce(null);

    await expect(
      wasteManagementEntitySavers.saveWasteLocationTourLinksBulk('tenant-a', {
        locationIds: ['location-20'],
        tourId: 'tour-1',
        startDate: '2026-06-01',
        endDate: '2026-12-31',
      })
    ).rejects.toThrowError(/^bulk_location_tour_link_verification_failed:/);

    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('invalidates a scoped pool after a connection failure and recreates it on the next call', async () => {
    let connectCalls = 0;
    PoolMock.mockImplementationOnce(function MockPoolWithBrokenConnect() {
      const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
      const release = vi.fn();
      const end = vi.fn(async () => undefined);
      poolFactoryInstances.push({ query, release, end });
      return {
        connect: vi.fn(async () => {
          connectCalls += 1;
          throw new Error('connect_failed');
        }),
        end,
      };
    });

    await expect(wasteManagementOverviewLoaders.loadToursOverview('tenant-a')).rejects.toThrow(
      'connect_failed'
    );
    await expect(wasteManagementOverviewLoaders.loadToursOverview('tenant-a')).resolves.toEqual({
      tours: [{ id: 'tour-1' }],
      customRecurrencePresets: [{ id: 'preset-1' }],
    });

    expect(connectCalls).toBe(1);
    expect(PoolMock).toHaveBeenCalledTimes(2);
    expect(poolFactoryInstances).toHaveLength(2);
    expect(poolFactoryInstances[0]?.end).toHaveBeenCalledTimes(1);
    expect(poolFactoryInstances[1]?.end).not.toHaveBeenCalled();
  });

  it('marks missing holidays as not-confirmed and flags conflicts with manual global shifts during sync', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T08:00:00.000Z'));
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const year = Number(new URL(url).searchParams.get('jahr'));
      return new Response(
        JSON.stringify(
          year === 2026
            ? {
                Neujahr: { datum: '2026-01-01', hinweis: '' },
              }
            : {}
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    repositoryMocks.listWasteHolidayRules.mockResolvedValueOnce([
      {
        id: 'holiday-rule-existing',
        holidayDate: '2026-01-01',
        holidayName: 'Neujahr',
        year: 2026,
        stateCode: 'NW',
        sourceStatus: 'confirmed',
        configurationStatus: 'draft',
        conflictStatus: 'none',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'holiday-rule-stale',
        holidayDate: '2026-05-01',
        holidayName: 'Tag der Arbeit',
        year: 2026,
        stateCode: 'NW',
        sourceStatus: 'confirmed',
        configurationStatus: 'draft',
        conflictStatus: 'none',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    repositoryMocks.listWasteGlobalDateShifts.mockResolvedValueOnce([
      {
        id: 'global-shift-1',
        originalDate: '2026-01-01',
        actualDate: '2026-01-02',
        hasYear: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    try {
      await expect(
        wasteManagementEntitySavers.syncWasteHolidayRules('tenant-a', 'NW')
      ).resolves.toBe('success');
    } finally {
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    }

    expect(repositoryMocks.upsertWasteHolidayRule).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'holiday-rule-existing',
        holidayDate: '2026-01-01',
        holidayName: 'Neujahr',
        sourceStatus: 'confirmed',
        conflictStatus: 'manual-global-rule',
      })
    );
    expect(repositoryMocks.upsertWasteHolidayRule).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'holiday-rule-stale',
        holidayDate: '2026-05-01',
        holidayName: 'Tag der Arbeit',
        sourceStatus: 'not-confirmed',
      })
    );
  });

  it('returns partial_success and failed from holiday sync depending on yearly fetch outcomes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T12:00:00.000Z'));
    const originalFetch = globalThis.fetch;
    repositoryMocks.listWasteHolidayRules.mockResolvedValue([]);
    repositoryMocks.listWasteGlobalDateShifts.mockResolvedValue([]);

    try {
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const year = Number(new URL(url).searchParams.get('jahr'));
        if (year === 2027) {
          return new Response('down', { status: 503 });
        }
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof globalThis.fetch;

      await expect(
        wasteManagementEntitySavers.syncWasteHolidayRules('tenant-a', 'NW')
      ).resolves.toBe('partial_success');

      globalThis.fetch = vi.fn(async () => {
        throw new Error('network_down');
      }) as typeof globalThis.fetch;

      await expect(
        wasteManagementEntitySavers.syncWasteHolidayRules('tenant-a', 'NW')
      ).resolves.toBe('failed');
    } finally {
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    }
  });

  it('delegates preview and pickup-date or holiday-rule entity helpers through the scoped repository', async () => {
    repositoryMocks.listWasteHolidayRules.mockResolvedValueOnce([{ id: 'holiday-rule-1' }]);

    const preview = await wasteManagementOverviewLoaders.previewWasteLocationTourPickupDateImport({
      instanceId: 'tenant-a',
      sourceFormat: 'text/csv',
      blobRef: 'data:text/csv;base64,Zm9v',
      delimiterOverride: ';',
    });
    expect(preview).toBeDefined();

    await expect(
      wasteManagementEntityLoaders.loadWasteLocationTourPickupDateById('tenant-a', 'pickup-date-1')
    ).resolves.toEqual({ id: 'pickup-date-1' });
    await expect(
      wasteManagementEntityLoaders.loadWasteHolidayRuleById('tenant-a', 'holiday-rule-1')
    ).resolves.toEqual({
      id: 'holiday-rule-1',
    });

    await wasteManagementEntitySavers.saveWasteLocationTourPickupDate('tenant-a', {
      id: 'pickup-date-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      pickupDate: '2026-05-12',
      note: null,
    });
    await wasteManagementEntitySavers.deleteWasteLocationTourPickupDate(
      'tenant-a',
      'pickup-date-1'
    );

    expect(repositoryMocks.getWasteLocationTourPickupDateById).toHaveBeenCalledWith(
      'pickup-date-1'
    );
    expect(repositoryMocks.upsertWasteLocationTourPickupDate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pickup-date-1' })
    );
    expect(repositoryMocks.deleteWasteLocationTourPickupDate).toHaveBeenCalledWith('pickup-date-1');
  });

  it('delegates remaining waste saver helpers and falls back to a count query on later technical-history pages', async () => {
    instanceDbQueryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'job-unknown',
          job_type_id: 'waste-management.unknown-job',
          status: 'failed',
          finished_at: '2026-05-09T05:00:00.000Z',
          updated_at: '2026-05-09T05:00:00.000Z',
          request_id: 'req-unknown',
          latest_event_message: 'unknown',
          error_code: 'unknown',
          error_message: 'Unknown job type',
        },
      ],
    });
    instanceDbQueryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ total_count: 7 }],
    });

    await expect(
      wasteManagementOverviewLoaders.loadWasteHistoryOverview({
        instanceId: 'tenant-a',
        page: 2,
        pageSize: 5,
      })
    ).resolves.toMatchObject({
      technical: {
        total: 8,
      },
    });

    await wasteManagementEntitySavers.deleteWasteFraction('tenant-a', 'fraction-1');
    await wasteManagementEntitySavers.saveWasteHolidayRule('tenant-a', {
      id: 'holiday-rule-2',
      holidayDate: '2026-05-01',
      holidayName: 'Tag der Arbeit',
      year: 2026,
      stateCode: 'NW',
      sourceStatus: 'confirmed',
      configurationStatus: 'configured',
      conflictStatus: 'none',
      scope: 'holiday-only',
      strategy: 'advance',
    });
    await wasteManagementEntitySavers.deleteWasteHolidayRule('tenant-a', 'holiday-rule-2');

    expect(repositoryMocks.deleteWasteFraction).toHaveBeenCalledWith('fraction-1');
    expect(repositoryMocks.upsertWasteHolidayRule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'holiday-rule-2' })
    );
    expect(repositoryMocks.deleteWasteHolidayRule).toHaveBeenCalledWith('holiday-rule-2');
  });

  it('keeps technical history stable when jobs are unfinished or have unknown mappings', async () => {
    instanceDbQueryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'job-reset',
          job_type_id: 'waste-management.reset-data',
          status: 'failed',
          finished_at: null,
          updated_at: '2026-05-09T05:00:00.000Z',
          request_id: 'req-reset',
          latest_event_message: 'reset failed',
          error_code: 'reset_failed',
          error_message: 'Reset failed for request req-reset',
          total_count: 1,
        },
      ],
    });

    const historyOverview = await wasteManagementOverviewLoaders.loadWasteHistoryOverview({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 5,
    });

    expect(historyOverview.technical.items).toEqual([
      expect.objectContaining({
        id: 'technical-audit-1',
      }),
      expect.objectContaining({
        id: 'job:job-reset:failed',
        eventType: 'reset.failed',
        occurredAt: '2026-05-09T05:00:00.000Z',
      }),
    ]);
    expect(historyOverview.technical.total).toBe(2);
  });

  it('maps initialize jobs into the technical history stream', async () => {
    instanceDbQueryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'job-init',
          job_type_id: 'waste-management.initialize-data-source',
          status: 'succeeded',
          finished_at: '2026-05-09T13:00:00.000Z',
          updated_at: '2026-05-09T13:00:00.000Z',
          request_id: 'req-init',
          latest_event_message: 'initialized',
          error_code: null,
          error_message: null,
          total_count: 1,
        },
      ],
    });

    const historyOverview = await wasteManagementOverviewLoaders.loadWasteHistoryOverview({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 5,
    });

    expect(historyOverview.technical.items).toEqual([
      expect.objectContaining({
        id: 'job:job-init:succeeded',
        eventType: 'datasource.reconfigured',
        outcome: 'success',
      }),
      expect.objectContaining({ id: 'technical-audit-1' }),
    ]);
  });

  it('maps postal-code enrichment jobs into the technical history stream', async () => {
    instanceDbQueryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'job-postal-codes',
          job_type_id: 'waste-management.enrich-postal-codes',
          status: 'succeeded',
          finished_at: '2026-08-14T13:00:00.000Z',
          updated_at: '2026-08-14T13:00:00.000Z',
          request_id: 'req-postal-codes',
          latest_event_message: 'postal codes enriched',
          error_code: null,
          error_message: null,
          total_count: 1,
        },
      ],
    });

    const historyOverview = await wasteManagementOverviewLoaders.loadWasteHistoryOverview({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 5,
    });

    expect(historyOverview.technical.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'job:job-postal-codes:succeeded',
          eventType: 'postal-code-enrichment.succeeded',
          outcome: 'success',
          jobStatus: 'succeeded',
        }),
      ])
    );
  });

  it('preserves cancelled terminal job status in technical history', async () => {
    instanceDbQueryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'job-cancelled',
          job_type_id: 'waste-management.enrich-postal-codes',
          status: 'cancelled',
          finished_at: '2026-08-14T13:00:00.000Z',
          updated_at: '2026-08-14T13:00:00.000Z',
          request_id: 'req-cancelled',
          latest_event_message: 'cancelled',
          error_code: 'cancelled',
          error_message: null,
          total_count: 1,
        },
      ],
    });

    const historyOverview = await wasteManagementOverviewLoaders.loadWasteHistoryOverview({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 5,
    });

    expect(historyOverview.technical.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'job:job-cancelled:cancelled',
          outcome: 'failure',
          jobStatus: 'cancelled',
        }),
      ])
    );
  });

  it('returns the latest active postal-code job through the waste history facade', async () => {
    listJobsMock.mockResolvedValueOnce({
      items: [{ id: 'postal-job-active' }],
      total: 1,
    } as never);
    getJobDetailMock.mockResolvedValueOnce({
      id: 'postal-job-active',
      jobTypeId: 'waste-management.enrich-postal-codes',
      status: 'running',
      progress: { details: { processedCities: 9, totalCities: 298 } },
    } as never);

    const historyOverview = await wasteManagementOverviewLoaders.loadWasteHistoryOverview({
      instanceId: 'tenant-a',
      page: 1,
      pageSize: 5,
    });

    expect(historyOverview.latestPostalCodeJob).toMatchObject({
      id: 'postal-job-active',
      status: 'running',
    });
    expect(listJobsMock).toHaveBeenCalledWith('tenant-a', {
      view: 'active',
      page: 1,
      pageSize: 1,
      pluginId: 'waste-management',
      jobTypeId: 'waste-management.enrich-postal-codes',
    });
  });

  it('searches technical job history across request and diagnosis fields', async () => {
    await wasteManagementOverviewLoaders.loadWasteHistoryOverview({
      instanceId: 'tenant-a',
      search: 'req-2',
      page: 1,
      pageSize: 10,
    });

    expect(instanceDbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("COALESCE(j.request_id, '') ILIKE $3"),
      ['tenant-a', expectedTechnicalHistoryJobTypeIds, '%req-2%', 10]
    );
    expect(instanceDbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("COALESCE(j.error_payload ->> 'message', '') ILIKE $3"),
      ['tenant-a', expectedTechnicalHistoryJobTypeIds, '%req-2%', 10]
    );
    expect(instanceDbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("COALESCE(j.error_payload ->> 'code', '') ILIKE $3"),
      ['tenant-a', expectedTechnicalHistoryJobTypeIds, '%req-2%', 10]
    );
  });

  it('paginates technical history across audit and job sources in global chronology', async () => {
    listWasteManagementTechnicalAuditRecordsMock.mockImplementation(
      async (_client, query: { page: number; pageSize: number }) => {
        const itemsByPage = {
          1: [
            {
              id: 'technical-audit-1',
              eventType: 'connection.check.failed',
              outcome: 'failure',
              occurredAt: '2026-05-09T13:00:00.000Z',
              source: 'audit',
            },
            {
              id: 'technical-audit-2',
              eventType: 'connection.check.failed',
              outcome: 'failure',
              occurredAt: '2026-05-09T11:00:00.000Z',
              source: 'audit',
            },
          ],
          2: [
            {
              id: 'technical-audit-3',
              eventType: 'connection.check.failed',
              outcome: 'failure',
              occurredAt: '2026-05-09T09:00:00.000Z',
              source: 'audit',
            },
          ],
        } as const;

        return {
          items: itemsByPage[query.page as 1 | 2] ?? [],
          total: 3,
        };
      }
    );

    instanceDbQueryMock.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        {
          id: 'job-1',
          job_type_id: 'waste-management.apply-migrations',
          status: 'succeeded',
          finished_at: '2026-05-09T12:00:00.000Z',
          updated_at: '2026-05-09T12:00:00.000Z',
          request_id: 'req-1',
          latest_event_message: 'done',
          error_code: null,
          total_count: 2,
        },
        {
          id: 'job-2',
          job_type_id: 'waste-management.import-data',
          status: 'failed',
          finished_at: '2026-05-09T10:00:00.000Z',
          updated_at: '2026-05-09T10:00:00.000Z',
          request_id: 'req-2',
          latest_event_message: 'failed',
          error_code: 'import_failed',
          total_count: 2,
        },
      ],
    });

    const historyOverview = await wasteManagementOverviewLoaders.loadWasteHistoryOverview({
      instanceId: 'tenant-a',
      page: 2,
      pageSize: 2,
    });

    expect(historyOverview.technical.total).toBe(5);
    expect(historyOverview.technical.items).toEqual([
      expect.objectContaining({
        id: 'technical-audit-2',
        occurredAt: '2026-05-09T11:00:00.000Z',
      }),
      expect.objectContaining({
        id: 'job:job-2:failed',
        occurredAt: '2026-05-09T10:00:00.000Z',
      }),
    ]);
    expect(listWasteManagementTechnicalAuditRecordsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ page: 1, pageSize: 2 })
    );
    expect(listWasteManagementTechnicalAuditRecordsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ page: 2, pageSize: 2 })
    );
    expect(instanceDbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('FROM iam.studio_jobs j'),
      ['tenant-a', expectedTechnicalHistoryJobTypeIds, 4]
    );
  });
});
