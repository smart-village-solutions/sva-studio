import { createSdkLogger, toJsonErrorResponse, withRequestContext } from '@sva/server-runtime';
import { listWasteManagementAuditRecords } from '@sva/iam-governance';
import {
  createWasteMasterDataRepository,
  type SqlExecutionResult,
  type SqlExecutor,
  type SqlStatement,
} from '@sva/data-repositories';
import { loadWasteDataSourceRecord, saveWasteConnectionCheck, saveWasteDataSourceRecord } from '@sva/data-repositories/server';
import { Pool } from 'pg';
import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteGlobalDateShiftRecord,
  WasteLocationTourLinkBulkCreateInput,
  WasteLocationTourLinkRecord,
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteManagementToursOverview,
  WasteRegionRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
} from '@sva/core';

import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';
import { buildLogContext } from '../log-context.js';
import { protectField, revealField } from '../iam-account-management/encryption.js';
import {
  createWasteManagementFractionInternal,
  createWasteManagementRegionInternal,
  createWasteManagementCityInternal,
  createWasteManagementCollectionLocationInternal,
  createWasteManagementGlobalDateShiftInternal,
  getWasteManagementHistoryInternal,
  getWasteManagementMasterDataOverviewInternal,
  getWasteManagementSchedulingOverviewInternal,
  getWasteManagementSettingsInternal,
  getWasteManagementToursOverviewInternal,
  createWasteManagementLocationTourLinksBulkInternal,
  createWasteManagementLocationTourLinkInternal,
  createWasteManagementTourDateShiftInternal,
  createWasteManagementTourInternal,
  startWasteManagementImportInternal,
  startWasteManagementMigrationsInternal,
  startWasteManagementResetInternal,
  startWasteManagementSeedInternal,
  updateWasteManagementSettingsInternal,
  updateWasteManagementFractionInternal,
  updateWasteManagementGlobalDateShiftInternal,
  updateWasteManagementRegionInternal,
  updateWasteManagementCityInternal,
  updateWasteManagementCollectionLocationInternal,
  updateWasteManagementLocationTourLinkInternal,
  updateWasteManagementTourDateShiftInternal,
  updateWasteManagementTourInternal,
} from './core.js';
import { resolveWasteDataSource } from '@sva/server-runtime';
import { withInstanceDb } from '../db.js';

const logger = createSdkLogger({ component: 'waste-management-auth-runtime', level: 'info' });

const withWasteManagementRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

const withAuthenticatedWasteManagementHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withWasteManagementRequestContext(request, async () => {
    try {
      return await withAuthenticatedUser(request, (ctx) => handler(request, ctx));
    } catch (error) {
      const logContext = buildLogContext('default', { includeTraceId: true });
      logger.error('Waste management request failed unexpectedly', {
        operation: 'waste_management_request',
        endpoint: request.url,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        reason_code: 'instance_scope_unhandled_failure',
        ...logContext,
      });
      return toJsonErrorResponse(500, 'internal_error', 'Unbehandelter Waste-Management-Fehler.', {
        requestId: logContext.request_id,
      });
    }
  });

const sharedDeps = {
  loadWasteDataSourceRecord,
  saveWasteDataSourceRecord,
  saveWasteConnectionCheck,
  protectSecret: protectField,
  revealSecret: revealField,
} as const;

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

const loadMasterDataOverview = async (instanceId: string): Promise<WasteManagementMasterDataOverview> => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
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
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const loadWasteAuditOverview = async (query: { instanceId: string; search?: string; page: number; pageSize: number }) =>
  withInstanceDb(query.instanceId, (client) => listWasteManagementAuditRecords(client, query));

const loadWasteFractionById = async (instanceId: string, fractionId: string) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      return await repository.getWasteFractionById(fractionId);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const saveWasteFraction = async (
  instanceId: string,
  input: Parameters<ReturnType<typeof createWasteMasterDataRepository>['upsertWasteFraction']>[0]
) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      await repository.upsertWasteFraction(input);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const loadWasteRegionById = async (instanceId: string, regionId: string) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      return await repository.getWasteRegionById(regionId);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const saveWasteRegion = async (
  instanceId: string,
  input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>
) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      await repository.upsertWasteRegion(input);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const loadWasteCityById = async (instanceId: string, cityId: string) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      return await repository.getWasteCityById(cityId);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const saveWasteCity = async (
  instanceId: string,
  input: Omit<WasteCityRecord, 'createdAt' | 'updatedAt'>
) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      await repository.upsertWasteCity(input);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const loadWasteCollectionLocationById = async (instanceId: string, locationId: string) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      return await repository.getWasteCollectionLocationById(locationId);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const saveWasteCollectionLocation = async (
  instanceId: string,
  input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>
) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      await repository.upsertWasteCollectionLocation(input);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const loadWasteLocationTourLinkById = async (instanceId: string, linkId: string) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      return await repository.getWasteLocationTourLinkById(linkId);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const saveWasteLocationTourLink = async (
  instanceId: string,
  input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>
) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      await repository.upsertWasteLocationTourLink(input);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const saveWasteLocationTourLinksBulk = async (
  instanceId: string,
  input: WasteLocationTourLinkBulkCreateInput
): Promise<readonly WasteLocationTourLinkRecord[]> => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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

