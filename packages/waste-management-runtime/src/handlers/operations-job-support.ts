import {
  createApiError,
  parseRequestBody,
  requireIdempotencyKey,
} from '@sva/server-runtime';
import { wasteManagementOperationsContract } from '@sva/waste-management-contracts';
import {
  authorizeWasteManagementAction,
  emitWasteAuditEvent,
  getAuthorizedWasteManagementInstanceId,
} from './auth.js';
import { validateCsrf } from './host-controls.js';
import { loadConfiguredWasteSettings } from './settings-shared.js';
import { getRequestId, requireDeps } from './utils.js';
import type { StudioJobStartRequest } from '@sva/core';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';
import type { z } from 'zod';

type ToolJobInput = {
  readonly requiredPermission: string;
  readonly endpoint: string;
  readonly schema: z.ZodTypeAny;
  readonly jobTypeId: StudioJobStartRequest['jobTypeId'];
  readonly auditActionId: string;
  readonly rejectWhenActiveJobExists?: boolean;
  readonly toPayload: (data: Record<string, unknown>) => StudioJobStartRequest['input'];
};

const withActiveJobConflictPolicy = <T extends object>(
  request: T,
  rejectWhenActiveJobExists: boolean | undefined
): T & { readonly rejectWhenActiveJobExists?: true } =>
  rejectWhenActiveJobExists === true ? { ...request, rejectWhenActiveJobExists: true } : request;

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
      return createApiError(
        400,
        'invalid_request',
        'Für die Instanz ist kein Waste-Schema konfiguriert.',
        requestId
      );
    }

    const configuredSchema = settings.schemaName.trim();
    const normalizedRequestedSchema =
      typeof requestedSchema === 'string' ? requestedSchema.trim() : '';
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
    return createApiError(
      503,
      'database_unavailable',
      'Waste-Datenquelle konnte nicht geladen werden.',
      requestId
    );
  }
};

const resolveToolJobActorAndData = async ({
  request,
  ctx,
  deps,
  authorizedInstanceId,
  requestId,
  parsedData,
}: {
  readonly request: Request;
  readonly ctx: AuthenticatedRequestContext;
  readonly deps: WasteManagementHandlerDeps;
  readonly authorizedInstanceId: string;
  readonly requestId: string | undefined;
  readonly parsedData: Record<string, unknown>;
}) => {
  const actorResolution = await requireDeps(deps.resolveActorInfo, 'resolveActorInfo')(
    request,
    ctx
  );
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
  const actorAccountId = actorResolution.actor.actorAccountId;
  const normalizedData = { ...parsedData };
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

  return { instanceId, actorAccountId, normalizedData };
};

const auditToolJobResponse = async (
  response: Response,
  deps: WasteManagementHandlerDeps,
  ctx: AuthenticatedRequestContext,
  instanceId: string,
  auditActionId: string
): Promise<void> => {
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
    actionId: auditActionId,
    result: response.status >= 400 ? 'failure' : 'success',
    reasonCode: response.status >= 400 ? (reasonCode ?? 'job_start_failed') : undefined,
    resourceType: 'plugin_operation_job',
    resourceId,
  });
};

export const startToolJob = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps,
  input: ToolJobInput
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    input.requiredPermission,
    deps,
    requestId
  );
  if (authError) {
    return authError;
  }

  const authorizedInstanceId = getAuthorizedWasteManagementInstanceId(ctx);

  const csrfError = validateCsrf(deps, request, requestId);
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

  const actorAndData = await resolveToolJobActorAndData({
    request,
    ctx,
    deps,
    authorizedInstanceId,
    requestId,
    parsedData: parsed.data as Record<string, unknown>,
  });
  if (actorAndData instanceof Response) {
    return actorAndData;
  }
  const { instanceId, actorAccountId, normalizedData } = actorAndData;

  const response = await requireDeps(
    deps.startPluginOperationJob,
    'startPluginOperationJob'
  )(
    withActiveJobConflictPolicy(
      {
        instanceId,
        actorAccountId,
        endpoint: input.endpoint,
        idempotencyKey: idempotency.key,
        requestId,
        scheduledAt: new Date().toISOString(),
        data: {
          pluginId: wasteManagementOperationsContract.pluginId,
          jobTypeId: input.jobTypeId,
          input: input.toPayload(normalizedData),
        },
      },
      input.rejectWhenActiveJobExists
    )
  );

  await auditToolJobResponse(response, deps, ctx, instanceId, input.auditActionId);

  return response;
};
