import type { InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/core';

import type { InstanceRegistryServiceDeps } from './service-types.js';
import { continueAt, requireDependency } from './tenant-provisioning-state.js';

type TenantIamStepContext = {
  deps: InstanceRegistryServiceDeps;
  run: InstanceProvisioningRun;
  instance: InstanceRegistryRecord;
  workerId: string;
  now: Date;
  assertExecutionActive: () => void;
};

export const tenantIamRolesStep = async ({
  deps,
  run,
  instance,
  workerId,
  now,
  assertExecutionActive,
}: TenantIamStepContext): Promise<InstanceProvisioningRun> => {
  assertExecutionActive();
  const report = await requireDependency(
    deps.reconcileTenantIamRoles,
    'dependency_missing_reconcileTenantIamRoles'
  )({
    instanceId: instance.instanceId,
    actorId: run.actorId,
    requestId: run.requestId,
  });
  assertExecutionActive();
  if (report.outcome !== 'success') throw new Error('tenant_iam_roles_reconcile_not_ready');
  return continueAt(deps, run, workerId, 'tenant_iam_access', now, {
    terminalEvidence: {
      tenantIamRoleReconcile: {
        outcome: report.outcome,
        checkedCount: report.checkedCount,
        correctedCount: report.correctedCount,
        failedCount: report.failedCount,
        requiresManualActionCount: report.requiresManualActionCount,
      },
    },
  });
};

export const tenantIamAccessStep = async ({
  deps,
  run,
  instance,
  workerId,
  now,
  assertExecutionActive,
}: TenantIamStepContext): Promise<InstanceProvisioningRun> => {
  assertExecutionActive();
  const access = await requireDependency(
    deps.probeTenantIamAccess,
    'dependency_missing_probeTenantIamAccess'
  )({
    instanceId: instance.instanceId,
    actorId: run.actorId,
    requestId: run.requestId,
  });
  assertExecutionActive();
  await deps.repository.appendAuditEvent({
    instanceId: instance.instanceId,
    eventType: 'tenant_iam_access_probed',
    actorId: run.actorId,
    requestId: run.requestId,
    details: {
      status: access.status,
      summary: access.summary,
      checkedAt: access.checkedAt,
      errorCode: access.errorCode,
      serviceIdentity: access.serviceIdentity ?? 'sva-studio-tenant-iam',
      classification: access.classification,
      requestId: access.requestId ?? run.requestId,
    },
  });
  assertExecutionActive();
  if (access.status !== 'ready') throw new Error('tenant_iam_access_not_ready');
  return continueAt(deps, run, workerId, 'activate', now, {
    terminalEvidence: {
      tenantIamAccess: {
        status: access.status,
        classification: access.classification,
        errorCode: access.errorCode,
        serviceIdentity: access.serviceIdentity ?? 'sva-studio-tenant-iam',
        checkedAt: access.checkedAt,
      },
    },
  });
};
