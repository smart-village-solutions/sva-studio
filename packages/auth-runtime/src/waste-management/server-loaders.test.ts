import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveWasteDataSourceMock = vi.hoisted(() => vi.fn(async () => ({
  instanceId: 'tenant-a',
  schemaName: 'wm',
  databaseUrl: 'postgres://waste:test@localhost:5432/waste',
  serviceRoleKey: 'service-key',
  projectUrl: 'https://tenant.example',
  enabled: true,
})));

const listWasteManagementAuditRecordsMock = vi.hoisted(() => vi.fn(async () => ({
  items: [{ id: 'audit-1', occurredAt: '2026-05-09T08:00:00.000Z' }],
  total: 1,
})));

const listWasteManagementTechnicalAuditRecordsMock = vi.hoisted(() => vi.fn(async () => ({
  items: [{
    id: 'technical-audit-1',
    eventType: 'connection.check.failed',
    outcome: 'failure',
    occurredAt: '2026-05-09T09:00:00.000Z',
    source: 'audit',
  }],
  total: 1,
})));

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
        total_count: 3,
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
        total_count: 3,
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
        total_count: 3,
      },
    ],
  }))
);

const withInstanceDbMock = vi.hoisted(() => vi.fn(async (instanceId: string, work: (client: object) => Promise<unknown>) =>
  work({ instanceId, kind: 'db-client', query: instanceDbQueryMock })
));

const withStudioJobRepositoryMock = vi.hoisted(() =>
  vi.fn(async (instanceId: string, work: (repository: { listJobs: typeof listJobsMock }) => Promise<unknown>) =>
    work({
      listJobs: listJobsMock,
    })
  )
);

const listJobsMock = vi.hoisted(() => vi.fn(async () => ({
  items: [
    {
      id: 'job-1',
      jobTypeId: 'waste-management.apply-migrations',
      status: 'succeeded',
      finishedAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:00:00.000Z',
      requestId: 'req-1',
      latestEvent: { message: 'done' },
      errorPayload: undefined,
    },
    {
      id: 'job-2',
      jobTypeId: 'waste-management.import-data',
      status: 'failed',
      finishedAt: '2026-05-09T11:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
      requestId: 'req-2',
      latestEvent: { message: 'failed' },
      errorPayload: { code: 'import_failed' },
    },
    {
      id: 'job-3',
      jobTypeId: 'waste-management.seed-data',
      status: 'cancelled',
      finishedAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
      requestId: 'req-3',
      latestEvent: { message: 'cancelled' },
      errorPayload: { code: 'cancelled' },
    },
    {
      id: 'job-4',
      jobTypeId: 'other-job',
      status: 'succeeded',
      finishedAt: '2026-05-09T07:00:00.000Z',
      updatedAt: '2026-05-09T07:00:00.000Z',
      requestId: 'req-4',
      latestEvent: { message: 'ignored' },
      errorPayload: undefined,
    },
    {
      id: 'job-5',
      jobTypeId: 'waste-management.reset-data',
      status: 'running',
      finishedAt: null,
      updatedAt: '2026-05-09T06:00:00.000Z',
      requestId: 'req-5',
      latestEvent: { message: 'running' },
      errorPayload: undefined,
    },
  ],
  total: 5,
})));

const revealFieldMock = vi.hoisted(() => vi.fn(() => 'revealed-secret'));
const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const mediaStoragePortMock = vi.hoisted(() => ({
  readObject: vi.fn(async () => ({
    body: new TextEncoder().encode(JSON.stringify({ years: [2026] })),
    byteSize: 16,
    contentType: 'application/json',
  })),
  writeObject: vi.fn(async ({ body }: { body: Uint8Array }) => ({
    byteSize: body.byteLength,
    etag: 'etag-1',
  })),
  resolveDelivery: vi.fn(async ({ storageKey }: { storageKey: string }) => ({
    deliveryUrl: `https://cdn.example/${storageKey}`,
    expiresAt: '2026-05-21T12:00:00.000Z',
    contentType: 'application/pdf',
  })),
}));

