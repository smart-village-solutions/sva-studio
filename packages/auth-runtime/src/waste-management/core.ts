import { Pool } from 'pg';
import {
  evaluateAuthorizeDecision,
  getWasteManagementImportCatalogEntry,
  wasteManagementOperationsContract,
  wasteManagementMasterDataContract,
  type StudioJobStartRequest,
  type WasteManagementAuditOverview,
  type WasteManagementAuditQuery,
  type WasteManagementHistoryOverview,
  type WasteManagementConnectionCheckRecord,
  type WasteManagementDataSourceRecord,
  type WasteCityRecord,
  type WasteCollectionLocationRecord,
  type WasteFractionRecord,
  type WasteHouseNumberRecord,
  type WasteRegionRecord,
  type WasteManagementMasterDataOverview,
  type WasteManagementSchedulingOverview,
  type WasteManagementToursOverview,
  type EffectivePermission,
  type WasteGlobalDateShiftRecord,
  type WasteLocationTourLinkBulkCreateInput,
  type WasteLocationTourLinkBulkCreateResult,
  type WasteLocationTourLinkRecord,
  type WasteManagementSettingsRecord,
  type WasteCustomTourDate,
  type WasteStreetRecord,
  type WasteTourDateShiftRecord,
  type WasteTourRecord,
  type WasteTourRecurrence,
} from '@sva/core';
import { getWorkspaceContext, buildWasteDatabaseUrlAad, buildWasteServiceRoleKeyAad, resolveWasteDataSource, runWasteConnectionCheck, type ResolvedWasteDataSource } from '@sva/server-runtime';
import { z } from 'zod';

import { emitAuthAuditEvent } from '../audit-events.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { validateCsrf } from '../shared/request-security.js';
import {
  asApiItem,
  createApiError,
  parseRequestBody,
  readPage,
  readPathSegment,
  requireIdempotencyKey,
} from '../shared/request-helpers.js';
import { completeIdempotency, reserveIdempotency } from '../iam-account-management/shared.js';
import { toPayloadHash } from '../shared/request-helpers.js';
import { createPluginOperationJob, createJsonItemResponse, markPluginOperationEnqueueFailed } from '../plugin-operations/core.shared.js';
import { queuePluginOperationJob } from '../plugin-operations/runner.js';
import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';

const wasteManagementSettingsSchema = z.object({
  provider: z.literal('supabase'),
  projectUrl: z.string().trim().url(),
  schemaName: z.string().trim().min(1).optional(),
  enabled: z.boolean(),
  databaseUrl: z.string().trim().min(1).optional(),
  serviceRoleKey: z.string().trim().min(1).optional(),
});

const createWasteFractionSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  translations: z.record(z.string().trim().min(1), z.string().trim().min(1)).optional(),
  containerSize: z.string().trim().min(1).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültiger Hex-Farbwert.'),
  description: z.string().trim().min(1).optional(),
  active: z.boolean(),
});

const updateWasteFractionSchema = createWasteFractionSchema.omit({ id: true });

const createWasteRegionSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

const updateWasteRegionSchema = createWasteRegionSchema.omit({ id: true });

const createWasteCitySchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  regionId: z.string().trim().min(1).optional(),
});

const updateWasteCitySchema = createWasteCitySchema.omit({ id: true });

const createWasteStreetSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  cityId: z.string().trim().min(1),
});

const updateWasteStreetSchema = createWasteStreetSchema.omit({ id: true });

const createWasteHouseNumberSchema = z.object({
  id: z.string().trim().min(1),
  number: z.string().trim().min(1),
  streetId: z.string().trim().min(1),
});

const updateWasteHouseNumberSchema = createWasteHouseNumberSchema.omit({ id: true });

const createWasteCollectionLocationSchema = z.object({
  id: z.string().trim().min(1),
  cityId: z.string().trim().min(1),
  regionId: z.string().trim().min(1).optional(),
  streetId: z.string().trim().min(1).optional(),
  houseNumberId: z.string().trim().min(1).optional(),
  active: z.boolean(),
});

const updateWasteCollectionLocationSchema = createWasteCollectionLocationSchema.omit({ id: true });

const wasteTourRecurrenceSchema = z.enum([
  'weekly',
  'biweekly',
  'fourweekly',
  'yearly',
  'on-demand',
  'custom',
] satisfies readonly WasteTourRecurrence[]);

const wasteTourDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum im Format JJJJ-MM-TT.');

const createWasteLocationTourLinkSchema = z.object({
  id: z.string().trim().min(1),
  locationId: z.string().trim().min(1),
  tourId: z.string().trim().min(1),
  startDate: wasteTourDateSchema.optional(),
  endDate: wasteTourDateSchema.optional(),
});

const updateWasteLocationTourLinkSchema = createWasteLocationTourLinkSchema.omit({ id: true });
const createWasteLocationTourLinksBulkSchema = z.object({
  locationIds: z.array(z.string().trim().min(1)).min(1).max(100),
  tourId: z.string().trim().min(1),
  startDate: wasteTourDateSchema.optional(),
  endDate: wasteTourDateSchema.optional(),
});

const wasteCustomTourDateSchema = z.object({
  date: wasteTourDateSchema,
  description: z.string().trim().min(1).optional(),
});

const createWasteTourSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  wasteFractionIds: z.array(z.string().trim().min(1)).min(1),
  recurrence: wasteTourRecurrenceSchema.nullish(),
  firstDate: wasteTourDateSchema.optional(),
  endDate: wasteTourDateSchema.optional(),
  customDates: z.array(wasteCustomTourDateSchema).optional(),
  active: z.boolean(),
});

const updateWasteTourSchema = createWasteTourSchema.omit({ id: true });

const createWasteTourDateShiftSchema = z.object({
  id: z.string().trim().min(1),
  tourId: z.string().trim().min(1),
  originalDate: wasteTourDateSchema,
  actualDate: wasteTourDateSchema,
  hasYear: z.boolean(),
  reasonType: z.enum(wasteManagementMasterDataContract.dateShiftReasonTypes).optional(),
  reasonKey: z.string().trim().min(1).optional(),
  followUpMode: z.enum(wasteManagementMasterDataContract.followUpModes).optional(),
  description: z.string().trim().min(1).optional(),
});

const updateWasteTourDateShiftSchema = createWasteTourDateShiftSchema.omit({ id: true });

const createWasteGlobalDateShiftSchema = z.object({
  id: z.string().trim().min(1),
  originalDate: wasteTourDateSchema,
  actualDate: wasteTourDateSchema,
  hasYear: z.boolean(),
  reasonType: z.enum(wasteManagementMasterDataContract.dateShiftReasonTypes).optional(),
  reasonKey: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  tourIds: z.array(z.string().trim().min(1)).optional(),
});

const updateWasteGlobalDateShiftSchema = createWasteGlobalDateShiftSchema.omit({ id: true });

