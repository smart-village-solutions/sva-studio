import {
  createWasteMasterDataRepository,
  type SqlExecutionResult,
  type SqlExecutor,
  type SqlStatement,
} from '@sva/data-repositories';
import type {
  WasteCollectionLocationRecord,
  WasteGlobalDateShiftRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkBulkCreateInput,
  WasteLocationTourLinkRecord,
  WasteManagementHistoryOverview,
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteManagementTechnicalHistoryRecord,
  WasteManagementToursOverview,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
} from '@sva/core';
import { resolveWasteDataSource } from '@sva/server-runtime';
import { listWasteManagementAuditRecords, listWasteManagementTechnicalAuditRecords } from '@sva/iam-governance';
import { Pool } from 'pg';

import { withInstanceDb } from '../db.js';
import { revealField } from '../iam-account-management/encryption.js';
import { withStudioJobRepository } from '../plugin-operations/repository.js';
import { sharedWasteManagementDeps } from './server-context.js';

const createSqlExecutor = (
  client: {
    query: <TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) => Promise<{
      readonly rowCount: number | null;
      readonly rows: readonly TRow[];
    }>;
  }
): SqlExecutor => ({
  async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount ?? 0,
      rows: result.rows,
    };
  },
});

type WasteRepository = ReturnType<typeof createWasteMasterDataRepository>;

