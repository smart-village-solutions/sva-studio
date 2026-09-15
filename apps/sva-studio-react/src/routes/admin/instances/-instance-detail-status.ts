import { t } from '../../../i18n';
import type { SelectedInstance } from './-instances-shared-types';

import {
  getApplicableInstanceKeycloakRequirements,
  isInstanceTenantAdminRequired,
  isInstanceKeycloakRequirementSatisfied,
  KEYCLOAK_STATUS_LABELS,
  type IamInstanceDetail,
} from './-instance-detail-shared';

export const getStatusGuidance = (instance: IamInstanceDetail) => {
  switch (instance.status) {
    case 'requested':
      return {
        title: t('admin.instances.guidance.requested.title'),
        body: t('admin.instances.guidance.requested.body'),
      };
    case 'validated':
      return {
        title: t('admin.instances.guidance.validated.title'),
        body: t('admin.instances.guidance.validated.body'),
      };
    case 'provisioning':
      return {
        title: t('admin.instances.guidance.provisioning.title'),
        body: t('admin.instances.guidance.provisioning.body'),
      };
    case 'active':
      return {
        title: t('admin.instances.guidance.active.title'),
        body: t('admin.instances.guidance.active.body'),
      };
    case 'failed':
      return {
        title: t('admin.instances.guidance.failed.title'),
        body: t('admin.instances.guidance.failed.body'),
      };
    case 'suspended':
      return {
        title: t('admin.instances.guidance.suspended.title'),
        body: t('admin.instances.guidance.suspended.body'),
      };
    case 'archived':
      return {
        title: t('admin.instances.guidance.archived.title'),
        body: t('admin.instances.guidance.archived.body'),
      };
  }
};

export const getKeycloakStatusEntries = (selectedInstance: SelectedInstance) => {
  const status = selectedInstance.keycloakStatus;
  if (!status) {
    return [];
  }
  const managedRealmBaseline =
    selectedInstance.realmMode === 'new' ||
    selectedInstance.keycloakProvisioningRuns?.some(
      (run) =>
        run.mode === 'new' &&
        run.overallStatus === 'succeeded' &&
        run.steps.some((step) => step.stepKey === 'realm_baseline' && step.status === 'done')
    ) === true;

  return [
    ...getApplicableInstanceKeycloakRequirements({
      requireTenantAdmin: isInstanceTenantAdminRequired(selectedInstance),
    }).map(
      (requirement) =>
        [
          KEYCLOAK_STATUS_LABELS[requirement.statusField],
          isInstanceKeycloakRequirementSatisfied(status, requirement),
        ] as const
    ),
    ['admin.instances.keycloakStatus.clientSecretConfigured', status.clientSecretConfigured],
    [
      'admin.instances.keycloakStatus.tenantClientSecretReadable',
      status.tenantClientSecretReadable,
    ],
    [
      'admin.instances.keycloakStatus.tenantAdminClientSecretConfigured',
      status.tenantAdminClientSecretConfigured,
    ],
    [
      'admin.instances.keycloakStatus.tenantAdminClientSecretReadable',
      status.tenantAdminClientSecretReadable,
    ],
    [
      'admin.instances.keycloakStatus.runtimeSecretSourceTenant',
      status.runtimeSecretSource === 'tenant',
    ],
    ...(!managedRealmBaseline || status.realmBaselineAligned === undefined
      ? []
      : [[KEYCLOAK_STATUS_LABELS.realmBaselineAligned, status.realmBaselineAligned] as const]),
    ...(!managedRealmBaseline || status.userProfileBaselineAligned === undefined
      ? []
      : [
          [
            KEYCLOAK_STATUS_LABELS.userProfileBaselineAligned,
            status.userProfileBaselineAligned,
          ] as const,
        ]),
    ...(!managedRealmBaseline || status.instanceIdMapperAligned === undefined
      ? []
      : [
          [KEYCLOAK_STATUS_LABELS.instanceIdMapperAligned, status.instanceIdMapperAligned] as const,
        ]),
    ...(!managedRealmBaseline || status.smtpPasswordConfigured === undefined
      ? []
      : [[KEYCLOAK_STATUS_LABELS.smtpPasswordConfigured, status.smtpPasswordConfigured] as const]),
  ] as const;
};