const startMigrationsSchema = z.object({
  targetSchema: z.string().trim().min(1).optional(),
  requestedByVersion: z.string().trim().min(1).optional(),
});

const startImportSchema = z.object({
  importProfileId: z.string().trim().min(1),
  sourceFormat: z.string().trim().min(1),
  blobRef: z.string().trim().min(1),
  dryRun: z.boolean().optional(),
});

const startSeedSchema = z.object({
  seedKey: z.literal('baseline').default('baseline'),
});

const startResetSchema = z.object({
  confirmationToken: z.string().trim().min(1),
});

type WasteManagementHandlerDeps = {
  readonly getRequestId?: () => string | undefined;
  readonly loadWasteDataSourceRecord?: (instanceId: string) => Promise<WasteManagementDataSourceRecord | null>;
  readonly saveWasteDataSourceRecord?: (record: WasteManagementDataSourceRecord) => Promise<void>;
  readonly saveWasteConnectionCheck?: (record: WasteManagementConnectionCheckRecord) => Promise<void>;
  readonly protectSecret?: (value: string, aad: string) => string | null | undefined;
  readonly revealSecret?: (ciphertext: string | null | undefined, aad: string) => string | null | undefined;
  readonly runConnectionProbe?: (dataSource: ResolvedWasteDataSource) => Promise<void>;
  readonly resolvePermissions?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
  }) => Promise<
    | {
        readonly ok: true;
        readonly permissions: readonly EffectivePermission[];
      }
    | {
        readonly ok: false;
        readonly error: string;
      }
  >;
  readonly startPluginOperationJob?: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly requestId?: string;
    readonly scheduledAt: string;
    readonly data: StudioJobStartRequest;
  }) => Promise<Response>;
  readonly emitAuditEvent?: typeof emitAuthAuditEvent;
  readonly loadWasteAuditOverview?: (query: WasteManagementAuditQuery) => Promise<WasteManagementAuditOverview>;
  readonly loadWasteHistoryOverview?: (query: WasteManagementAuditQuery) => Promise<WasteManagementHistoryOverview>;
  readonly loadMasterDataOverview?: (instanceId: string) => Promise<WasteManagementMasterDataOverview>;
  readonly loadToursOverview?: (instanceId: string) => Promise<WasteManagementToursOverview>;
  readonly loadSchedulingOverview?: (instanceId: string) => Promise<WasteManagementSchedulingOverview>;
  readonly saveWasteFraction?: (instanceId: string, input: Omit<WasteFractionRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  readonly loadWasteFractionById?: (instanceId: string, fractionId: string) => Promise<WasteFractionRecord | null>;
  readonly saveWasteRegion?: (instanceId: string, input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  readonly loadWasteRegionById?: (instanceId: string, regionId: string) => Promise<WasteRegionRecord | null>;
  readonly saveWasteCity?: (instanceId: string, input: Omit<WasteCityRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  readonly loadWasteCityById?: (instanceId: string, cityId: string) => Promise<WasteCityRecord | null>;
  readonly saveWasteStreet?: (instanceId: string, input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  readonly loadWasteStreetById?: (instanceId: string, streetId: string) => Promise<WasteStreetRecord | null>;
  readonly saveWasteHouseNumber?: (
    instanceId: string,
    input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteHouseNumberById?: (
    instanceId: string,
    houseNumberId: string
  ) => Promise<WasteHouseNumberRecord | null>;
  readonly saveWasteCollectionLocation?: (
    instanceId: string,
    input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteCollectionLocationById?: (
    instanceId: string,
    locationId: string
  ) => Promise<WasteCollectionLocationRecord | null>;
  readonly saveWasteLocationTourLink?: (
    instanceId: string,
    input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly saveWasteLocationTourLinksBulk?: (
    instanceId: string,
    input: WasteLocationTourLinkBulkCreateInput
  ) => Promise<readonly WasteLocationTourLinkRecord[]>;
  readonly loadWasteLocationTourLinkById?: (
    instanceId: string,
    linkId: string
  ) => Promise<WasteLocationTourLinkRecord | null>;
  readonly saveWasteTour?: (instanceId: string, input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  readonly loadWasteTourById?: (instanceId: string, tourId: string) => Promise<WasteTourRecord | null>;
  readonly saveWasteTourDateShift?: (
    instanceId: string,
    input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteTourDateShiftById?: (
    instanceId: string,
    shiftId: string
  ) => Promise<WasteTourDateShiftRecord | null>;
  readonly saveWasteGlobalDateShift?: (
    instanceId: string,
    input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteGlobalDateShiftById?: (
    instanceId: string,
    shiftId: string
  ) => Promise<WasteGlobalDateShiftRecord | null>;
};

const getRequestId = (deps: WasteManagementHandlerDeps): string | undefined => deps.getRequestId?.();

const requireActorInstanceId = (
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined
): string | Response =>
  ctx.user.instanceId?.trim()
    ? ctx.user.instanceId
    : createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', requestId);

const sanitizeWasteSettings = (
  record: WasteManagementDataSourceRecord | null | undefined
): WasteManagementSettingsRecord | null => {
  if (!record) {
    return null;
  }

  return {
    instanceId: record.instanceId,
    provider: record.provider,
    projectUrl: record.projectUrl,
    schemaName: record.schemaName,
    enabled: record.enabled,
    databaseUrlConfigured: record.databaseUrlConfigured,
    serviceRoleKeyConfigured: record.serviceRoleKeyConfigured,
    visibleStatus: record.visibleStatus,
    lastCheckedAt: record.lastCheckedAt,
    lastCheckStatus: record.lastCheckStatus,
    lastCheckErrorCode: record.lastCheckErrorCode,
    lastCheckErrorMessage: record.lastCheckErrorMessage,
    updatedAt: record.updatedAt,
  };
};

const defaultRunConnectionProbe = async (dataSource: ResolvedWasteDataSource): Promise<void> => {
  const pool = new Pool({
    connectionString: dataSource.databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1;');
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

const buildSettingsRecord = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string,
  payload: z.infer<typeof wasteManagementSettingsSchema>
): Promise<WasteManagementDataSourceRecord> => {
  const existing = (await deps.loadWasteDataSourceRecord?.(instanceId)) ?? null;
  const nextDatabaseUrlCiphertext = payload.databaseUrl?.trim()
    ? deps.protectSecret?.(payload.databaseUrl.trim(), buildWasteDatabaseUrlAad(instanceId))
    : existing?.databaseUrlCiphertext;
  const nextServiceRoleKeyCiphertext = payload.serviceRoleKey?.trim()
    ? deps.protectSecret?.(payload.serviceRoleKey.trim(), buildWasteServiceRoleKeyAad(instanceId))
    : existing?.serviceRoleKeyCiphertext;

  return {
    instanceId,
    provider: payload.provider,
    projectUrl: payload.projectUrl.trim(),
    schemaName: payload.schemaName?.trim() || 'public',
    enabled: payload.enabled,
    databaseUrlConfigured: Boolean(nextDatabaseUrlCiphertext),
    serviceRoleKeyConfigured: Boolean(nextServiceRoleKeyCiphertext),
    databaseUrlCiphertext: nextDatabaseUrlCiphertext ?? undefined,
    serviceRoleKeyCiphertext: nextServiceRoleKeyCiphertext ?? undefined,
    visibleStatus:
      nextDatabaseUrlCiphertext && nextServiceRoleKeyCiphertext
        ? 'unknown'
        : 'not_configured',
    lastCheckedAt: existing?.lastCheckedAt,
    lastCheckStatus: existing?.lastCheckStatus,
    lastCheckErrorCode: existing?.lastCheckErrorCode,
    lastCheckErrorMessage: existing?.lastCheckErrorMessage,
    updatedAt: existing?.updatedAt,
  };
};

const persistWasteConnectionState = async (
  deps: WasteManagementHandlerDeps,
  record: WasteManagementConnectionCheckRecord
): Promise<void> => {
  if (!deps.saveWasteConnectionCheck) {
    return;
  }

  await deps.saveWasteConnectionCheck(record);
};

const updateWasteVisibleStatus = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string,
  outcome: 'success' | 'revalidate'
): Promise<void> => {
  if (!deps.saveWasteConnectionCheck) {
    return;
  }

  if (outcome === 'success') {
    await persistWasteConnectionState(deps, {
      instanceId,
      checkedAt: new Date().toISOString(),
      checkStatus: 'succeeded',
      visibleStatus: 'ok',
    });
    return;
  }

  if (!deps.loadWasteDataSourceRecord || !deps.revealSecret) {
    return;
  }

  try {
    const dataSource = await resolveWasteDataSource({
      instanceId,
      loadRecord: deps.loadWasteDataSourceRecord,
      revealSecret: (ciphertext, aad) => deps.revealSecret?.(ciphertext, aad) ?? undefined,
    });
    const connectionCheck = await runWasteConnectionCheck({
      dataSource,
      probe: deps.runConnectionProbe ?? defaultRunConnectionProbe,
      now: () => new Date(),
    });
    await persistWasteConnectionState(deps, connectionCheck);
  } catch (error) {
    const errorCode = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'connection_failed';
    const errorMessage = error instanceof Error ? error.message : 'Connection-Check fehlgeschlagen.';
    await persistWasteConnectionState(deps, {
      instanceId,
      checkedAt: new Date().toISOString(),
      checkStatus: 'failed',
      visibleStatus: 'error',
      errorCode,
      errorMessage,
    });
  }
};

const startPluginOperationJobFromFacade = async (input: {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly endpoint: string;
  readonly idempotencyKey: string;
  readonly requestId?: string;
  readonly scheduledAt: string;
  readonly data: StudioJobStartRequest;
}): Promise<Response> => {
  const reserved = await reserveIdempotency({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    endpoint: input.endpoint,
    idempotencyKey: input.idempotencyKey,
    payloadHash: toPayloadHash(JSON.stringify(input.data)),
  });

  if (reserved.status === 'replay') {
    return new Response(JSON.stringify(reserved.responseBody), {
      status: reserved.responseStatus,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (reserved.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserved.message, input.requestId);
  }

  const complete = async (response: Response): Promise<Response> => {
    const responseBody = await response.clone().json();
    await completeIdempotency({
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      endpoint: input.endpoint,
      idempotencyKey: input.idempotencyKey,
      status: response.status >= 400 ? 'FAILED' : 'COMPLETED',
      responseStatus: response.status,
      responseBody,
    });
    return response;
  };

  try {
    const job = await createPluginOperationJob({
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
      scheduledAt: input.scheduledAt,
      data: input.data,
    });

    try {
      await queuePluginOperationJob({
        instanceId: input.instanceId,
        jobId: job.id,
        queueName: job.queueName,
        maxAttempts: job.maxAttempts,
      });
    } catch {
      await markPluginOperationEnqueueFailed({ instanceId: input.instanceId, job });
      return complete(
        createApiError(
          503,
          'database_unavailable',
          'Der Waste-Job konnte nicht in die Host-Queue gestellt werden.',
          input.requestId
        )
      );
    }

    return complete(createJsonItemResponse(202, job, input.requestId));
  } catch {
    return complete(
      createApiError(503, 'database_unavailable', 'Der Waste-Job konnte nicht angelegt werden.', input.requestId)
    );
  }
};

const requireDeps = <T>(value: T | undefined, name: string): T => {
  if (value === undefined) {
    throw new Error(`missing_dependency:${name}`);
  }
  return value;
};

const normalizeOptionalString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const normalizeCustomTourDates = (
  value: readonly z.infer<typeof wasteCustomTourDateSchema>[] | undefined
): readonly WasteCustomTourDate[] | undefined => {
  if (!value?.length) {
    return undefined;
  }

  return value.map((item) => ({
    date: item.date,
    description: normalizeOptionalString(item.description),
  }));
};

const emitWasteAuditEvent = async (input: {
  readonly deps: WasteManagementHandlerDeps;
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly actionId: string;
  readonly result: 'success' | 'failure' | 'denied';
  readonly reasonCode?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
}) => {
  const context = getWorkspaceContext();
  await (input.deps.emitAuditEvent ?? emitAuthAuditEvent)({
    eventType:
      input.result === 'success'
        ? 'plugin_action_authorized'
        : input.result === 'denied'
          ? 'plugin_action_denied'
          : 'plugin_action_failed',
    actorUserId: input.ctx.user.id,
    actorEmail: input.ctx.user.email,
    actorDisplayName: input.ctx.user.displayName,
    scope: { kind: 'instance', instanceId: input.instanceId },
    workspaceId: input.instanceId,
    outcome: input.result,
    requestId: context.requestId,
    traceId: context.traceId,
    pluginAction: {
      actionId: input.actionId,
      actionNamespace: 'waste-management',
      actionOwner: 'waste-management',
      result: input.result,
      reasonCode: input.reasonCode,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    },
  });
};

const authorizeWasteManagementAction = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  deps: WasteManagementHandlerDeps,
  requestId: string | undefined
): Promise<Response | null> => {
  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  let permissions: readonly EffectivePermission[];
  try {
    const resolved = await (deps.resolvePermissions ?? resolveEffectivePermissions)({
      instanceId,
      keycloakSubject: ctx.user.id,
    });
    if (!resolved.ok) {
      return createApiError(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.', requestId);
    }
    permissions = resolved.permissions;
  } catch {
    return createApiError(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.', requestId);
  }

  const decision = evaluateAuthorizeDecision(
    {
      instanceId,
      action,
      resource: {
        type: 'waste-management',
      },
      context: requestId ? { requestId } : undefined,
    },
    permissions
  );

  if (!decision.allowed) {
    return createApiError(403, 'forbidden', 'Keine Berechtigung für diese Waste-Management-Operation.', requestId, {
      action,
      reason_code: decision.reason,
    });
  }

  return null;
};

export const getWasteManagementSettingsInternal = async (
  _request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.settings.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  try {
    const record = await requireDeps(deps.loadWasteDataSourceRecord, 'loadWasteDataSourceRecord')(instanceId);
    return new Response(JSON.stringify(asApiItem(sanitizeWasteSettings(record), requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht geladen werden.', requestId);
  }
};

export const getWasteManagementHistoryInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.read', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const { page, pageSize } = readPage(request);
  const search = new URL(request.url).searchParams.get('q')?.trim() || undefined;

  try {
    const overview = await requireDeps(deps.loadWasteHistoryOverview, 'loadWasteHistoryOverview')({
      instanceId,
      search,
      page,
      pageSize,
    });
    return new Response(JSON.stringify(asApiItem(overview, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return createApiError(503, 'database_unavailable', 'Die Waste-Historie konnte nicht geladen werden.', requestId);
  }
};

export const getWasteManagementMasterDataOverviewInternal = async (
  _request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.read', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  try {
    const overview = await requireDeps(deps.loadMasterDataOverview, 'loadMasterDataOverview')(instanceId);
    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(overview, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(
      503,
      'database_unavailable',
      'Die Waste-Stammdaten konnten nicht geladen werden.',
      requestId
    );
  }
};

export const createWasteManagementFractionInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, createWasteFractionSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    await requireDeps(deps.saveWasteFraction, 'saveWasteFraction')(instanceId, {
      id: parsed.data.id,
      name: parsed.data.name.trim(),
      translations: parsed.data.translations,
      containerSize: normalizeOptionalString(parsed.data.containerSize),
      color: parsed.data.color,
      description: normalizeOptionalString(parsed.data.description),
      active: parsed.data.active,
    });

    const saved = await requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById')(instanceId, parsed.data.id);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.fraction.created',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_fraction',
        resourceId: parsed.data.id,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Fraktion konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.fraction.created',
      result: 'success',
      resourceType: 'waste_fraction',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.fraction.created',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_fraction',
      resourceId: parsed.data.id,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Fraktion konnte nicht gespeichert werden.', requestId);
  }
};

export const updateWasteManagementFractionInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const fractionId = readPathSegment(request, 4)?.trim();
  if (!fractionId) {
    return createApiError(400, 'invalid_request', 'fractionId fehlt im Pfad.', requestId);
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateWasteFractionSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const existing = await requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById')(instanceId, fractionId);
    if (!existing) {
      return createApiError(404, 'not_found', 'Die Waste-Fraktion wurde nicht gefunden.', requestId);
    }

    await requireDeps(deps.saveWasteFraction, 'saveWasteFraction')(instanceId, {
      id: fractionId,
      name: parsed.data.name.trim(),
      translations: parsed.data.translations,
      containerSize: normalizeOptionalString(parsed.data.containerSize),
      color: parsed.data.color,
      description: normalizeOptionalString(parsed.data.description),
      active: parsed.data.active,
    });

    const saved = await requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById')(instanceId, fractionId);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.fraction.updated',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_fraction',
        resourceId: fractionId,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Fraktion konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.fraction.updated',
      result: 'success',
      resourceType: 'waste_fraction',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.fraction.updated',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_fraction',
      resourceId: fractionId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Fraktion konnte nicht gespeichert werden.', requestId);
  }
};

export const createWasteManagementRegionInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, createWasteRegionSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    await requireDeps(deps.saveWasteRegion, 'saveWasteRegion')(instanceId, {
      id: parsed.data.id,
      name: parsed.data.name.trim(),
    });

    const saved = await requireDeps(deps.loadWasteRegionById, 'loadWasteRegionById')(instanceId, parsed.data.id);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.region.created',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_region',
        resourceId: parsed.data.id,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Region konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.region.created',
      result: 'success',
      resourceType: 'waste_region',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.region.created',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_region',
      resourceId: parsed.data.id,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Region konnte nicht gespeichert werden.', requestId);
  }
};

export const updateWasteManagementRegionInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const regionId = readPathSegment(request, 4)?.trim();
  if (!regionId) {
    return createApiError(400, 'invalid_request', 'regionId fehlt im Pfad.', requestId);
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateWasteRegionSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const existing = await requireDeps(deps.loadWasteRegionById, 'loadWasteRegionById')(instanceId, regionId);
    if (!existing) {
      return createApiError(404, 'not_found', 'Die Waste-Region wurde nicht gefunden.', requestId);
    }

    await requireDeps(deps.saveWasteRegion, 'saveWasteRegion')(instanceId, {
      id: regionId,
      name: parsed.data.name.trim(),
    });

    const saved = await requireDeps(deps.loadWasteRegionById, 'loadWasteRegionById')(instanceId, regionId);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.region.updated',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_region',
        resourceId: regionId,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Region konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.region.updated',
      result: 'success',
      resourceType: 'waste_region',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.region.updated',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_region',
      resourceId: regionId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Region konnte nicht gespeichert werden.', requestId);
  }
};

export const createWasteManagementCityInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, createWasteCitySchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    await requireDeps(deps.saveWasteCity, 'saveWasteCity')(instanceId, {
      id: parsed.data.id,
      name: parsed.data.name.trim(),
      regionId: normalizeOptionalString(parsed.data.regionId),
    });

    const saved = await requireDeps(deps.loadWasteCityById, 'loadWasteCityById')(instanceId, parsed.data.id);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.city.created',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_city',
        resourceId: parsed.data.id,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Stadt konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.city.created',
      result: 'success',
      resourceType: 'waste_city',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.city.created',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_city',
      resourceId: parsed.data.id,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Stadt konnte nicht gespeichert werden.', requestId);
  }
};

export const updateWasteManagementCityInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const cityId = readPathSegment(request, 4)?.trim();
  if (!cityId) {
    return createApiError(400, 'invalid_request', 'cityId fehlt im Pfad.', requestId);
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateWasteCitySchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const existing = await requireDeps(deps.loadWasteCityById, 'loadWasteCityById')(instanceId, cityId);
    if (!existing) {
      return createApiError(404, 'not_found', 'Die Waste-Stadt wurde nicht gefunden.', requestId);
    }

    await requireDeps(deps.saveWasteCity, 'saveWasteCity')(instanceId, {
      id: cityId,
      name: parsed.data.name.trim(),
      regionId: normalizeOptionalString(parsed.data.regionId),
    });

    const saved = await requireDeps(deps.loadWasteCityById, 'loadWasteCityById')(instanceId, cityId);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.city.updated',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_city',
        resourceId: cityId,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Stadt konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.city.updated',
      result: 'success',
      resourceType: 'waste_city',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.city.updated',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_city',
      resourceId: cityId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Stadt konnte nicht gespeichert werden.', requestId);
  }
};

export const createWasteManagementStreetInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, createWasteStreetSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    await requireDeps(deps.saveWasteStreet, 'saveWasteStreet')(instanceId, {
      id: parsed.data.id,
      name: parsed.data.name.trim(),
      cityId: parsed.data.cityId,
    });

    const saved = await requireDeps(deps.loadWasteStreetById, 'loadWasteStreetById')(instanceId, parsed.data.id);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.street.created',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_street',
        resourceId: parsed.data.id,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Straße konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.street.created',
      result: 'success',
      resourceType: 'waste_street',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.street.created',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_street',
      resourceId: parsed.data.id,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Straße konnte nicht gespeichert werden.', requestId);
  }
};

export const updateWasteManagementStreetInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const streetId = readPathSegment(request, 4)?.trim();
  if (!streetId) {
    return createApiError(400, 'invalid_request', 'streetId fehlt im Pfad.', requestId);
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateWasteStreetSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const existing = await requireDeps(deps.loadWasteStreetById, 'loadWasteStreetById')(instanceId, streetId);
    if (!existing) {
      return createApiError(404, 'not_found', 'Die Waste-Straße wurde nicht gefunden.', requestId);
    }

    await requireDeps(deps.saveWasteStreet, 'saveWasteStreet')(instanceId, {
      id: streetId,
      name: parsed.data.name.trim(),
      cityId: parsed.data.cityId,
    });

    const saved = await requireDeps(deps.loadWasteStreetById, 'loadWasteStreetById')(instanceId, streetId);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.street.updated',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_street',
        resourceId: streetId,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Straße konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.street.updated',
      result: 'success',
      resourceType: 'waste_street',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.street.updated',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_street',
      resourceId: streetId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Straße konnte nicht gespeichert werden.', requestId);
  }
};

export const createWasteManagementHouseNumberInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, createWasteHouseNumberSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    await requireDeps(deps.saveWasteHouseNumber, 'saveWasteHouseNumber')(instanceId, {
      id: parsed.data.id,
      number: parsed.data.number.trim(),
      streetId: parsed.data.streetId,
    });

    const saved = await requireDeps(
      deps.loadWasteHouseNumberById,
      'loadWasteHouseNumberById'
    )(instanceId, parsed.data.id);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.house-number.created',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_house_number',
        resourceId: parsed.data.id,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Hausnummer konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.house-number.created',
      result: 'success',
      resourceType: 'waste_house_number',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.house-number.created',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_house_number',
      resourceId: parsed.data.id,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Hausnummer konnte nicht gespeichert werden.', requestId);
  }
};

export const updateWasteManagementHouseNumberInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const houseNumberId = readPathSegment(request, 4)?.trim();
  if (!houseNumberId) {
    return createApiError(400, 'invalid_request', 'houseNumberId fehlt im Pfad.', requestId);
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateWasteHouseNumberSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const existing = await requireDeps(
      deps.loadWasteHouseNumberById,
      'loadWasteHouseNumberById'
    )(instanceId, houseNumberId);
    if (!existing) {
      return createApiError(404, 'not_found', 'Die Waste-Hausnummer wurde nicht gefunden.', requestId);
    }

    await requireDeps(deps.saveWasteHouseNumber, 'saveWasteHouseNumber')(instanceId, {
      id: houseNumberId,
      number: parsed.data.number.trim(),
      streetId: parsed.data.streetId,
    });

    const saved = await requireDeps(
      deps.loadWasteHouseNumberById,
      'loadWasteHouseNumberById'
    )(instanceId, houseNumberId);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.house-number.updated',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_house_number',
        resourceId: houseNumberId,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Hausnummer konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.house-number.updated',
      result: 'success',
      resourceType: 'waste_house_number',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.house-number.updated',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_house_number',
      resourceId: houseNumberId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Hausnummer konnte nicht gespeichert werden.', requestId);
  }
};

export const createWasteManagementCollectionLocationInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, createWasteCollectionLocationSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    await requireDeps(deps.saveWasteCollectionLocation, 'saveWasteCollectionLocation')(instanceId, {
      id: parsed.data.id,
      cityId: parsed.data.cityId,
      regionId: normalizeOptionalString(parsed.data.regionId),
      streetId: normalizeOptionalString(parsed.data.streetId),
      houseNumberId: normalizeOptionalString(parsed.data.houseNumberId),
      active: parsed.data.active,
    });

    const saved = await requireDeps(
      deps.loadWasteCollectionLocationById,
      'loadWasteCollectionLocationById'
    )(instanceId, parsed.data.id);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.collection-location.created',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_collection_location',
        resourceId: parsed.data.id,
      });
      return createApiError(
        503,
        'database_unavailable',
        'Der Waste-Abholort konnte nicht verifiziert werden.',
        requestId
      );
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.collection-location.created',
      result: 'success',
      resourceType: 'waste_collection_location',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.collection-location.created',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_collection_location',
      resourceId: parsed.data.id,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Der Waste-Abholort konnte nicht gespeichert werden.', requestId);
  }
};

export const updateWasteManagementCollectionLocationInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.master-data.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const locationId = readPathSegment(request, 4)?.trim();
  if (!locationId) {
    return createApiError(400, 'invalid_request', 'locationId fehlt im Pfad.', requestId);
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateWasteCollectionLocationSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const existing = await requireDeps(
      deps.loadWasteCollectionLocationById,
      'loadWasteCollectionLocationById'
    )(instanceId, locationId);
    if (!existing) {
      return createApiError(404, 'not_found', 'Der Waste-Abholort wurde nicht gefunden.', requestId);
    }

    await requireDeps(deps.saveWasteCollectionLocation, 'saveWasteCollectionLocation')(instanceId, {
      id: locationId,
      cityId: parsed.data.cityId,
      regionId: normalizeOptionalString(parsed.data.regionId),
      streetId: normalizeOptionalString(parsed.data.streetId),
      houseNumberId: normalizeOptionalString(parsed.data.houseNumberId),
      active: parsed.data.active,
    });

    const saved = await requireDeps(
      deps.loadWasteCollectionLocationById,
      'loadWasteCollectionLocationById'
    )(instanceId, locationId);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.collection-location.updated',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_collection_location',
        resourceId: locationId,
      });
      return createApiError(
        503,
        'database_unavailable',
        'Der Waste-Abholort konnte nicht verifiziert werden.',
        requestId
      );
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.collection-location.updated',
      result: 'success',
      resourceType: 'waste_collection_location',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.collection-location.updated',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_collection_location',
      resourceId: locationId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Der Waste-Abholort konnte nicht gespeichert werden.', requestId);
  }
};

export const createWasteManagementLocationTourLinkInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, createWasteLocationTourLinkSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    await requireDeps(deps.saveWasteLocationTourLink, 'saveWasteLocationTourLink')(instanceId, {
      id: parsed.data.id,
      locationId: parsed.data.locationId,
      tourId: parsed.data.tourId,
      startDate: normalizeOptionalString(parsed.data.startDate),
      endDate: normalizeOptionalString(parsed.data.endDate),
    });

    const saved = await requireDeps(
      deps.loadWasteLocationTourLinkById,
      'loadWasteLocationTourLinkById'
    )(instanceId, parsed.data.id);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.location-tour-link.created',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_location_tour_link',
        resourceId: parsed.data.id,
      });
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Tour-Zuordnung konnte nicht verifiziert werden.',
        requestId
      );
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.location-tour-link.created',
      result: 'success',
      resourceType: 'waste_location_tour_link',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.location-tour-link.created',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_location_tour_link',
      resourceId: parsed.data.id,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(
      503,
      'database_unavailable',
      'Die Waste-Tour-Zuordnung konnte nicht gespeichert werden.',
      requestId
    );
  }
};

export const updateWasteManagementLocationTourLinkInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const linkId = readPathSegment(request, 4)?.trim();
  if (!linkId) {
    return createApiError(400, 'invalid_request', 'linkId fehlt im Pfad.', requestId);
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateWasteLocationTourLinkSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const existing = await requireDeps(
      deps.loadWasteLocationTourLinkById,
      'loadWasteLocationTourLinkById'
    )(instanceId, linkId);
    if (!existing) {
      return createApiError(404, 'not_found', 'Die Waste-Tour-Zuordnung wurde nicht gefunden.', requestId);
    }

    await requireDeps(deps.saveWasteLocationTourLink, 'saveWasteLocationTourLink')(instanceId, {
      id: linkId,
      locationId: parsed.data.locationId,
      tourId: parsed.data.tourId,
      startDate: normalizeOptionalString(parsed.data.startDate),
      endDate: normalizeOptionalString(parsed.data.endDate),
    });

    const saved = await requireDeps(
      deps.loadWasteLocationTourLinkById,
      'loadWasteLocationTourLinkById'
    )(instanceId, linkId);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.location-tour-link.updated',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_location_tour_link',
        resourceId: linkId,
      });
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Tour-Zuordnung konnte nicht verifiziert werden.',
        requestId
      );
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.location-tour-link.updated',
      result: 'success',
      resourceType: 'waste_location_tour_link',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.location-tour-link.updated',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_location_tour_link',
      resourceId: linkId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(
      503,
      'database_unavailable',
      'Die Waste-Tour-Zuordnung konnte nicht gespeichert werden.',
      requestId
    );
  }
};

export const createWasteManagementLocationTourLinksBulkInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(
    request,
    createWasteLocationTourLinksBulkSchema.superRefine((value, refinementCtx) => {
      const normalizedLocationIds = value.locationIds.map((entry) => entry.trim());
      if (new Set(normalizedLocationIds).size !== normalizedLocationIds.length) {
        refinementCtx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'locationIds dürfen keine Duplikate enthalten.',
          path: ['locationIds'],
        });
      }
    })
  );
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const items = await requireDeps(
      deps.saveWasteLocationTourLinksBulk,
      'saveWasteLocationTourLinksBulk'
    )(instanceId, {
      locationIds: parsed.data.locationIds.map((entry) => entry.trim()),
      tourId: parsed.data.tourId,
      startDate: normalizeOptionalString(parsed.data.startDate),
      endDate: normalizeOptionalString(parsed.data.endDate),
    });

    const result: WasteLocationTourLinkBulkCreateResult = {
      items,
      createdCount: items.length,
    };

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.location-tour-link.bulk-created',
      result: 'success',
      resourceType: 'waste_location_tour_link_batch',
      resourceId: parsed.data.tourId,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(result, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.location-tour-link.bulk-created',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_location_tour_link_batch',
      resourceId: parsed.data.tourId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(
      503,
      'database_unavailable',
      'Die Waste-Tour-Zuordnungen konnten nicht gesammelt gespeichert werden.',
      requestId
    );
  }
};

