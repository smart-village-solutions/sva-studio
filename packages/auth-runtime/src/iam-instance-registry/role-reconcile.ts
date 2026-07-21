import { readDetailInstanceId } from '@sva/instance-registry/http-contracts';
import { getWorkspaceContext } from '@sva/server-runtime';

import { asApiItem, createApiError, requireIdempotencyKey } from '../iam-account-management/api-helpers.js';
import { validateCsrf as validateSessionCsrf } from '../iam-account-management/csrf.js';
import { runRoleCatalogReconciliation } from '../iam-account-management/reconcile-core.js';
import { jsonResponse } from '../db.js';
import type { RegistryRequestContext } from './auth-context.js';
import { isAuthenticatedRegistryServiceRequest } from './service-token.js';
import { ensurePlatformAccess } from './http.js';

export const reconcileInstanceIamRolesInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => {
  const requestId = getWorkspaceContext().requestId;
  const instanceId = readDetailInstanceId(request);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', requestId);
  }
  const platformAccess = ensurePlatformAccess(request, ctx);
  if (platformAccess) return platformAccess;
  if (!isAuthenticatedRegistryServiceRequest(request)) {
    const csrfError = validateSessionCsrf(request, requestId);
    if (csrfError) return csrfError;
  }
  const idempotency = requireIdempotencyKey(request, requestId);
  if ('error' in idempotency) return idempotency.error;

  try {
    const report = await runRoleCatalogReconciliation({ instanceId, requestId });
    return jsonResponse(200, asApiItem(report, requestId));
  } catch {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Rollen-Reconciliation konnte nicht ausgeführt werden.',
      requestId
    );
  }
};
