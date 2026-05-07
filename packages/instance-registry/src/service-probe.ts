import { buildTenantIamStatus } from './service-helpers.js';
import { createGetKeycloakStatusHandler } from './service-keycloak.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

export const createProbeTenantIamAccessHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['probeTenantIamAccess'] =>
  async (input) => {
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance) {
      return null;
    }
    if (!deps.probeTenantIamAccess) {
      throw new Error('dependency_missing_probeTenantIamAccess');
    }

    const access = await deps.probeTenantIamAccess({
      instanceId: input.instanceId,
      actorId: input.actorId,
      requestId: input.requestId,
    });

    await deps.repository.appendAuditEvent({
      instanceId: input.instanceId,
      eventType: 'tenant_iam_access_probed',
      actorId: input.actorId,
      requestId: input.requestId,
      details: {
        status: access.status,
        summary: access.summary,
        checkedAt: access.checkedAt,
        errorCode: access.errorCode,
        requestId: access.requestId ?? input.requestId,
      },
    });

    const [keycloakStatus, reconcileEvidence] = await Promise.all([
      createGetKeycloakStatusHandler(deps)(input.instanceId),
      deps.repository.getRoleReconcileSummary(input.instanceId),
    ]);

    return buildTenantIamStatus({
      keycloakStatus: keycloakStatus ?? undefined,
      accessEvidence: access,
      reconcileEvidence: reconcileEvidence
        ? {
            status: reconcileEvidence.status,
            summary: reconcileEvidence.summary,
            source: 'role_reconcile',
            checkedAt: reconcileEvidence.checkedAt,
            errorCode: reconcileEvidence.errorCode,
            requestId: reconcileEvidence.requestId,
          }
        : undefined,
    });
  };