const loadWasteTourById = async (instanceId: string, tourId: string) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      return await repository.getWasteTourById(tourId);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const saveWasteTour = async (
  instanceId: string,
  input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>
) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      await repository.upsertWasteTour(input);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const loadToursOverview = async (instanceId: string): Promise<WasteManagementToursOverview> => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      const tours = await repository.listWasteTours();
      return { tours };
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const loadSchedulingOverview = async (instanceId: string): Promise<WasteManagementSchedulingOverview> => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      const [tourDateShifts, globalDateShifts] = await Promise.all([
        repository.listWasteTourDateShifts(),
        repository.listWasteGlobalDateShifts(),
      ]);
      return { tourDateShifts, globalDateShifts };
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const loadWasteTourDateShiftById = async (instanceId: string, shiftId: string) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      return await repository.getWasteTourDateShiftById(shiftId);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const saveWasteTourDateShift = async (
  instanceId: string,
  input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>
) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      await repository.upsertWasteTourDateShift(input);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const loadWasteGlobalDateShiftById = async (instanceId: string, shiftId: string) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      return await repository.getWasteGlobalDateShiftById(shiftId);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const saveWasteGlobalDateShift = async (
  instanceId: string,
  input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>
) => {
  const dataSource = await resolveWasteDataSource({
    instanceId,
    loadRecord: loadWasteDataSourceRecord,
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
      const repository = createWasteMasterDataRepository(createSqlExecutor(client));
      await repository.upsertWasteGlobalDateShift(input);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

export const wasteManagementHandlers = {
  getHistory: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      getWasteManagementHistoryInternal(nextRequest, ctx, {
        ...sharedDeps,
        loadWasteAuditOverview,
      })
    ),
  createFraction: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementFractionInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteFraction,
        loadWasteFractionById,
      })
    ),
  createRegion: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementRegionInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteRegion,
        loadWasteRegionById,
      })
    ),
  createCity: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementCityInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteCity,
        loadWasteCityById,
      })
    ),
  createCollectionLocation: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementCollectionLocationInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteCollectionLocation,
        loadWasteCollectionLocationById,
      })
    ),
  createLocationTourLink: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementLocationTourLinkInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteLocationTourLink,
        loadWasteLocationTourLinkById,
      })
    ),
  createLocationTourLinksBulk: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementLocationTourLinksBulkInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteLocationTourLinksBulk,
      })
    ),
  createTour: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementTourInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteTour,
        loadWasteTourById,
      })
    ),
  createTourDateShift: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementTourDateShiftInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteTourDateShift,
        loadWasteTourDateShiftById,
      })
    ),
  createGlobalDateShift: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      createWasteManagementGlobalDateShiftInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteGlobalDateShift,
        loadWasteGlobalDateShiftById,
      })
    ),
  getMasterDataOverview: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      getWasteManagementMasterDataOverviewInternal(nextRequest, ctx, {
        ...sharedDeps,
        loadMasterDataOverview,
      })
    ),
  getToursOverview: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      getWasteManagementToursOverviewInternal(nextRequest, ctx, {
        ...sharedDeps,
        loadToursOverview,
      })
    ),
  getSchedulingOverview: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      getWasteManagementSchedulingOverviewInternal(nextRequest, ctx, {
        ...sharedDeps,
        loadSchedulingOverview,
      })
    ),
  getSettings: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      getWasteManagementSettingsInternal(nextRequest, ctx, sharedDeps)
    ),
  updateSettings: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementSettingsInternal(nextRequest, ctx, sharedDeps)
    ),
  updateFraction: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementFractionInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteFraction,
        loadWasteFractionById,
      })
    ),
  updateRegion: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementRegionInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteRegion,
        loadWasteRegionById,
      })
    ),
  updateCity: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementCityInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteCity,
        loadWasteCityById,
      })
    ),
  updateCollectionLocation: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementCollectionLocationInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteCollectionLocation,
        loadWasteCollectionLocationById,
      })
    ),
  updateLocationTourLink: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementLocationTourLinkInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteLocationTourLink,
        loadWasteLocationTourLinkById,
      })
    ),
  updateTour: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementTourInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteTour,
        loadWasteTourById,
      })
    ),
  updateTourDateShift: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementTourDateShiftInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteTourDateShift,
        loadWasteTourDateShiftById,
      })
    ),
  updateGlobalDateShift: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      updateWasteManagementGlobalDateShiftInternal(nextRequest, ctx, {
        ...sharedDeps,
        saveWasteGlobalDateShift,
        loadWasteGlobalDateShiftById,
      })
    ),
  startMigrations: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      startWasteManagementMigrationsInternal(nextRequest, ctx)
    ),
  startImport: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      startWasteManagementImportInternal(nextRequest, ctx)
    ),
  startSeed: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      startWasteManagementSeedInternal(nextRequest, ctx)
    ),
  startReset: async (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
      startWasteManagementResetInternal(nextRequest, ctx)
    ),
};
