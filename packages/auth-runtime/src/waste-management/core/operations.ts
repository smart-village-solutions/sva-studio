import { getWasteManagementImportCatalogEntry, wasteManagementOperationsContract, type StudioJobStartRequest } from '@sva/core';
import { z } from 'zod';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { resolveActorInfo } from '../../iam-account-management/shared.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody, requireIdempotencyKey } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent, getAuthorizedWasteManagementInstanceId } from './auth.js';
import { startPluginOperationJobFromFacade } from './operations-support.js';
import { wasteManagementOperationSchemas } from './schemas.js';
import { loadConfiguredWasteSettings } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId } from './utils.js';

const {
  previewLocationTourPickupDateImportSchema,
  startImportSchema,
  startInitializeSchema,
  startMigrationsSchema,
  startResetSchema,
  startSeedSchema,
  startSyncWasteTypesSchema,
} =
  wasteManagementOperationSchemas;

const requirePreview = (deps: WasteManagementHandlerDeps) => {
  if (!deps.previewWasteLocationTourPickupDateImport) {
    throw new Error('missing_preview_waste_location_tour_pickup_date_import');
  }
  return deps.previewWasteLocationTourPickupDateImport;
};

const isPreviewInputError = (message: string): boolean =>
  message.startsWith('unsupported_blob_ref:') ||
  message.startsWith('invalid_blob_ref:') ||
  message.startsWith('unsupported_import_source_format:') ||
  message.startsWith('ambiguous_regionless_city_match:');

const toPreviewErrorResponse = (error: unknown, requestId: string | undefined): Response => {
  const message = error instanceof Error ? error.message : 'Die Importvorschau konnte nicht erstellt werden.';
  if (isPreviewInputError(message)) {
    if (message.startsWith('ambiguous_regionless_city_match:')) {
      const cityName = message.slice('ambiguous_regionless_city_match:'.length) || 'unbekannt';
      return createApiError(
        400,
        'invalid_request',
        `Die Region muss angegeben werden, weil der Stadtname mehrdeutig ist: ${cityName}.`,
        requestId
      );
    }
    return createApiError(400, 'invalid_request', message, requestId);
  }

  return createApiError(503, 'database_unavailable', 'Die Importvorschau konnte nicht erstellt werden.', requestId);
};

const resolveBoundTargetSchema = async (
  instanceId: string,
  requestId: string | undefined,
  deps: WasteManagementHandlerDeps,
  requestedSchema: unknown
): Promise<string | Response> => {
  try {
    const settings = await loadConfiguredWasteSettings(
      {
        ...deps,
        loadDefaultInterfaceRecord: deps.loadDefaultInterfaceRecord,
      },
      instanceId
    );

    if (!settings?.schemaName || settings.schemaName.trim().length === 0) {
      return createApiError(400, 'invalid_request', 'Für die Instanz ist kein Waste-Schema konfiguriert.', requestId);
    }

    const configuredSchema = settings.schemaName.trim();
    const normalizedRequestedSchema = typeof requestedSchema === 'string' ? requestedSchema.trim() : '';
    if (normalizedRequestedSchema.length > 0 && normalizedRequestedSchema !== configuredSchema) {
      return createApiError(
        400,
        'invalid_request',
        'Waste-Operationen dürfen nur gegen das für die Instanz konfigurierte Schema ausgeführt werden.',
        requestId
      );
    }

    return configuredSchema;
  } catch {
    return createApiError(503, 'database_unavailable', 'Waste-Datenquelle konnte nicht geladen werden.', requestId);
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

  const authorizedInstanceId = getAuthorizedWasteManagementInstanceId(ctx);

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

  const actorResolution = await (deps.resolveActorInfo ??
    ((scopedRequest: Request, scopedCtx: AuthenticatedRequestContext) =>
      resolveActorInfo(scopedRequest, scopedCtx, { requireActorMembership: true })))(request, ctx);
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(
      403,
      'forbidden',
      'Akteur-Account nicht gefunden.',
      actorResolution.actor.requestId ?? requestId
    );
  }

  const instanceId = actorResolution.actor.instanceId;
  const normalizedData = { ...(parsed.data as Record<string, unknown>) };
  if ('targetSchema' in normalizedData) {
    const boundTargetSchema = await resolveBoundTargetSchema(
      authorizedInstanceId,
      requestId,
      deps,
      normalizedData.targetSchema
    );
    if (boundTargetSchema instanceof Response) {
      return boundTargetSchema;
    }
    normalizedData.targetSchema = boundTargetSchema;
  }

  const response = await (deps.startPluginOperationJob ?? startPluginOperationJobFromFacade)({
    instanceId,
    actorAccountId: actorResolution.actor.actorAccountId,
    endpoint: input.endpoint,
    idempotencyKey: idempotency.key,
    requestId,
    scheduledAt: new Date().toISOString(),
    data: {
      pluginId: wasteManagementOperationsContract.pluginId,
      jobTypeId: input.jobTypeId,
      input: input.toPayload(normalizedData),
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

export const wasteManagementOperationHandlers = {
  startWasteManagementInitializeInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> =>
    startToolJob(request, ctx, deps, {
      requiredPermission: 'waste-management.settings.manage',
      endpoint: 'POST:/api/v1/waste-management/tools/initialize',
      schema: startInitializeSchema,
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.initializeDataSource,
      auditActionId: 'waste-management.initialize.started',
      toPayload: (data) => ({
        operation: 'initialize-data-source',
        targetSchema: typeof data.targetSchema === 'string' ? data.targetSchema : undefined,
      }),
    }),
  startWasteManagementMigrationsInternal: async (
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
    }),
  startWasteManagementImportInternal: async (
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
        delimiterOverride: typeof data.delimiterOverride === 'string' ? data.delimiterOverride : undefined,
      }),
    }),
  previewWasteManagementLocationTourPickupDateImportInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.import.execute', deps, requestId);
    if (authError) {
      return authError;
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const instanceId = getAuthorizedWasteManagementInstanceId(ctx);
    const parsed = await parseRequestBody(request, previewLocationTourPickupDateImportSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const preview = await requirePreview(deps)(
        {
          instanceId,
          sourceFormat: parsed.data.sourceFormat,
          blobRef: parsed.data.blobRef,
          delimiterOverride: parsed.data.delimiterOverride,
        }
      );
      return new Response(JSON.stringify(asApiItem(preview, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return toPreviewErrorResponse(error, requestId);
    }
  },
  startWasteManagementSeedInternal: async (
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
      toPayload: () => ({
        operation: 'seed-data',
        seedKey: 'baseline',
      }),
    }),
  startWasteManagementSyncWasteTypesInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> =>
    startToolJob(request, ctx, deps, {
      requiredPermission: 'waste-management.master-data.manage',
      endpoint: 'POST:/api/v1/waste-management/tools/sync-waste-types',
      schema: startSyncWasteTypesSchema,
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
      auditActionId: 'waste-management.sync-waste-types.started',
      toPayload: () => ({
        operation: 'sync-waste-types',
        keycloakSubject: ctx.user.id,
        activeOrganizationId: ctx.activeOrganizationId,
      }),
    }),
  startWasteManagementResetInternal: async (
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
    }),
};