export const getWasteManagementToursOverviewInternal = async (
  _request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.read', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  try {
    const overview = await requireDeps(deps.loadToursOverview, 'loadToursOverview')(instanceId);
    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(overview, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Touren konnten nicht geladen werden.', requestId);
  }
};

export const createWasteManagementTourInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, createWasteTourSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    await requireDeps(deps.saveWasteTour, 'saveWasteTour')(instanceId, {
      id: parsed.data.id,
      name: parsed.data.name.trim(),
      description: normalizeOptionalString(parsed.data.description),
      wasteFractionIds: parsed.data.wasteFractionIds.map((value) => value.trim()),
      recurrence: parsed.data.recurrence ?? undefined,
      firstDate: parsed.data.firstDate,
      endDate: parsed.data.endDate,
      customDates: normalizeCustomTourDates(parsed.data.customDates),
      active: parsed.data.active,
      locationCount: undefined,
    });

    const saved = await requireDeps(deps.loadWasteTourById, 'loadWasteTourById')(instanceId, parsed.data.id);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour.created',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_tour',
        resourceId: parsed.data.id,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Tour konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.tour.created',
      result: 'success',
      resourceType: 'waste_tour',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.tour.created',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_tour',
      resourceId: parsed.data.id,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Tour konnte nicht gespeichert werden.', requestId);
  }
};

export const updateWasteManagementTourInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const tourId = readPathSegment(request, 4)?.trim();
  if (!tourId) {
    return createApiError(400, 'invalid_request', 'tourId fehlt im Pfad.', requestId);
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateWasteTourSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const existing = await requireDeps(deps.loadWasteTourById, 'loadWasteTourById')(instanceId, tourId);
    if (!existing) {
      return createApiError(404, 'not_found', 'Die Waste-Tour wurde nicht gefunden.', requestId);
    }

    await requireDeps(deps.saveWasteTour, 'saveWasteTour')(instanceId, {
      id: tourId,
      name: parsed.data.name.trim(),
      description: normalizeOptionalString(parsed.data.description),
      wasteFractionIds: parsed.data.wasteFractionIds.map((value) => value.trim()),
      recurrence: parsed.data.recurrence ?? undefined,
      firstDate: parsed.data.firstDate,
      endDate: parsed.data.endDate,
      customDates: normalizeCustomTourDates(parsed.data.customDates),
      active: parsed.data.active,
      locationCount: existing.locationCount,
    });

    const saved = await requireDeps(deps.loadWasteTourById, 'loadWasteTourById')(instanceId, tourId);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour.updated',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_tour',
        resourceId: tourId,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Tour konnte nicht verifiziert werden.', requestId);
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.tour.updated',
      result: 'success',
      resourceType: 'waste_tour',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.tour.updated',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_tour',
      resourceId: tourId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', 'Die Waste-Tour konnte nicht gespeichert werden.', requestId);
  }
};

export const getWasteManagementSchedulingOverviewInternal = async (
  _request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.read', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  try {
    const overview = await requireDeps(deps.loadSchedulingOverview, 'loadSchedulingOverview')(instanceId);
    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(overview, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(
      503,
      'database_unavailable',
      'Die Waste-Ausweichtermine konnten nicht geladen werden.',
      requestId
    );
  }
};

export const createWasteManagementTourDateShiftInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, createWasteTourDateShiftSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    await requireDeps(deps.saveWasteTourDateShift, 'saveWasteTourDateShift')(instanceId, {
      id: parsed.data.id,
      tourId: parsed.data.tourId,
      originalDate: parsed.data.originalDate,
      actualDate: parsed.data.actualDate,
      hasYear: parsed.data.hasYear,
      reasonType: parsed.data.reasonType,
      reasonKey: normalizeOptionalString(parsed.data.reasonKey),
      followUpMode: parsed.data.followUpMode,
      description: normalizeOptionalString(parsed.data.description),
    });

    const saved = await requireDeps(deps.loadWasteTourDateShiftById, 'loadWasteTourDateShiftById')(
      instanceId,
      parsed.data.id
    );
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour-date-shift.created',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_tour_date_shift',
        resourceId: parsed.data.id,
      });
      return createApiError(
        503,
        'database_unavailable',
        'Der tourbezogene Waste-Ausweichtermin konnte nicht verifiziert werden.',
        requestId
      );
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.tour-date-shift.created',
      result: 'success',
      resourceType: 'waste_tour_date_shift',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.tour-date-shift.created',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_tour_date_shift',
      resourceId: parsed.data.id,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(
      503,
      'database_unavailable',
      'Der tourbezogene Waste-Ausweichtermin konnte nicht gespeichert werden.',
      requestId
    );
  }
};

export const updateWasteManagementTourDateShiftInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const shiftId = readPathSegment(request, 4)?.trim();
  if (!shiftId) {
    return createApiError(400, 'invalid_request', 'shiftId fehlt im Pfad.', requestId);
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateWasteTourDateShiftSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const existing = await requireDeps(deps.loadWasteTourDateShiftById, 'loadWasteTourDateShiftById')(instanceId, shiftId);
    if (!existing) {
      return createApiError(404, 'not_found', 'Der tourbezogene Waste-Ausweichtermin wurde nicht gefunden.', requestId);
    }

    await requireDeps(deps.saveWasteTourDateShift, 'saveWasteTourDateShift')(instanceId, {
      id: shiftId,
      tourId: parsed.data.tourId,
      originalDate: parsed.data.originalDate,
      actualDate: parsed.data.actualDate,
      hasYear: parsed.data.hasYear,
      reasonType: parsed.data.reasonType,
      reasonKey: normalizeOptionalString(parsed.data.reasonKey),
      followUpMode: parsed.data.followUpMode,
      description: normalizeOptionalString(parsed.data.description),
    });

    const saved = await requireDeps(deps.loadWasteTourDateShiftById, 'loadWasteTourDateShiftById')(instanceId, shiftId);
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour-date-shift.updated',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_tour_date_shift',
        resourceId: shiftId,
      });
      return createApiError(
        503,
        'database_unavailable',
        'Der tourbezogene Waste-Ausweichtermin konnte nicht verifiziert werden.',
        requestId
      );
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.tour-date-shift.updated',
      result: 'success',
      resourceType: 'waste_tour_date_shift',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.tour-date-shift.updated',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_tour_date_shift',
      resourceId: shiftId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(
      503,
      'database_unavailable',
      'Der tourbezogene Waste-Ausweichtermin konnte nicht gespeichert werden.',
      requestId
    );
  }
};

export const createWasteManagementGlobalDateShiftInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, createWasteGlobalDateShiftSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    await requireDeps(deps.saveWasteGlobalDateShift, 'saveWasteGlobalDateShift')(instanceId, {
      id: parsed.data.id,
      originalDate: parsed.data.originalDate,
      actualDate: parsed.data.actualDate,
      hasYear: parsed.data.hasYear,
      reasonType: parsed.data.reasonType,
      reasonKey: normalizeOptionalString(parsed.data.reasonKey),
      description: normalizeOptionalString(parsed.data.description),
      tourIds: parsed.data.tourIds?.length ? parsed.data.tourIds.map((value) => value.trim()) : undefined,
    });

    const saved = await requireDeps(deps.loadWasteGlobalDateShiftById, 'loadWasteGlobalDateShiftById')(
      instanceId,
      parsed.data.id
    );
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.global-date-shift.created',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_global_date_shift',
        resourceId: parsed.data.id,
      });
      return createApiError(
        503,
        'database_unavailable',
        'Der globale Waste-Ausweichtermin konnte nicht verifiziert werden.',
        requestId
      );
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.global-date-shift.created',
      result: 'success',
      resourceType: 'waste_global_date_shift',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.global-date-shift.created',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_global_date_shift',
      resourceId: parsed.data.id,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(
      503,
      'database_unavailable',
      'Der globale Waste-Ausweichtermin konnte nicht gespeichert werden.',
      requestId
    );
  }
};

export const updateWasteManagementGlobalDateShiftInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const shiftId = readPathSegment(request, 4)?.trim();
  if (!shiftId) {
    return createApiError(400, 'invalid_request', 'shiftId fehlt im Pfad.', requestId);
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateWasteGlobalDateShiftSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const existing = await requireDeps(deps.loadWasteGlobalDateShiftById, 'loadWasteGlobalDateShiftById')(
      instanceId,
      shiftId
    );
    if (!existing) {
      return createApiError(404, 'not_found', 'Der globale Waste-Ausweichtermin wurde nicht gefunden.', requestId);
    }

    await requireDeps(deps.saveWasteGlobalDateShift, 'saveWasteGlobalDateShift')(instanceId, {
      id: shiftId,
      originalDate: parsed.data.originalDate,
      actualDate: parsed.data.actualDate,
      hasYear: parsed.data.hasYear,
      reasonType: parsed.data.reasonType,
      reasonKey: normalizeOptionalString(parsed.data.reasonKey),
      description: normalizeOptionalString(parsed.data.description),
      tourIds: parsed.data.tourIds?.length ? parsed.data.tourIds.map((value) => value.trim()) : undefined,
    });

    const saved = await requireDeps(deps.loadWasteGlobalDateShiftById, 'loadWasteGlobalDateShiftById')(
      instanceId,
      shiftId
    );
    if (!saved) {
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.global-date-shift.updated',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_global_date_shift',
        resourceId: shiftId,
      });
      return createApiError(
        503,
        'database_unavailable',
        'Der globale Waste-Ausweichtermin konnte nicht verifiziert werden.',
        requestId
      );
    }

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.global-date-shift.updated',
      result: 'success',
      resourceType: 'waste_global_date_shift',
      resourceId: saved.id,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem(saved, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.global-date-shift.updated',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_global_date_shift',
      resourceId: shiftId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(
      503,
      'database_unavailable',
      'Der globale Waste-Ausweichtermin konnte nicht gespeichert werden.',
      requestId
    );
  }
};

