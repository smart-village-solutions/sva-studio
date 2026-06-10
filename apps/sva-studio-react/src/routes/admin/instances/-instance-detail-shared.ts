import {
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  isInstanceKeycloakRequirementSatisfied,
  type IamInstanceDetail,
  type IamInstanceKeycloakPreflight,
  type IamTenantIamAxisStatus,
} from '@sva/core';

import { t } from '../../../i18n';
import type {
  InstanceConfigurationOverallStatus,
  SetupWorkflowStep,
} from './-instances-shared-types';

export {
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  isInstanceKeycloakRequirementSatisfied,
  type IamInstanceDetail,
  type IamInstanceKeycloakPreflight,
  type IamTenantIamAxisStatus,
};

export type IamInstanceKeycloakStatus = NonNullable<IamInstanceDetail['keycloakStatus']>;
export type InstanceKeycloakStatusField = Exclude<keyof IamInstanceKeycloakStatus, 'runtimeSecretSource'>;

const CONFIGURATION_STATUS_LABELS = {
  complete: 'admin.instances.configuration.overall.complete',
  degraded: 'admin.instances.configuration.overall.degraded',
  incomplete: 'admin.instances.configuration.overall.incomplete',
  unknown: 'admin.instances.configuration.overall.unknown',
} as const satisfies Record<InstanceConfigurationOverallStatus, string>;

export const COCKPIT_STATUS_PRECEDENCE = ['blocked', 'degraded', 'unknown', 'ready'] as const satisfies readonly IamTenantIamAxisStatus[];
export const TENANT_IAM_STATUS_PRECEDENCE = ['blocked', 'degraded', 'unknown', 'ready'] as const satisfies readonly IamTenantIamAxisStatus[];

export const TENANT_IAM_AXIS_LABELS = {
  configuration: 'admin.instances.cockpit.anomalies.configuration',
  access: 'admin.instances.cockpit.anomalies.access',
  reconcile: 'admin.instances.cockpit.anomalies.reconcile',
} as const;

export const KEYCLOAK_STATUS_LABELS = {
  realmExists: 'admin.instances.keycloakStatus.realmExists',
  clientExists: 'admin.instances.keycloakStatus.clientExists',
  tenantAdminClientExists: 'admin.instances.keycloakStatus.tenantAdminClientExists',
  tenantAdminExists: 'admin.instances.keycloakStatus.tenantAdminExists',
  tenantAdminHasSystemAdmin: 'admin.instances.keycloakStatus.tenantAdminHasSystemAdmin',
  systemAdminRoleExists: 'admin.instances.keycloakStatus.systemAdminRoleExists',
  redirectUrisMatch: 'admin.instances.keycloakStatus.redirectUrisMatch',
  logoutUrisMatch: 'admin.instances.keycloakStatus.logoutUrisMatch',
  webOriginsMatch: 'admin.instances.keycloakStatus.webOriginsMatch',
  clientSecretConfigured: 'admin.instances.keycloakStatus.clientSecretConfigured',
  tenantClientSecretReadable: 'admin.instances.keycloakStatus.tenantClientSecretReadable',
  clientSecretAligned: 'admin.instances.keycloakStatus.clientSecretAligned',
  tenantAdminClientSecretConfigured: 'admin.instances.keycloakStatus.tenantAdminClientSecretConfigured',
  tenantAdminClientSecretReadable: 'admin.instances.keycloakStatus.tenantAdminClientSecretReadable',
  tenantAdminClientSecretAligned: 'admin.instances.keycloakStatus.tenantAdminClientSecretAligned',
} as const satisfies Record<InstanceKeycloakStatusField, string>;

export const findPreflightCheck = (preflight: IamInstanceKeycloakPreflight | undefined, checkKey: string) =>
  preflight?.checks.find((check) => check.checkKey === checkKey);

export const readPreflightCheckedAt = (preflight: IamInstanceKeycloakPreflight | undefined) => preflight?.checkedAt;

export const readProvisioningRunTimestamp = (run: IamInstanceDetail['latestKeycloakProvisioningRun']) =>
  run?.updatedAt ?? run?.createdAt;

export const createWorkflowStep = (input: SetupWorkflowStep): SetupWorkflowStep => input;

export const translateConfigurationStatus = (status: InstanceConfigurationOverallStatus) =>
  t(CONFIGURATION_STATUS_LABELS[status]);

export const readRequirementGroupSatisfied = (
  keycloakStatus: IamInstanceKeycloakStatus | undefined,
  uiStepKey: string
) =>
  Boolean(
    keycloakStatus &&
      INSTANCE_KEYCLOAK_REQUIREMENTS.filter((requirement) => requirement.uiStepKey === uiStepKey).every((requirement) =>
        isInstanceKeycloakRequirementSatisfied(keycloakStatus, requirement)
      )
  );
