import { asApiItem, createApiError, parseRequestBody, requireIdempotencyKey } from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { getWorkspaceContext } from '@sva/server-runtime';
import type { InstanceStatus } from '@sva/core';
import {
  classifyInstanceMutationError,
  type InstanceMutationErrorCode,
} from '@sva/instance-registry/mutation-errors';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import {
  ensurePlatformAccess,
  executeKeycloakProvisioningSchema,
  readDetailInstanceId,
  reconcileKeycloakSchema,
  requireFreshReauth,
  statusMutationSchema,
} from './http.js';
import { withRegistryService } from './repository.js';

const mutationErrorMessages: Record<InstanceMutationErrorCode, string> = {
  tenant_admin_client_not_configured:
    'Für diese Instanz ist noch kein Tenant-Admin-Client hinterlegt.',
  tenant_admin_client_secret_missing:
    'Für diese Instanz ist noch kein Tenant-Admin-Client-Secret hinterlegt.',
  tenant_auth_client_secret_missing:
    'Für diese Instanz ist noch kein Tenant-Client-Secret hinterlegt.',
  encryption_not_configured:
    'Die Feldverschlüsselung für Tenant-Secrets ist nicht konfiguriert.',
  keycloak_unavailable:
    'Keycloak konnte für diese Instanz nicht abgeglichen werden.',
};

export const mapInstanceMutationError = (error: unknown): Response => {
  const classification = classifyInstanceMutationError(error);
  return createApiError(
    classification.status,
    classification.code,
    mutationErrorMessages[classification.code],
    getWorkspaceContext().requestId,
    classification.details
  );
};

export const reconcileInstanceKeycloakMutation = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }

  const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
  if (csrfError) {
    return csrfError;
  }

  const reauthError = requireFreshReauth(request);
  if (reauthError) {
    return reauthError;
  }

  const idempotencyResult = requireIdempotencyKey(request, getWorkspaceContext().requestId);
  if ('error' in idempotencyResult) {
    return idempotencyResult.error;
  }

  const instanceId = readDetailInstanceId(request);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getWorkspaceContext().requestId);
  }

  const payloadResult = await parseRequestBody(request, reconcileKeycloakSchema);
  if (!payloadResult.ok) {
    return createApiError(400, 'invalid_request', payloadResult.message, getWorkspaceContext().requestId);
  }

  try {
    const status = await withRegistryService((service) =>
      service.reconcileKeycloak({
        instanceId,
        actorId: ctx.user.id,
        requestId: getWorkspaceContext().requestId,
        tenantAdminTemporaryPassword: payloadResult.data.tenantAdminTemporaryPassword,
        rotateClientSecret: payloadResult.data.rotateClientSecret,
      })
    );
    if (!status) {
      return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', getWorkspaceContext().requestId);
    }
    return jsonResponse(200, asApiItem(status, getWorkspaceContext().requestId));
  } catch (error) {
    return mapInstanceMutationError(error);
  }
};

export const executeInstanceKeycloakProvisioningMutation = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }

  const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
  if (csrfError) {
    return csrfError;
  }

  const reauthError = requireFreshReauth(request);
  if (reauthError) {
    return reauthError;
  }

  const idempotencyResult = requireIdempotencyKey(request, getWorkspaceContext().requestId);
  if ('error' in idempotencyResult) {
    return idempotencyResult.error;
  }

  const instanceId = readDetailInstanceId(request);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getWorkspaceContext().requestId);
  }

  const payloadResult = await parseRequestBody(request, executeKeycloakProvisioningSchema);
  if (!payloadResult.ok) {
    return createApiError(400, 'invalid_request', payloadResult.message, getWorkspaceContext().requestId);
  }

  try {
    const run = await withRegistryService((service) =>
      service.executeKeycloakProvisioning({
        instanceId,
        actorId: ctx.user.id,
        requestId: getWorkspaceContext().requestId,
        intent: payloadResult.data.intent,
        tenantAdminTemporaryPassword: payloadResult.data.tenantAdminTemporaryPassword,
      })
    );
    if (!run) {
      return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', getWorkspaceContext().requestId);
    }
    return jsonResponse(200, asApiItem(run, getWorkspaceContext().requestId));
  } catch (error) {
    return mapInstanceMutationError(error);
  }
};

export const mutateInstanceStatus = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>
): Promise<Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }

  const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
  if (csrfError) {
    return csrfError;
  }

  const reauthError = requireFreshReauth(request);
  if (reauthError) {
    return reauthError;
  }

  const idempotencyResult = requireIdempotencyKey(request, getWorkspaceContext().requestId);
  if ('error' in idempotencyResult) {
    return idempotencyResult.error;
  }

  const payloadResult = await parseRequestBody(request, statusMutationSchema);
  if (!payloadResult.ok || payloadResult.data.status !== nextStatus) {
    return createApiError(400, 'invalid_request', 'Ungültiger Statuswechsel.', getWorkspaceContext().requestId);
  }

  const instanceId = readDetailInstanceId(request);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getWorkspaceContext().requestId);
  }

  const result = await withRegistryService((service) =>
    service.changeStatus({
      idempotencyKey: idempotencyResult.key,
      instanceId,
      nextStatus,
      actorId: ctx.user.id,
      requestId: getWorkspaceContext().requestId,
    })
  );

  if (!result.ok) {
    if (result.reason === 'not_found') {
      return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', getWorkspaceContext().requestId);
    }
    return createApiError(409, 'conflict', 'Statuswechsel ist im aktuellen Zustand nicht erlaubt.', getWorkspaceContext().requestId);
  }

  return jsonResponse(200, asApiItem(result.instance, getWorkspaceContext().requestId));
};