export const updateWasteManagementSettingsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.settings.manage',
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, wasteManagementSettingsSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const record = await buildSettingsRecord(deps, instanceId, parsed.data);
    await requireDeps(deps.saveWasteDataSourceRecord, 'saveWasteDataSourceRecord')(record);

    const connectionCheck = await runWasteConnectionCheck({
      dataSource: await resolveWasteDataSource({
        instanceId,
        loadRecord: async () => record,
        revealSecret: (ciphertext, aad) => requireDeps(deps.revealSecret, 'revealSecret')(ciphertext, aad) ?? undefined,
      }),
      probe: deps.runConnectionProbe ?? defaultRunConnectionProbe,
      now: () => new Date(),
    });

    await requireDeps(deps.saveWasteConnectionCheck, 'saveWasteConnectionCheck')(connectionCheck);

    const updatedRecord = {
      ...record,
      visibleStatus: connectionCheck.visibleStatus,
      lastCheckedAt: connectionCheck.checkedAt,
      lastCheckStatus: connectionCheck.checkStatus,
      lastCheckErrorCode: connectionCheck.errorCode,
      lastCheckErrorMessage: connectionCheck.errorMessage,
    } satisfies WasteManagementDataSourceRecord;

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.datasource.reconfigured',
      result: 'success',
      resourceType: 'waste_data_source',
      resourceId: instanceId,
    });
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: `waste-management.connection-check.${connectionCheck.checkStatus}`,
      result: connectionCheck.checkStatus === 'succeeded' ? 'success' : 'failure',
      reasonCode: connectionCheck.errorCode,
      resourceType: 'waste_data_source',
      resourceId: instanceId,
    });
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.settings.updated',
      result: 'success',
      resourceType: 'waste_data_source',
      resourceId: instanceId,
    });

    return new Response(JSON.stringify(asApiItem(sanitizeWasteSettings(updatedRecord), requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
      throw error;
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.settings.updated',
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: 'waste_data_source',
      resourceId: instanceId,
    });
    return createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht gespeichert werden.', requestId);
  }
};

const startToolJob = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps,
  input: {
    readonly requiredPermission: string;
    readonly endpoint: string;
    readonly schema: z.ZodTypeAny;
    readonly jobTypeId: StudioJobStartRequest['jobTypeId'];
    readonly auditActionId: string;
    readonly toPayload: (data: Record<string, unknown>) => StudioJobStartRequest['input'];
  }
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(ctx, input.requiredPermission, deps, requestId);
  if (authError) {
    return authError;
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const idempotency = requireIdempotencyKey(request, requestId);
  if ('error' in idempotency) {
    return idempotency.error;
  }

  const parsed = await parseRequestBody(request, input.schema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  const response = await (deps.startPluginOperationJob ?? startPluginOperationJobFromFacade)({
    instanceId,
    actorAccountId: ctx.user.id,
    endpoint: input.endpoint,
    idempotencyKey: idempotency.key,
    requestId,
    scheduledAt: new Date().toISOString(),
    data: {
      pluginId: wasteManagementOperationsContract.pluginId,
      jobTypeId: input.jobTypeId,
      input: input.toPayload(parsed.data as Record<string, unknown>),
    },
  });

  let resourceId: string | undefined;
  let reasonCode: string | undefined;
  try {
    const payload = (await response.clone().json()) as { data?: { id?: string }; error?: string };
    resourceId = typeof payload.data?.id === 'string' ? payload.data.id : undefined;
    reasonCode = typeof payload.error === 'string' ? payload.error : undefined;
  } catch {
    // ignore non-JSON tool responses and fall back to status-only audit metadata
  }

  await emitWasteAuditEvent({
    deps,
    ctx,
    instanceId,
    actionId: input.auditActionId,
    result: response.status >= 400 ? 'failure' : 'success',
    reasonCode: response.status >= 400 ? (reasonCode ?? 'job_start_failed') : undefined,
    resourceType: 'plugin_operation_job',
    resourceId,
  });

  return response;
};

export const startWasteManagementMigrationsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> =>
  startToolJob(request, ctx, deps, {
    requiredPermission: 'waste-management.settings.manage',
    endpoint: 'POST:/api/v1/waste-management/tools/migrations',
    schema: startMigrationsSchema,
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.applyMigrations,
    auditActionId: 'waste-management.migrations.started',
    toPayload: (data) => ({
      operation: 'apply-migrations',
      targetSchema: typeof data.targetSchema === 'string' ? data.targetSchema : undefined,
      requestedByVersion: typeof data.requestedByVersion === 'string' ? data.requestedByVersion : undefined,
    }),
  });

export const startWasteManagementImportInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> =>
  startToolJob(request, ctx, deps, {
    requiredPermission: 'waste-management.import.execute',
    endpoint: 'POST:/api/v1/waste-management/tools/imports',
    schema: startImportSchema.superRefine((value, refinementCtx) => {
      if (!wasteManagementOperationsContract.isImportProfileId(value.importProfileId)) {
        refinementCtx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Unbekanntes Waste-Importprofil.',
          path: ['importProfileId'],
        });
        return;
      }

      if (!getWasteManagementImportCatalogEntry(value.importProfileId)) {
        refinementCtx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Für das Importprofil fehlt ein fachlicher Katalogeintrag.',
          path: ['importProfileId'],
        });
        return;
      }

      if (!wasteManagementOperationsContract.isImportSourceFormat(value.sourceFormat)) {
        refinementCtx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Unbekanntes Waste-Importformat.',
          path: ['sourceFormat'],
        });
        return;
      }

      const catalogEntry = getWasteManagementImportCatalogEntry(value.importProfileId);
      if (catalogEntry && !catalogEntry.sourceFormats.includes(value.sourceFormat)) {
        refinementCtx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Das Waste-Importprofil unterstützt dieses Quellformat nicht.',
          path: ['sourceFormat'],
        });
      }
    }),
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
    auditActionId: 'waste-management.import.started',
    toPayload: (data) => ({
      operation: 'import-data',
      importProfileId: data.importProfileId,
      sourceFormat: data.sourceFormat,
      dryRun: data.dryRun === true,
      blobRef: data.blobRef,
    }),
  });

export const startWasteManagementSeedInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> =>
  startToolJob(request, ctx, deps, {
    requiredPermission: 'waste-management.seed.execute',
    endpoint: 'POST:/api/v1/waste-management/tools/seed',
    schema: startSeedSchema,
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.seedData,
    auditActionId: 'waste-management.seed.started',
    toPayload: (data) => ({
      operation: 'seed-data',
      seedKey: data.seedKey === 'baseline' ? 'baseline' : 'baseline',
    }),
  });

export const startWasteManagementResetInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> =>
  startToolJob(request, ctx, deps, {
    requiredPermission: 'waste-management.reset.execute',
    endpoint: 'POST:/api/v1/waste-management/tools/reset',
    schema: startResetSchema,
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.resetData,
    auditActionId: 'waste-management.reset.started',
    toPayload: (data) => ({
      operation: 'reset-data',
      confirmationToken: String(data.confirmationToken),
    }),
  });
