import type { IamOrganizationDetail } from '@sva/core';
import { loadOrganizationDetail } from '@sva/iam-admin';
import { createSdkLogger } from '@sva/server-runtime';

import { MainserverUserProvisioningError } from '../iam-account-management/mainserver-user-provisioning-error.js';
import { emitActivityLog, withInstanceScopedDb } from '../iam-account-management/shared.js';

export const ORGANIZATION_PROVISIONING_LEASE_SECONDS = 300;

export const organizationProvisioningLogger = createSdkLogger({
  component: 'iam-organization-mainserver-provisioning',
  level: 'info',
});

export type OrganizationMainserverProvisioningTrigger = 'organization_create' | 'explicit_retry';

export type OrganizationMainserverProvisioningInput = {
  readonly instanceId: string;
  readonly organizationId: string;
  readonly actorAccountId: string;
  readonly actorSubject: string;
  readonly trigger: OrganizationMainserverProvisioningTrigger;
  readonly operationReference?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type OrganizationMainserverProvisioningResult = {
  readonly outcome: 'ready' | 'in_progress' | 'skipped' | 'failed' | 'reconciliation_required';
  readonly organization: IamOrganizationDetail;
  readonly errorCode?: string;
};

export const loadProvisioningOrganization = async (
  instanceId: string,
  organizationId: string
): Promise<IamOrganizationDetail> => {
  const organization = await withInstanceScopedDb(instanceId, (client) =>
    loadOrganizationDetail(client, { instanceId, organizationId })
  );
  if (!organization) {
    throw new Error('organization_not_found');
  }
  return organization;
};

export const toSafeProvisioningErrorCode = (error: unknown): string => {
  if (error instanceof MainserverUserProvisioningError) {
    const isProvisioningRequestFailure = error.code !== 'token_request_failed';
    if (isProvisioningRequestFailure && error.statusCode === 403) {
      return 'mainserver_tenant_forbidden';
    }
    if (isProvisioningRequestFailure && error.statusCode === 422) {
      return 'mainserver_request_rejected';
    }
    return error.code;
  }
  if (error instanceof Error) {
    const safeCodes = new Set([
      'organization_technical_account_ambiguous',
      'organization_technical_account_collision',
      'organization_provisioning_lease_lost',
    ]);
    if (safeCodes.has(error.message)) {
      return error.message;
    }
  }
  return 'organization_mainserver_provisioning_failed';
};

export const auditOrganizationProvisioning = async (input: {
  readonly instanceId: string;
  readonly organizationId: string;
  readonly actorAccountId: string;
  readonly trigger: OrganizationMainserverProvisioningTrigger;
  readonly operationReference: string;
  readonly phase: string;
  readonly outcome: OrganizationMainserverProvisioningResult['outcome'];
  readonly technicalAccountId?: string;
  readonly errorCode?: string;
  readonly requestId?: string;
  readonly traceId?: string;
}): Promise<void> => {
  try {
    await withInstanceScopedDb(input.instanceId, (client) =>
      emitActivityLog(client, {
        instanceId: input.instanceId,
        accountId: input.actorAccountId,
        subjectId: input.technicalAccountId,
        eventType: `organization.mainserver_provisioning_${input.outcome}`,
        result: input.outcome === 'failed' ? 'failure' : 'success',
        payload: {
          organization_id: input.organizationId,
          trigger: input.trigger,
          operation_reference: input.operationReference,
          phase: input.phase,
          outcome: input.outcome,
          ...(input.errorCode ? { error_code: input.errorCode } : {}),
        },
        requestId: input.requestId,
        traceId: input.traceId,
      })
    );
  } catch (error) {
    organizationProvisioningLogger.error('Organization Mainserver provisioning audit failed', {
      workspace_id: input.instanceId,
      context: {
        operation: 'organization_mainserver_provisioning_audit',
        organization_id: input.organizationId,
        operation_reference: input.operationReference,
        outcome: input.outcome,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
      },
    });
  }
};