const withWasteRepository = async <T>(instanceId: string, work: (repository: WasteRepository) => Promise<T>): Promise<T> => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: sharedWasteManagementDeps.loadWasteDataSourceRecord,
    revealSecret: (ciphertext, aad) => revealField(ciphertext, aad) ?? undefined,
  });

  const pool = new Pool({
    connectionString: dataSource.databaseUrl,
    max: 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const client = await pool.connect();
    try {
      return await work(createWasteMasterDataRepository(createSqlExecutor(client)));
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const createLoader =
  <TArgs extends readonly unknown[], TResult>(work: (repository: WasteRepository, ...args: TArgs) => Promise<TResult>) =>
  (instanceId: string, ...args: TArgs) =>
    withWasteRepository(instanceId, (repository) => work(repository, ...args));

const mapJobTypeIdToTechnicalEventType = (
  jobTypeId: string,
  status: 'succeeded' | 'failed' | 'cancelled'
): WasteManagementTechnicalHistoryRecord['eventType'] | null => {
  if (jobTypeId === 'waste-management.apply-migrations') {
    return status === 'succeeded' ? 'migration.succeeded' : 'migration.failed';
  }
  if (jobTypeId === 'waste-management.import-data') {
    return status === 'succeeded' ? 'import.succeeded' : 'import.failed';
  }
  if (jobTypeId === 'waste-management.seed-data') {
    return status === 'succeeded' ? 'seed.succeeded' : 'seed.failed';
  }
  if (jobTypeId === 'waste-management.reset-data') {
    return status === 'succeeded' ? 'reset.succeeded' : 'reset.failed';
  }
  return null;
};

const loadMasterDataOverview = (instanceId: string): Promise<WasteManagementMasterDataOverview> =>
  withWasteRepository(instanceId, async (repository) => {
    const [fractions, regions, cities, streets, houseNumbers, collectionLocations, locationTourLinks] = await Promise.all([
      repository.listWasteFractions(),
      repository.listWasteRegions(),
      repository.listWasteCities(),
      repository.listWasteStreets(),
      repository.listWasteHouseNumbers(),
      repository.listWasteCollectionLocations(),
      repository.listWasteLocationTourLinks(),
    ]);
    return { fractions, regions, cities, streets, houseNumbers, collectionLocations, locationTourLinks };
  });

const loadWasteHistoryOverview = async (query: {
  instanceId: string;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<WasteManagementHistoryOverview> => {
  const [audit, technicalAudit, technicalJobs] = await Promise.all([
    withInstanceDb(query.instanceId, (client) => listWasteManagementAuditRecords(client, query)),
    withInstanceDb(query.instanceId, (client) => listWasteManagementTechnicalAuditRecords(client, query)),
    withStudioJobRepository(query.instanceId, (repository) =>
      repository.listJobs(query.instanceId, {
        view: 'history',
        page: query.page,
        pageSize: query.pageSize,
        pluginId: 'waste-management',
        q: query.search,
      })
    ),
  ]);

  const jobItems = technicalJobs.items
    .map((job): WasteManagementTechnicalHistoryRecord | null => {
      if (job.status !== 'succeeded' && job.status !== 'failed' && job.status !== 'cancelled') {
        return null;
      }

      const eventType = mapJobTypeIdToTechnicalEventType(job.jobTypeId, job.status);
      if (!eventType) {
        return null;
      }

      return {
        id: `job:${job.id}:${job.status}`,
        eventType,
        outcome: job.status === 'succeeded' ? 'success' : 'failure',
        occurredAt: job.finishedAt ?? job.updatedAt,
        source: 'job',
        jobId: job.id,
        jobTypeId: job.jobTypeId,
        requestId: job.requestId,
        message: job.latestEvent?.message,
        errorCode: job.errorPayload?.code,
      };
    })
    .filter((item): item is WasteManagementTechnicalHistoryRecord => item !== null);

  return {
    audit,
    technical: {
      items: [...technicalAudit.items, ...jobItems].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
      total: technicalAudit.total + technicalJobs.total,
    },
  };
};

const loadToursOverview = (instanceId: string): Promise<WasteManagementToursOverview> =>
  withWasteRepository(instanceId, async (repository) => ({ tours: await repository.listWasteTours() }));

const loadSchedulingOverview = (instanceId: string): Promise<WasteManagementSchedulingOverview> =>
  withWasteRepository(instanceId, async (repository) => {
    const [tourDateShifts, globalDateShifts] = await Promise.all([
      repository.listWasteTourDateShifts(),
      repository.listWasteGlobalDateShifts(),
    ]);
    return { tourDateShifts, globalDateShifts };
  });

const loadWasteFractionById = createLoader((repository, fractionId: string) => repository.getWasteFractionById(fractionId));
const saveWasteFraction = createLoader(
  (repository, input: Parameters<WasteRepository['upsertWasteFraction']>[0]) => repository.upsertWasteFraction(input)
);
const loadWasteRegionById = createLoader((repository, regionId: string) => repository.getWasteRegionById(regionId));
const saveWasteRegion = createLoader((repository, input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>) =>
  repository.upsertWasteRegion(input)
);
const loadWasteCityById = createLoader((repository, cityId: string) => repository.getWasteCityById(cityId));
const saveWasteCity = createLoader((repository, input: Parameters<WasteRepository['upsertWasteCity']>[0]) =>
  repository.upsertWasteCity(input)
);
const loadWasteStreetById = createLoader((repository, streetId: string) => repository.getWasteStreetById(streetId));
const saveWasteStreet = createLoader((repository, input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>) =>
  repository.upsertWasteStreet(input)
);
const loadWasteHouseNumberById = createLoader((repository, houseNumberId: string) =>
  repository.getWasteHouseNumberById(houseNumberId)
);
const saveWasteHouseNumber = createLoader(
  (repository, input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>) => repository.upsertWasteHouseNumber(input)
);
const loadWasteCollectionLocationById = createLoader((repository, locationId: string) =>
  repository.getWasteCollectionLocationById(locationId)
);
const saveWasteCollectionLocation = createLoader(
  (repository, input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>) =>
    repository.upsertWasteCollectionLocation(input)
);
const loadWasteLocationTourLinkById = createLoader((repository, linkId: string) => repository.getWasteLocationTourLinkById(linkId));
const saveWasteLocationTourLink = createLoader(
  (repository, input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>) =>
    repository.upsertWasteLocationTourLink(input)
);
const loadWasteTourById = createLoader((repository, tourId: string) => repository.getWasteTourById(tourId));
const saveWasteTour = createLoader((repository, input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>) =>
  repository.upsertWasteTour(input)
);
const loadWasteTourDateShiftById = createLoader((repository, shiftId: string) => repository.getWasteTourDateShiftById(shiftId));
const saveWasteTourDateShift = createLoader(
  (repository, input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>) => repository.upsertWasteTourDateShift(input)
);
const loadWasteGlobalDateShiftById = createLoader((repository, shiftId: string) => repository.getWasteGlobalDateShiftById(shiftId));
const saveWasteGlobalDateShift = createLoader(
  (repository, input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>) => repository.upsertWasteGlobalDateShift(input)
);

const saveWasteLocationTourLinksBulk = async (
  instanceId: string,
  input: WasteLocationTourLinkBulkCreateInput
): Promise<readonly WasteLocationTourLinkRecord[]> => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: sharedWasteManagementDeps.loadWasteDataSourceRecord,
    revealSecret: (ciphertext, aad) => revealField(ciphertext, aad) ?? undefined,
  });

  const pool = new Pool({
    connectionString: dataSource.databaseUrl,
    max: 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      const createdItems: WasteLocationTourLinkRecord[] = [];
      for (const locationId of input.locationIds) {
        const id = crypto.randomUUID();
        await repository.upsertWasteLocationTourLink({
          id,
          locationId,
          tourId: input.tourId,
          startDate: input.startDate,
          endDate: input.endDate,
        });

        const saved = await repository.getWasteLocationTourLinkById(id);
        if (!saved) {
          throw new Error(`bulk_location_tour_link_verification_failed:${id}`);
        }
        createdItems.push(saved);
      }
      await client.query('COMMIT');
      return createdItems;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

export const wasteManagementOverviewLoaders = {
  loadMasterDataOverview,
  loadWasteHistoryOverview,
  loadToursOverview,
  loadSchedulingOverview,
} as const;

export const wasteManagementEntityLoaders = {
  loadWasteFractionById,
  loadWasteRegionById,
  loadWasteCityById,
  loadWasteStreetById,
  loadWasteHouseNumberById,
  loadWasteCollectionLocationById,
  loadWasteLocationTourLinkById,
  loadWasteTourById,
  loadWasteTourDateShiftById,
  loadWasteGlobalDateShiftById,
} as const;

export const wasteManagementEntitySavers = {
  saveWasteFraction,
  saveWasteRegion,
  saveWasteCity,
  saveWasteStreet,
  saveWasteHouseNumber,
  saveWasteCollectionLocation,
  saveWasteLocationTourLink,
  saveWasteLocationTourLinksBulk,
  saveWasteTour,
  saveWasteTourDateShift,
  saveWasteGlobalDateShift,
} as const;