const repositoryMocks = vi.hoisted(() => ({
  listWasteFractions: vi.fn(async () => [{ id: 'fraction-1' }]),
  listWasteRegions: vi.fn(async () => [{ id: 'region-1' }]),
  listWasteCities: vi.fn(async () => [{ id: 'city-1' }]),
  listWasteStreets: vi.fn(async () => [{ id: 'street-1' }]),
  listWasteHouseNumbers: vi.fn(async () => [{ id: 'house-1' }]),
  listWasteCollectionLocations: vi.fn(async () => [{ id: 'location-1' }]),
  listWasteLocationTourLinks: vi.fn(async () => [{ id: 'link-1' }]),
  listWasteLocationTourPickupDates: vi.fn(async () => [{ id: 'pickup-date-1' }]),
  listWasteTours: vi.fn(async () => [{ id: 'tour-1' }]),
  listWasteTourDateShifts: vi.fn(async () => [{ id: 'shift-1' }]),
  listWasteGlobalDateShifts: vi.fn(async () => [{ id: 'global-shift-1' }]),
  getWasteFractionById: vi.fn(async (_id: string) => ({ id: 'fraction-1' })),
  upsertWasteFraction: vi.fn(async () => undefined),
  getWasteRegionById: vi.fn(async (_id: string) => ({ id: 'region-1' })),
  upsertWasteRegion: vi.fn(async () => undefined),
  getWasteCityById: vi.fn(async (_id: string) => ({ id: 'city-1' })),
  upsertWasteCity: vi.fn(async () => undefined),
  getWasteStreetById: vi.fn(async (_id: string) => ({ id: 'street-1' })),
  upsertWasteStreet: vi.fn(async () => undefined),
  getWasteHouseNumberById: vi.fn(async (_id: string) => ({ id: 'house-1' })),
  upsertWasteHouseNumber: vi.fn(async () => undefined),
  getWasteCollectionLocationById: vi.fn(async (_id: string) => ({ id: 'location-1' })),
  upsertWasteCollectionLocation: vi.fn(async () => undefined),
  deleteWasteCollectionLocation: vi.fn(async () => undefined),
  getWasteLocationTourLinkById: vi.fn(async (id: string) => ({ id, locationId: 'location-1', tourId: 'tour-1' })),
  upsertWasteLocationTourLink: vi.fn(async () => undefined),
  deleteWasteLocationTourLink: vi.fn(async () => undefined),
  getWasteTourById: vi.fn(async (_id: string) => ({ id: 'tour-1' })),
  upsertWasteTour: vi.fn(async () => undefined),
  getWasteTourDateShiftById: vi.fn(async (_id: string) => ({ id: 'shift-1' })),
  upsertWasteTourDateShift: vi.fn(async () => undefined),
  deleteWasteTourDateShift: vi.fn(async () => undefined),
  getWasteGlobalDateShiftById: vi.fn(async (_id: string) => ({ id: 'global-shift-1' })),
  upsertWasteGlobalDateShift: vi.fn(async () => undefined),
  deleteWasteGlobalDateShift: vi.fn(async () => undefined),
}));

const createWasteMasterDataRepositoryMock = vi.hoisted(() => vi.fn(() => repositoryMocks));
const poolFactoryInstances: Array<{ query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }> = [];
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

vi.mock('../iam-media/storage-s3.js', () => ({
  createConfiguredMediaStoragePort: () => mediaStoragePortMock,
}));

vi.mock('pg', () => ({
  Pool: PoolMock,
}));

