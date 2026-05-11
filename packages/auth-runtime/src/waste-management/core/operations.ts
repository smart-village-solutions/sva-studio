import { getWasteManagementImportCatalogEntry, wasteManagementOperationsContract, type StudioJobStartRequest } from '@sva/core';
import { z } from 'zod';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, requireIdempotencyKey } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent, getAuthorizedWasteManagementInstanceId } from './auth.js';
import { startPluginOperationJobFromFacade } from './operations-support.js';
import { wasteManagementOperationSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId } from './utils.js';

const { startImportSchema, startInitializeSchema, startMigrationsSchema, startResetSchema, startSeedSchema } =
  wasteManagementOperationSchemas;

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

  const instanceId = getAuthorizedWasteManagementInstanceId(ctx);

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
      }),
    }),
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
      toPayload: (data) => ({
        operation: 'seed-data',
        seedKey: 'baseline',
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
