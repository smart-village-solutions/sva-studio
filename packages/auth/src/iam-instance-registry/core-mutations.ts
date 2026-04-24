import { asApiItem, createApiError, parseRequestBody, requireIdempotencyKey } from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { getWorkspaceContext } from '@sva/server-runtime';
import type { ApiErrorCode, InstanceStatus } from '@sva/core';
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

type BlockedDriftErrorCode =
  | 'tenant_admin_client_not_configured'
  | 'tenant_admin_client_secret_missing'
  | 'tenant_auth_client_secret_missing';

const inferBlockedDriftErrorCode = (driftSummary: string): BlockedDriftErrorCode => {
  const normalizedSummary = driftSummary.toLowerCase();
  if (
    normalizedSummary.includes('tenant_auth_client_secret_missing') ||
    normalizedSummary.includes('tenant-client-secret')
  ) {
    return 'tenant_auth_client_secret_missing';
  }
  if (
    normalizedSummary.includes('tenant_admin_client_secret_missing') ||
    (normalizedSummary.includes('tenant-admin-client') && normalizedSummary.includes('secret'))
  ) {
    return 'tenant_admin_client_secret_missing';
  }
  return 'tenant_admin_client_not_configured';
};

const createBlockedDriftError = (driftSummary: string): Response => {
  const code = inferBlockedDriftErrorCode(driftSummary);
  const messageByCode: Record<BlockedDriftErrorCode, string> = {
    tenant_admin_client_not_configured:
      'Blockerrelevanter Drift verhindert den Keycloak-Abgleich für diese Instanz.',
    tenant_admin_client_secret_missing:
      'Für diese Instanz fehlt ein lesbares Tenant-Admin-Client-Secret für den Keycloak-Abgleich.',
    tenant_auth_client_secret_missing:
      'Für diese Instanz fehlt ein lesbares Tenant-Client-Secret für den Keycloak-Abgleich.',
  };

  return createApiError(409, code, messageByCode[code], getWorkspaceContext().requestId, {
    dependency: 'keycloak',
    reason_code: 'registry_or_provisioning_drift_blocked',
    drift_summary: driftSummary || undefined,
  });
};

export const mapInstanceMutationError = (error: unknown): Response => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('registry_or_provisioning_drift_blocked:')) {
    const driftSummary = message.slice('registry_or_provisioning_drift_blocked:'.length).trim();
    return createBlockedDriftError(driftSummary);
  }
  if (message.includes('tenant_admin_client_not_configured')) {
    return createApiError(409, 'tenant_admin_client_not_configured', 'Für diese Instanz ist noch kein Tenant-Admin-Client hinterlegt.', getWorkspaceContext().requestId);
  }
  if (message.includes('tenant_admin_client_secret_missing')) {
    return createApiError(409, 'tenant_admin_client_secret_missing', 'Für diese Instanz ist noch kein Tenant-Admin-Client-Secret hinterlegt.', getWorkspaceContext().requestId);
  }
  if (message.includes('tenant_auth_client_secret_missing')) {
    return createApiError(409, 'tenant_auth_client_secret_missing', 'Für diese Instanz ist noch kein Tenant-Client-Secret hinterlegt.', getWorkspaceContext().requestId);
  }
  if (message.startsWith('pii_encryption_required')) {
    return createApiError(503, 'encryption_not_configured', 'Die Feldverschlüsselung für Tenant-Secrets ist nicht konfiguriert.', getWorkspaceContext().requestId);
  }
  return createApiError(502, 'keycloak_unavailable', 'Keycloak konnte für diese Instanz nicht abgeglichen werden.', getWorkspaceContext().requestId);
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
