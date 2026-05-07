import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import type {
  InstanceConfigurationAssessment,
  InstanceConfigurationIssue,
} from './-instances-shared-types';
import {
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  isInstanceKeycloakRequirementSatisfied,
  KEYCLOAK_STATUS_LABELS,
  translateConfigurationStatus,
  type IamInstanceDetail,
} from './-instance-detail-shared';

export const evaluateInstanceConfiguration = (
  instance: IamInstanceDetail,
  mutationError: IamHttpError | null
): InstanceConfigurationAssessment => {
  const keycloakStatus = instance.keycloakStatus;
  const keycloakUnavailable = mutationError?.code === 'keycloak_unavailable';
  const failingRequirements = keycloakStatus
    ? INSTANCE_KEYCLOAK_REQUIREMENTS.filter((requirement) => !isInstanceKeycloakRequirementSatisfied(keycloakStatus, requirement))
    : [];
  const warningIssues: InstanceConfigurationIssue[] =
    keycloakStatus && keycloakStatus.runtimeSecretSource !== 'tenant'
      ? [
          {
            key: 'runtime_secret_source',
            label: t('admin.instances.keycloakStatus.runtimeSecretSourceTenant'),
            severity: 'warning',
          },
        ]
      : [];
  const blockingIssues: InstanceConfigurationIssue[] = failingRequirements.map((requirement) => ({
    key: requirement.key,
    label: t(KEYCLOAK_STATUS_LABELS[requirement.statusField]),
    severity: 'blocking',
  }));

  if (keycloakUnavailable || !keycloakStatus) {
    return {
      overallStatus: 'unknown',
      title: t('admin.instances.configuration.summary.unknown.title'),
      body: keycloakUnavailable
        ? t('admin.instances.configuration.summary.unknown.keycloakUnavailable')
        : t('admin.instances.configuration.summary.unknown.body'),
      statusLabel: translateConfigurationStatus('unknown'),
      satisfiedRequirements: keycloakStatus ? INSTANCE_KEYCLOAK_REQUIREMENTS.length - failingRequirements.length : 0,
      totalRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
      blockingIssues,
      warningIssues,
    };
  }

  if (blockingIssues.length > 0) {
    return {
      overallStatus: 'incomplete',
      title: t('admin.instances.configuration.summary.incomplete.title'),
      body: t('admin.instances.configuration.summary.incomplete.body', {
        count: blockingIssues.length,
      }),
      statusLabel: translateConfigurationStatus('incomplete'),
      satisfiedRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length - blockingIssues.length,
      totalRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
      blockingIssues,
      warningIssues,
    };
  }

  if (warningIssues.length > 0) {
    return {
      overallStatus: 'degraded',
      title: t('admin.instances.configuration.summary.degraded.title'),
      body: t('admin.instances.configuration.summary.degraded.body'),
      statusLabel: translateConfigurationStatus('degraded'),
      satisfiedRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
      totalRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
      blockingIssues,
      warningIssues,
    };
  }

  return {
    overallStatus: 'complete',
    title: t('admin.instances.configuration.summary.complete.title'),
    body: t('admin.instances.configuration.summary.complete.body'),
    statusLabel: translateConfigurationStatus('complete'),
    satisfiedRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
    totalRequirements: INSTANCE_KEYCLOAK_REQUIREMENTS.length,
    blockingIssues,
    warningIssues,
  };
};
