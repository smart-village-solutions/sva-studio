import {
  getApplicableInstanceKeycloakRequirements,
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  isInstanceTenantAdminRequired,
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
  getApplicableInstanceKeycloakRequirements,
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  isInstanceTenantAdminRequired,
  isInstanceKeycloakRequirementSatisfied,
  type IamInstanceDetail,
  type IamInstanceKeycloakPreflight,
  type IamTenantIamAxisStatus,
};

export type IamInstanceKeycloakStatus = NonNullable<IamInstanceDetail['keycloakStatus']>;
export type InstanceKeycloakStatusField = Exclude<
  keyof IamInstanceKeycloakStatus,
  'runtimeSecretSource'
>;

const CONFIGURATION_STATUS_LABELS = {
  complete: 'admin.instances.configuration.overall.complete',
  degraded: 'admin.instances.configuration.overall.degraded',
  incomplete: 'admin.instances.configuration.overall.incomplete',
  unknown: 'admin.instances.configuration.overall.unknown',
} as const satisfies Record<InstanceConfigurationOverallStatus, string>;

export const COCKPIT_STATUS_PRECEDENCE = [
  'blocked',
  'degraded',
  'unknown',
  'ready',
] as const satisfies readonly IamTenantIamAxisStatus[];
export const TENANT_IAM_STATUS_PRECEDENCE = [
  'blocked',
  'degraded',
  'unknown',
  'ready',
] as const satisfies readonly IamTenantIamAxisStatus[];

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
  pluginOidcClientsAligned: 'admin.instances.keycloakStatus.pluginOidcClientsAligned',
  clientSecretConfigured: 'admin.instances.keycloakStatus.clientSecretConfigured',
  tenantClientSecretReadable: 'admin.instances.keycloakStatus.tenantClientSecretReadable',
  clientSecretAligned: 'admin.instances.keycloakStatus.clientSecretAligned',
  tenantAdminClientSecretConfigured:
    'admin.instances.keycloakStatus.tenantAdminClientSecretConfigured',
  tenantAdminClientSecretReadable: 'admin.instances.keycloakStatus.tenantAdminClientSecretReadable',
  tenantAdminClientSecretAligned: 'admin.instances.keycloakStatus.tenantAdminClientSecretAligned',
  realmBaselineAligned: 'admin.instances.keycloakStatus.realmBaselineAligned',
  userProfileBaselineAligned: 'admin.instances.keycloakStatus.userProfileBaselineAligned',
  instanceIdMapperAligned: 'admin.instances.keycloakStatus.instanceIdMapperAligned',
  smtpPasswordConfigured: 'admin.instances.keycloakStatus.smtpPasswordConfigured',
} as const satisfies Record<InstanceKeycloakStatusField, string>;

export const findPreflightCheck = (
  preflight: IamInstanceKeycloakPreflight | undefined,
  checkKey: string
) => preflight?.checks.find((check) => check.checkKey === checkKey);

export const readPreflightCheckedAt = (preflight: IamInstanceKeycloakPreflight | undefined) =>
  preflight?.checkedAt;

export const readProvisioningRunTimestamp = (
  run: IamInstanceDetail['latestKeycloakProvisioningRun']
) => run?.updatedAt ?? run?.createdAt;

export const createWorkflowStep = (input: SetupWorkflowStep): SetupWorkflowStep => input;

export const translateConfigurationStatus = (status: InstanceConfigurationOverallStatus) =>
  t(CONFIGURATION_STATUS_LABELS[status]);

type LocalizableKeycloakStep = Readonly<{
  title: string;
  summary: string;
  details?: Readonly<Record<string, unknown>>;
}>;

const translateKeycloakStepField = (
  step: LocalizableKeycloakStep,
  key: 'titleKey' | 'summaryKey',
  fallback: string
): string => {
  const translationKey = step.details?.[key];
  if (typeof translationKey !== 'string') return fallback;
  const translated = t(translationKey);
  return translated === translationKey ? fallback : translated;
};

export const translateKeycloakStep = (step: LocalizableKeycloakStep) => ({
  title: translateKeycloakStepField(step, 'titleKey', step.title),
  summary: translateKeycloakStepField(step, 'summaryKey', step.summary),
});

export const readRequirementGroupSatisfied = (instance: IamInstanceDetail, uiStepKey: string) =>
  Boolean(
    instance.keycloakStatus &&
    getApplicableInstanceKeycloakRequirements({
      requireTenantAdmin: isInstanceTenantAdminRequired(instance),
    })
      .filter((requirement) => requirement.uiStepKey === uiStepKey)
      .every((requirement) =>
        isInstanceKeycloakRequirementSatisfied(instance.keycloakStatus!, requirement)
      )
  );
