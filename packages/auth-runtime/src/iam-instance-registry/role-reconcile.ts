import { readDetailInstanceId } from '@sva/instance-registry/http-contracts';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import {
  asApiItem,
  createApiError,
  requireIdempotencyKey,
} from '../iam-account-management/api-helpers.js';
import { validateCsrf as validateSessionCsrf } from '../iam-account-management/csrf.js';
import { runRoleCatalogReconciliation } from '../iam-account-management/reconcile-core.js';
import { mapRoleSyncErrorCode } from '../iam-account-management/role-audit.js';
import { jsonResponse } from '../db.js';
import type { RegistryRequestContext } from './auth-context.js';
import { isAuthenticatedRegistryServiceRequest } from './service-token.js';
import { ensurePlatformAccess } from './http.js';
import { parseRegistryRequestBody } from './request-parsing.js';
import { withRegistryService } from './repository.js';

const logger = createSdkLogger({
  component: 'iam-instance-registry-role-reconcile',
  level: 'info',
});

const reconcileTenantIamRolesSchema = z
  .object({ planFingerprint: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();

const readSha256Fingerprint = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value) ? value : undefined;

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
  const parsed = await parseRegistryRequestBody(request, reconcileTenantIamRolesSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }

  try {
    const detail = await withRegistryService((service) => service.getInstanceDetail(instanceId));
    if (!detail) {
      return createApiError(404, 'not_found', 'Instanz nicht gefunden.', requestId);
    }
    const latestRun = detail.latestKeycloakProvisioningRun;
    const currentPlan = await withRegistryService((service) =>
      service.planKeycloakProvisioning(instanceId, { forceLive: true })
    );
    const confirmedPlanFingerprint = latestRun?.steps.find(({ stepKey }) => stepKey === 'queued')
      ?.details.confirmedPlanFingerprint;
    const confirmedRoleCatalogFingerprint = latestRun?.steps.find(
      ({ stepKey }) => stepKey === 'queued'
    )?.details.confirmedRoleCatalogFingerprint;
    const validRoleCatalogFingerprint = readSha256Fingerprint(confirmedRoleCatalogFingerprint);
    const gateResults = {
      latest_run_succeeded: latestRun?.overallStatus === 'succeeded',
      current_plan_ready: currentPlan?.overallStatus === 'ready',
      current_plan_mutation_free: !(currentPlan?.steps ?? []).some(
        (step) => step.action === 'create' || step.action === 'update'
      ),
      requested_plan_matches_confirmed: confirmedPlanFingerprint === parsed.data.planFingerprint,
      role_catalog_fingerprint_valid: Boolean(validRoleCatalogFingerprint),
    };
    if (Object.values(gateResults).some((passed) => !passed)) {
      logger.warn('tenant_iam_role_reconcile_rejected', {
        operation: 'reconcile_tenant_iam_roles',
        result: 'rejected',
        classification: 'conflict',
        error_code: 'keycloak_plan_fingerprint_stale',
        reason_code: 'keycloak_plan_fingerprint_stale',
        request_id: requestId,
        instance_id: instanceId,
        ...gateResults,
      });
      return createApiError(
        409,
        'conflict',
        'Der bestätigte Keycloak-Plan ist nicht mehr aktuell.',
        requestId,
        { reason_code: 'keycloak_plan_fingerprint_stale' }
      );
    }
    const report = await runRoleCatalogReconciliation({
      instanceId,
      requestId,
      expectedRoleCatalogFingerprint: validRoleCatalogFingerprint,
    });
    return jsonResponse(200, asApiItem(report, requestId));
  } catch (error) {
    if (error instanceof Error && error.message === 'role_catalog_fingerprint_stale') {
      return createApiError(
        409,
        'conflict',
        'Der bestätigte Rollenkatalog ist nicht mehr aktuell.',
        requestId,
        { reason_code: 'role_catalog_fingerprint_stale' }
      );
    }
    return createApiError(
      503,
      'keycloak_unavailable',
      'Rollen-Reconciliation konnte nicht ausgeführt werden.',
      requestId,
      {
        syncState: 'failed',
        syncError: { code: mapRoleSyncErrorCode(error) },
        scope_kind: 'instance',
        instanceId,
      }
    );
  }
};
