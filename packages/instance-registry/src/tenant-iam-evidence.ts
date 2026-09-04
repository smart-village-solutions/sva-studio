import { areAllInstanceKeycloakRequirementsSatisfied } from '@sva/core';

import type {
  IamInstanceDetail,
  IamTenantIamAxis,
  IamTenantIamEvidenceClassification,
} from '@sva/core';

const missingErrorCodes = new Set(['AUTH_CLIENT_MISSING', 'TENANT_ADMIN_CLIENT_MISSING']);
const forbiddenErrorCodes = new Set(['IDP_FORBIDDEN']);
const unavailableErrorCodes = new Set(['IDP_UNAVAILABLE', 'keycloak_unavailable']);

export const classifyTenantIamAxis = (
  input: Pick<IamTenantIamAxis, 'status' | 'errorCode'>
): IamTenantIamEvidenceClassification => {
  if (input.status === 'ready') return 'ready';
  if (input.errorCode && missingErrorCodes.has(input.errorCode)) return 'missing';
  if (input.errorCode && forbiddenErrorCodes.has(input.errorCode)) return 'forbidden';
  if (input.errorCode && unavailableErrorCodes.has(input.errorCode)) return 'unavailable';
  if (input.status === 'unknown' || input.errorCode === 'AUTH_CLIENT_VISIBILITY_UNCONFIRMED') {
    return 'unknown';
  }
  return 'misconfigured';
};

export const classifyTenantIamConfiguration = (
  status: NonNullable<IamInstanceDetail['keycloakStatus']>
): IamTenantIamEvidenceClassification => {
  if (areAllInstanceKeycloakRequirementsSatisfied(status)) return 'ready';
  if (
    !status.realmExists ||
    !status.clientExists ||
    !status.tenantAdminClientExists ||
    !status.systemAdminRoleExists ||
    !status.tenantAdminExists
  ) {
    return 'missing';
  }
  return 'misconfigured';
};

export const getTenantIamServiceIdentity = (
  source: IamTenantIamAxis['source']
): IamTenantIamAxis['serviceIdentity'] => {
  switch (source) {
    case 'keycloak_status_snapshot':
    case 'keycloak_provisioning_run':
      return 'sva-studio-provisioner';
    case 'access_probe':
    case 'role_reconcile':
      return 'sva-studio-tenant-iam';
    case 'registry':
      return undefined;
  }
};
