import { areAllInstanceKeycloakRequirementsSatisfied } from '@sva/core';

import type {
  IamInstanceDetail,
  IamTenantIamAxis,
  IamTenantIamStatus,
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
  status: NonNullable<IamInstanceDetail['keycloakStatus']>,
  options: { readonly requireTenantAdmin?: boolean } = {}
): IamTenantIamEvidenceClassification => {
  if (areAllInstanceKeycloakRequirementsSatisfied(status, options)) return 'ready';
  if (
    !status.realmExists ||
    !status.clientExists ||
    !status.tenantAdminClientExists ||
    !status.systemAdminRoleExists ||
    (options.requireTenantAdmin !== false && !status.tenantAdminExists)
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

type TenantIamEvidence = Omit<IamTenantIamAxis, 'source'> & {
  readonly source: IamTenantIamAxis['source'];
};

const isConfigurationReady = (
  keycloakStatus: NonNullable<IamInstanceDetail['keycloakStatus']> | undefined,
  requireTenantAdmin: boolean
): boolean =>
  Boolean(
    keycloakStatus &&
    areAllInstanceKeycloakRequirementsSatisfied(keycloakStatus, { requireTenantAdmin })
  );

const createTenantIamAxis = (input: TenantIamEvidence): IamTenantIamAxis => {
  const serviceIdentity = input.serviceIdentity ?? getTenantIamServiceIdentity(input.source);
  const classification = input.classification ?? classifyTenantIamAxis(input);
  return {
    status: input.status,
    summary: input.summary,
    source: input.source,
    ...(serviceIdentity ? { serviceIdentity } : {}),
    classification,
    ...(input.checkedAt ? { checkedAt: input.checkedAt } : {}),
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
  };
};

const tenantIamPrecedence: ReadonlyArray<IamTenantIamAxis['status']> = [
  'blocked',
  'degraded',
  'unknown',
  'ready',
];

export const buildTenantIamStatus = (input: {
  keycloakStatus?: IamInstanceDetail['keycloakStatus'];
  requireTenantAdmin?: boolean;
  accessEvidence?: TenantIamEvidence;
  reconcileEvidence?: TenantIamEvidence;
}): IamTenantIamStatus => {
  const requireTenantAdmin = input.requireTenantAdmin !== false;
  const configuration = input.keycloakStatus
    ? createTenantIamAxis({
        status: isConfigurationReady(input.keycloakStatus, requireTenantAdmin)
          ? 'ready'
          : 'degraded',
        summary: isConfigurationReady(input.keycloakStatus, requireTenantAdmin)
          ? 'Tenant-IAM-Struktur ist vollständig vorhanden.'
          : 'Tenant-IAM-Struktur ist unvollständig oder driftet.',
        source: 'keycloak_status_snapshot',
        classification: classifyTenantIamConfiguration(input.keycloakStatus, {
          requireTenantAdmin,
        }),
      })
    : createTenantIamAxis({
        status: 'unknown',
        summary: 'Noch kein Strukturstatus für Tenant-IAM vorhanden.',
        source: 'registry',
      });

  const access = input.accessEvidence
    ? createTenantIamAxis(input.accessEvidence)
    : createTenantIamAxis({
        status: 'unknown',
        summary: 'Noch keine tenantlokale Rechteprobe vorhanden.',
        source: 'access_probe',
      });

  const reconcile = input.reconcileEvidence
    ? createTenantIamAxis(input.reconcileEvidence)
    : createTenantIamAxis({
        status: 'unknown',
        summary: 'Noch kein Rollenabgleich ausgeführt.',
        source: 'role_reconcile',
      });

  const overallStatus =
    tenantIamPrecedence.find((candidate) =>
      [configuration.status, access.status, reconcile.status].includes(candidate)
    ) ?? 'unknown';

  const dominantAxis =
    overallStatus === configuration.status
      ? configuration
      : overallStatus === access.status
        ? access
        : overallStatus === reconcile.status
          ? reconcile
          : configuration;

  const overallSummary =
    overallStatus === 'ready'
      ? 'Tenant-IAM ist betriebsbereit.'
      : overallStatus === 'blocked'
        ? 'Tenant-IAM ist blockiert.'
        : overallStatus === 'degraded'
          ? 'Tenant-IAM ist eingeschränkt.'
          : 'Tenant-IAM-Befund ist unvollständig.';

  return {
    configuration,
    access,
    reconcile,
    overall: createTenantIamAxis({
      status: overallStatus,
      summary: overallSummary,
      source: overallStatus === 'unknown' ? 'registry' : dominantAxis.source,
      classification: dominantAxis.classification,
      checkedAt: dominantAxis.checkedAt,
      errorCode: dominantAxis.errorCode,
      requestId: dominantAxis.requestId,
      serviceIdentity: dominantAxis.serviceIdentity,
    }),
  };
};
