import { t } from '../../../i18n';
import type { IamTenantIamStatus } from '@sva/core';

import {
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  TENANT_IAM_STATUS_PRECEDENCE,
  isInstanceKeycloakRequirementSatisfied,
  type IamInstanceDetail,
  type IamTenantIamAxisStatus,
} from './-instance-detail-shared';

const buildTenantIamAxis = (
  status: IamTenantIamAxisStatus,
  summary: string,
  source: IamTenantIamStatus['overall']['source'],
  current?: Partial<IamTenantIamStatus['overall']>
): IamTenantIamStatus['overall'] => ({
  status,
  summary,
  source,
  ...(current?.checkedAt ? { checkedAt: current.checkedAt } : {}),
  ...(current?.errorCode ? { errorCode: current.errorCode } : {}),
  ...(current?.requestId ? { requestId: current.requestId } : {}),
});

export const getEffectiveTenantIamStatus = (instance: IamInstanceDetail): IamTenantIamStatus | undefined => {
  const current = instance.tenantIamStatus;
  const keycloakStatus = instance.keycloakStatus;
  if (!current) {
    return undefined;
  }

  const configurationStatus = keycloakStatus
    ? INSTANCE_KEYCLOAK_REQUIREMENTS.every((requirement) =>
        isInstanceKeycloakRequirementSatisfied(keycloakStatus, requirement)
      )
      ? 'ready'
      : 'degraded'
    : current.configuration.status;

  const configuration = keycloakStatus
    ? buildTenantIamAxis(
        configurationStatus,
        configurationStatus === 'ready'
          ? t('admin.instances.tenantIam.summaries.configurationReady')
          : t('admin.instances.tenantIam.summaries.configurationDegraded'),
        'keycloak_status_snapshot',
        current.configuration
      )
    : current.configuration;

  const access = current.access;
  const reconcile = current.reconcile;
  const overallStatus =
    TENANT_IAM_STATUS_PRECEDENCE.find((candidate) =>
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
      ? t('admin.instances.tenantIam.summaries.overallReady')
      : overallStatus === 'blocked'
        ? t('admin.instances.tenantIam.summaries.overallBlocked')
        : overallStatus === 'degraded'
          ? t('admin.instances.tenantIam.summaries.overallDegraded')
          : t('admin.instances.tenantIam.summaries.overallUnknown');

  return {
    configuration,
    access,
    reconcile,
    overall: buildTenantIamAxis(overallStatus, overallSummary, dominantAxis.source, dominantAxis),
  };
};