import {
  wasteManagementEntityLoaders,
  wasteManagementEntitySavers,
  wasteManagementOutputLoaders,
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
    const masterDataOverview = await wasteManagementOverviewLoaders.loadMasterDataOverview('tenant-a');
    const toursOverview = await wasteManagementOverviewLoaders.loadToursOverview('tenant-a');
    const schedulingOverview = await wasteManagementOverviewLoaders.loadSchedulingOverview('tenant-a');
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
    expect(toursOverview).toEqual({ tours: [{ id: 'tour-1' }] });
    expect(schedulingOverview).toEqual({
      locationTourPickupDates: [{ id: 'pickup-date-1' }],
      tourDateShifts: [{ id: 'shift-1' }],
      globalDateShifts: [{ id: 'global-shift-1' }],
    });
    expect(withInstanceDbMock).toHaveBeenCalledTimes(3);
    expect(instanceDbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('FROM iam.plugin_operation_jobs j'),
      ['tenant-a', expect.any(Array), '%fraction%', 10]
    );
    expect(historyOverview.audit.total).toBe(1);
    expect(historyOverview.technical.total).toBe(4);
    expect(historyOverview.technical.items).toEqual([
      expect.objectContaining({ id: 'job:job-1:succeeded', eventType: 'migration.succeeded' }),
      expect.objectContaining({
        id: 'job:job-2:failed',
        eventType: 'import.failed',
        errorCode: 'import_failed',
        message: 'failed',
      }),
      expect.objectContaining({ id: 'job:job-3:cancelled', eventType: 'seed.failed' }),
      expect.objectContaining({ id: 'technical-audit-1' }),
    ]);
    expect(PoolMock).toHaveBeenCalledTimes(1);
    expect(poolFactoryInstances.at(0)?.end).not.toHaveBeenCalled();
    expect(poolFactoryInstances.at(0)?.query).toHaveBeenCalledWith('SET search_path TO "wm", public;');
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
          typeof payload === 'object' && payload !== null && 'step' in payload && typeof payload.step === 'string'
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

  it('resolves stored pdf output links for collection locations from the storage index', async () => {
    repositoryMocks.listWasteCollectionLocations.mockResolvedValueOnce([
      {
        id: 'location-1',
        cityId: 'city-1',
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const overview = await wasteManagementOutputLoaders.loadWasteOutputOverview('tenant-a');

    expect(mediaStoragePortMock.readObject).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      storageKey: 'waste-output/collection-locations/location-1/index.json',
    });
    expect(mediaStoragePortMock.resolveDelivery).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      assetId: 'waste-output.location-1.2026',
      storageKey: 'waste-output/collection-locations/location-1/2026.pdf',
      visibility: 'private',
    });
    expect(overview).toEqual({
      collectionLocations: [
        {
          collectionLocationId: 'location-1',
          pdfs: [
            {
              year: 2026,
              deliveryUrl: 'https://cdn.example/waste-output/collection-locations/location-1/2026.pdf',
              expiresAt: '2026-05-21T12:00:00.000Z',
            },
          ],
        },
      ],
    });
  });

  it('renders, stores and indexes waste output pdfs deterministically', async () => {
    repositoryMocks.getWasteCollectionLocationById.mockResolvedValueOnce({
      id: 'location-1',
      regionId: 'region-1',
      cityId: 'city-1',
      streetId: 'street-1',
      houseNumberId: 'house-1',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    repositoryMocks.listWasteRegions.mockResolvedValueOnce([{ id: 'region-1', name: 'Havelland', createdAt: '', updatedAt: '' }]);
    repositoryMocks.listWasteCities.mockResolvedValueOnce([{ id: 'city-1', name: 'Rathenow', regionId: 'region-1', createdAt: '', updatedAt: '' }]);
    repositoryMocks.listWasteStreets.mockResolvedValueOnce([{ id: 'street-1', name: 'Berliner Str.', cityId: 'city-1', createdAt: '', updatedAt: '' }]);
    repositoryMocks.listWasteHouseNumbers.mockResolvedValueOnce([{ id: 'house-1', number: '12', streetId: 'street-1', createdAt: '', updatedAt: '' }]);
    repositoryMocks.listWasteLocationTourLinks.mockResolvedValueOnce([
      { id: 'link-1', locationId: 'location-1', tourId: 'tour-1', createdAt: '', updatedAt: '' },
    ]);
    repositoryMocks.listWasteTours.mockResolvedValueOnce([
      {
        id: 'tour-1',
        name: 'Nord',
        wasteFractionIds: ['fraction-1'],
        recurrence: null,
        active: true,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    repositoryMocks.listWasteFractions.mockResolvedValueOnce([
      {
        id: 'fraction-1',
        name: 'Bioabfall',
        color: '#00AA00',
        active: true,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    repositoryMocks.listWasteLocationTourPickupDates.mockResolvedValueOnce([
      { id: 'pickup-1', locationId: 'location-1', tourId: 'tour-1', pickupDate: '2026-01-14', createdAt: '', updatedAt: '' },
    ]);
    repositoryMocks.listWasteTourDateShifts.mockResolvedValueOnce([]);
    repositoryMocks.listWasteGlobalDateShifts.mockResolvedValueOnce([]);
    mediaStoragePortMock.readObject.mockRejectedValueOnce(new Error('missing_index'));

    const result = await wasteManagementOutputLoaders.generateWasteOutputPdf({
      instanceId: 'tenant-a',
      collectionLocationId: 'location-1',
      year: 2026,
    });

    expect(mediaStoragePortMock.writeObject).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        storageKey: 'waste-output/collection-locations/location-1/2026.pdf',
        contentType: 'application/pdf',
      })
    );
    expect(mediaStoragePortMock.writeObject).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        storageKey: 'waste-output/collection-locations/location-1/index.json',
        contentType: 'application/json',
      })
    );
    expect(result).toMatchObject({
      collectionLocationId: 'location-1',
      year: 2026,
      storageKey: 'waste-output/collection-locations/location-1/2026.pdf',
      deliveryUrl: 'https://cdn.example/waste-output/collection-locations/location-1/2026.pdf',
    });
    const pdfWrite = mediaStoragePortMock.writeObject.mock.calls.find(
      ([input]: readonly [{ readonly storageKey: string }]) =>
        input.storageKey === 'waste-output/collection-locations/location-1/2026.pdf'
    );
    const pdfText = Buffer.from((pdfWrite?.[0].body as Uint8Array | undefined) ?? new Uint8Array()).toString('latin1');
    expect(pdfText).toContain('Havelland, Rathenow, Berliner Str. 12');
  });

  it('evicts stale waste pools after the idle ttl expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T09:00:00.000Z'));

    resolveWasteDataSourceMock.mockResolvedValueOnce({
      instanceId: 'tenant-a',
      schemaName: 'wm',
      databaseUrl: 'postgres://waste:test@localhost:5432/waste',
      serviceRoleKey: 'service-key',
      projectUrl: 'https://tenant.example',
      enabled: true,
    });

    await wasteManagementOverviewLoaders.loadMasterDataOverview('tenant-a');

    vi.setSystemTime(new Date('2026-05-15T09:06:00.000Z'));
    resolveWasteDataSourceMock.mockResolvedValueOnce({
      instanceId: 'tenant-b',
      schemaName: 'wm',
      databaseUrl: 'postgres://waste:test@localhost:5432/waste-b',
      serviceRoleKey: 'service-key',
      projectUrl: 'https://tenant.example',
      enabled: true,
    });

    await wasteManagementOverviewLoaders.loadToursOverview('tenant-b');

    expect(poolFactoryInstances).toHaveLength(2);
    expect(poolFactoryInstances[0]?.end).toHaveBeenCalledTimes(1);
    expect(poolFactoryInstances[1]?.end).not.toHaveBeenCalled();
  });

  it('loads a fractions-only master-data overview without the location hierarchy', async () => {
    const overview = await wasteManagementOverviewLoaders.loadMasterDataFractionsOverview('tenant-a');

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

  it('loads a locations-only master-data overview without fractions', async () => {
    const overview = await wasteManagementOverviewLoaders.loadMasterDataLocationsOverview('tenant-a');

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
    await expect(wasteManagementEntityLoaders.loadWasteFractionById('tenant-a', 'fraction-1')).resolves.toEqual({ id: 'fraction-1' });
    await expect(wasteManagementEntityLoaders.loadWasteRegionById('tenant-a', 'region-1')).resolves.toEqual({ id: 'region-1' });
    await expect(wasteManagementEntityLoaders.loadWasteCityById('tenant-a', 'city-1')).resolves.toEqual({ id: 'city-1' });
    await expect(wasteManagementEntityLoaders.loadWasteStreetById('tenant-a', 'street-1')).resolves.toEqual({ id: 'street-1' });
    await expect(wasteManagementEntityLoaders.loadWasteHouseNumberById('tenant-a', 'house-1')).resolves.toEqual({ id: 'house-1' });
    await expect(wasteManagementEntityLoaders.loadWasteCollectionLocationById('tenant-a', 'location-1')).resolves.toEqual({ id: 'location-1' });
    await expect(wasteManagementEntityLoaders.loadWasteLocationTourLinkById('tenant-a', 'link-1')).resolves.toEqual({
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
    });
    await expect(wasteManagementEntityLoaders.loadWasteTourById('tenant-a', 'tour-1')).resolves.toEqual({ id: 'tour-1' });
    await expect(wasteManagementEntityLoaders.loadWasteTourDateShiftById('tenant-a', 'shift-1')).resolves.toEqual({ id: 'shift-1' });
    await expect(wasteManagementEntityLoaders.loadWasteGlobalDateShiftById('tenant-a', 'global-shift-1')).resolves.toEqual({ id: 'global-shift-1' });

    await wasteManagementEntitySavers.saveWasteFraction('tenant-a', { id: 'fraction-2' } as never);
    await wasteManagementEntitySavers.saveWasteRegion('tenant-a', { id: 'region-2' } as never);
    await wasteManagementEntitySavers.saveWasteCity('tenant-a', { id: 'city-2' } as never);
    await wasteManagementEntitySavers.saveWasteStreet('tenant-a', { id: 'street-2' } as never);
    await wasteManagementEntitySavers.saveWasteHouseNumber('tenant-a', { id: 'house-2' } as never);
    await wasteManagementEntitySavers.saveWasteCollectionLocation('tenant-a', { id: 'location-2' } as never);
    await wasteManagementEntitySavers.deleteWasteCollectionLocation('tenant-a', 'location-2');
    await wasteManagementEntitySavers.saveWasteLocationTourLink('tenant-a', { id: 'link-2' } as never);
    await wasteManagementEntitySavers.deleteWasteLocationTourLink('tenant-a', 'link-2');
    await wasteManagementEntitySavers.saveWasteTour('tenant-a', { id: 'tour-2' } as never);
    await wasteManagementEntitySavers.deleteWasteTourDateShift('tenant-a', 'shift-2');
    await wasteManagementEntitySavers.saveWasteTourDateShift('tenant-a', { id: 'shift-2' } as never);
    await wasteManagementEntitySavers.deleteWasteGlobalDateShift('tenant-a', 'global-shift-2');
    await wasteManagementEntitySavers.saveWasteGlobalDateShift('tenant-a', { id: 'global-shift-2' } as never);

    const bulkResult = await wasteManagementEntitySavers.saveWasteLocationTourLinksBulk('tenant-a', {
      locationIds: ['location-10', 'location-11'],
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: '2026-12-31',
    });

    expect(repositoryMocks.upsertWasteFraction).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteRegion).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteCity).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteStreet).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteHouseNumber).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteCollectionLocation).toHaveBeenCalled();
    expect(repositoryMocks.deleteWasteCollectionLocation).toHaveBeenCalledWith('location-2');
    expect(repositoryMocks.upsertWasteLocationTourLink).toHaveBeenCalled();
    expect(repositoryMocks.deleteWasteLocationTourLink).toHaveBeenCalledWith('link-2');
    expect(repositoryMocks.upsertWasteTour).toHaveBeenCalled();
    expect(repositoryMocks.deleteWasteTourDateShift).toHaveBeenCalledWith('shift-2');
    expect(repositoryMocks.upsertWasteTourDateShift).toHaveBeenCalled();
    expect(repositoryMocks.deleteWasteGlobalDateShift).toHaveBeenCalledWith('global-shift-2');
    expect(repositoryMocks.upsertWasteGlobalDateShift).toHaveBeenCalled();
    expect(bulkResult).toHaveLength(2);
    expect(PoolMock).toHaveBeenCalledTimes(1);
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('BEGIN');
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('COMMIT');
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('SET search_path TO "wm", public;');
    expect(poolFactoryInstances.at(-1)?.end).not.toHaveBeenCalled();
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

    await expect(wasteManagementOverviewLoaders.loadToursOverview('tenant-a')).rejects.toThrow('connect_failed');
    await expect(wasteManagementOverviewLoaders.loadToursOverview('tenant-a')).resolves.toEqual({
      tours: [{ id: 'tour-1' }],
    });

    expect(connectCalls).toBe(1);
    expect(PoolMock).toHaveBeenCalledTimes(2);
    expect(poolFactoryInstances).toHaveLength(2);
    expect(poolFactoryInstances[0]?.end).toHaveBeenCalledTimes(1);
    expect(poolFactoryInstances[1]?.end).not.toHaveBeenCalled();
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

  it('searches technical job history across request and diagnosis fields', async () => {
    await wasteManagementOverviewLoaders.loadWasteHistoryOverview({
      instanceId: 'tenant-a',
      search: 'req-2',
      page: 1,
      pageSize: 10,
    });

    expect(instanceDbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("COALESCE(j.request_id, '') ILIKE $3"),
      ['tenant-a', expect.any(Array), '%req-2%', 10]
    );
    expect(instanceDbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("COALESCE(j.error_payload ->> 'message', '') ILIKE $3"),
      ['tenant-a', expect.any(Array), '%req-2%', 10]
    );
    expect(instanceDbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("COALESCE(j.error_payload ->> 'code', '') ILIKE $3"),
      ['tenant-a', expect.any(Array), '%req-2%', 10]
    );
  });

  it('paginates technical history across audit and job sources in global chronology', async () => {
    listWasteManagementTechnicalAuditRecordsMock.mockImplementation(async (_client, query: { page: number; pageSize: number }) => {
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
    });

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
      expect.stringContaining('FROM iam.plugin_operation_jobs j'),
      ['tenant-a', expect.any(Array), 4]
    );
  });
});
