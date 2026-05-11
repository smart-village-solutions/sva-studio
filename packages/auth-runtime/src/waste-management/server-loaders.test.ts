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

const withInstanceDbMock = vi.hoisted(() => vi.fn(async (instanceId: string, work: (client: object) => Promise<unknown>) =>
  work({ instanceId, kind: 'db-client' })
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

const repositoryMocks = vi.hoisted(() => ({
  listWasteFractions: vi.fn(async () => [{ id: 'fraction-1' }]),
  listWasteRegions: vi.fn(async () => [{ id: 'region-1' }]),
  listWasteCities: vi.fn(async () => [{ id: 'city-1' }]),
  listWasteStreets: vi.fn(async () => [{ id: 'street-1' }]),
  listWasteHouseNumbers: vi.fn(async () => [{ id: 'house-1' }]),
  listWasteCollectionLocations: vi.fn(async () => [{ id: 'location-1' }]),
  listWasteLocationTourLinks: vi.fn(async () => [{ id: 'link-1' }]),
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
  getWasteLocationTourLinkById: vi.fn(async (id: string) => ({ id, locationId: 'location-1', tourId: 'tour-1' })),
  upsertWasteLocationTourLink: vi.fn(async () => undefined),
  getWasteTourById: vi.fn(async (_id: string) => ({ id: 'tour-1' })),
  upsertWasteTour: vi.fn(async () => undefined),
  getWasteTourDateShiftById: vi.fn(async (_id: string) => ({ id: 'shift-1' })),
  upsertWasteTourDateShift: vi.fn(async () => undefined),
  getWasteGlobalDateShiftById: vi.fn(async (_id: string) => ({ id: 'global-shift-1' })),
  upsertWasteGlobalDateShift: vi.fn(async () => undefined),
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

import { wasteManagementEntityLoaders, wasteManagementEntitySavers, wasteManagementOverviewLoaders } from './server-loaders.js';

describe('waste-management server loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    poolFactoryInstances.length = 0;
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
      tourDateShifts: [{ id: 'shift-1' }],
      globalDateShifts: [{ id: 'global-shift-1' }],
    });
    expect(withInstanceDbMock).toHaveBeenCalledTimes(2);
    expect(listJobsMock).toHaveBeenCalledWith('tenant-a', {
      view: 'history',
      page: 1,
      pageSize: 10,
      pluginId: 'waste-management',
      q: 'fraction',
    });
    expect(historyOverview.audit.total).toBe(1);
    expect(historyOverview.technical.total).toBe(4);
    expect(historyOverview.technical.items).toEqual([
      expect.objectContaining({ id: 'job:job-1:succeeded', eventType: 'migration.succeeded' }),
      expect.objectContaining({ id: 'job:job-2:failed', eventType: 'import.failed', errorCode: 'import_failed' }),
      expect.objectContaining({ id: 'job:job-3:cancelled', eventType: 'seed.failed' }),
      expect.objectContaining({ id: 'technical-audit-1' }),
    ]);
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
    await wasteManagementEntitySavers.saveWasteLocationTourLink('tenant-a', { id: 'link-2' } as never);
    await wasteManagementEntitySavers.saveWasteTour('tenant-a', { id: 'tour-2' } as never);
    await wasteManagementEntitySavers.saveWasteTourDateShift('tenant-a', { id: 'shift-2' } as never);
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
    expect(repositoryMocks.upsertWasteLocationTourLink).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteTour).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteTourDateShift).toHaveBeenCalled();
    expect(repositoryMocks.upsertWasteGlobalDateShift).toHaveBeenCalled();
    expect(bulkResult).toHaveLength(2);
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('BEGIN');
    expect(poolFactoryInstances.at(-1)?.query).toHaveBeenCalledWith('COMMIT');
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

  it('keeps technical history stable when jobs are unfinished or have unknown mappings', async () => {
    listJobsMock.mockResolvedValueOnce({
      items: [
        {
          id: 'job-reset',
          jobTypeId: 'waste-management.reset-data',
          status: 'failed',
          finishedAt: null,
          updatedAt: '2026-05-09T05:00:00.000Z',
          requestId: 'req-reset',
          latestEvent: { message: 'reset failed' },
          errorPayload: { code: 'reset_failed' },
        },
        {
          id: 'job-running',
          jobTypeId: 'waste-management.seed-data',
          status: 'running',
          finishedAt: null,
          updatedAt: '2026-05-09T04:00:00.000Z',
          requestId: 'req-running',
          latestEvent: { message: 'running' },
          errorPayload: undefined,
        },
        {
          id: 'job-unknown',
          jobTypeId: 'custom-job',
          status: 'failed',
          finishedAt: null,
          updatedAt: '2026-05-09T03:00:00.000Z',
          requestId: 'req-unknown',
          latestEvent: { message: 'unknown' },
          errorPayload: { code: 'custom_failed' },
        },
      ],
      total: 3,
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

    listJobsMock.mockImplementation(async (_instanceId, query: { page: number; pageSize: number }) => {
      const itemsByPage = {
        1: [
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
            id: 'job-running',
            jobTypeId: 'waste-management.seed-data',
            status: 'running',
            finishedAt: null,
            updatedAt: '2026-05-09T10:30:00.000Z',
            requestId: 'req-running',
            latestEvent: { message: 'running' },
            errorPayload: undefined,
          },
        ],
        2: [
          {
            id: 'job-2',
            jobTypeId: 'waste-management.import-data',
            status: 'failed',
            finishedAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
            requestId: 'req-2',
            latestEvent: { message: 'failed' },
            errorPayload: { code: 'import_failed' },
          },
          {
            id: 'job-unknown',
            jobTypeId: 'custom-job',
            status: 'failed',
            finishedAt: '2026-05-09T08:00:00.000Z',
            updatedAt: '2026-05-09T08:00:00.000Z',
            requestId: 'req-unknown',
            latestEvent: { message: 'unknown' },
            errorPayload: { code: 'custom_failed' },
          },
        ],
      } as const;

      return {
        items: itemsByPage[query.page as 1 | 2] ?? [],
        total: 4,
      };
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
    expect(listJobsMock).toHaveBeenNthCalledWith(
      1,
      'tenant-a',
      expect.objectContaining({ page: 1, pageSize: 2, pluginId: 'waste-management' })
    );
    expect(listJobsMock).toHaveBeenNthCalledWith(
      2,
      'tenant-a',
      expect.objectContaining({ page: 2, pageSize: 2, pluginId: 'waste-management' })
    );
  });
});
