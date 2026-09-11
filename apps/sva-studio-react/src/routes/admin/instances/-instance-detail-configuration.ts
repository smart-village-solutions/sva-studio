import {
  areAllInstanceKeycloakRequirementsSatisfied,
  getApplicableInstanceKeycloakRequirements,
  isInstanceTenantAdminRequired,
} from '@sva/core';

import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import type {
  InstanceConfigurationAssessment,
  InstanceConfigurationIssue,
} from './-instances-shared-types';
import {
  isInstanceKeycloakRequirementSatisfied,
  KEYCLOAK_STATUS_LABELS,
  translateConfigurationStatus,
  type IamInstanceDetail,
} from './-instance-detail-shared';

const isFinalKeycloakStateSatisfied = (instance: IamInstanceDetail) =>
  Boolean(
    instance.keycloakStatus &&
      areAllInstanceKeycloakRequirementsSatisfied(instance.keycloakStatus, {
        requireTenantAdmin: isInstanceTenantAdminRequired(instance),
      })
  );

export const evaluateInstanceConfiguration = (
  instance: IamInstanceDetail,
  mutationError: IamHttpError | null
): InstanceConfigurationAssessment => {
  const keycloakStatus = instance.keycloakStatus;
  const requirements = getApplicableInstanceKeycloakRequirements({
    requireTenantAdmin: isInstanceTenantAdminRequired(instance),
  });
  const keycloakUnavailable = mutationError?.code === 'keycloak_unavailable';
  const latestKeycloakRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];
  const hasTechnicalRun = Boolean(latestKeycloakRun);
  const hasBlockingTechnicalOutcome =
    latestKeycloakRun?.overallStatus === 'failed' || latestKeycloakRun?.overallStatus === 'succeeded';
  const failingRequirements = keycloakStatus
    ? requirements.filter(
        (requirement) => !isInstanceKeycloakRequirementSatisfied(keycloakStatus, requirement)
      )
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

  if (instance.realmMode === 'new' && !keycloakUnavailable && !hasBlockingTechnicalOutcome && !isFinalKeycloakStateSatisfied(instance)) {
    return {
      overallStatus: hasTechnicalRun ? 'degraded' : 'unknown',
      title: t('admin.instances.configuration.summary.expectedArtifacts.title'),
      body: hasTechnicalRun
        ? t('admin.instances.configuration.summary.expectedArtifacts.running')
        : t('admin.instances.configuration.summary.expectedArtifacts.pending'),
      statusLabel: translateConfigurationStatus(hasTechnicalRun ? 'degraded' : 'unknown'),
      satisfiedRequirements: keycloakStatus ? requirements.length - failingRequirements.length : 0,
      totalRequirements: requirements.length,
      blockingIssues: [],
      warningIssues,
    };
  }

  if (keycloakUnavailable || !keycloakStatus) {
    return {
      overallStatus: 'unknown',
      title: t('admin.instances.configuration.summary.unknown.title'),
      body: keycloakUnavailable
        ? t('admin.instances.configuration.summary.unknown.keycloakUnavailable')
        : t('admin.instances.configuration.summary.unknown.body'),
      statusLabel: translateConfigurationStatus('unknown'),
      satisfiedRequirements: keycloakStatus ? requirements.length - failingRequirements.length : 0,
      totalRequirements: requirements.length,
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
      satisfiedRequirements: requirements.length - blockingIssues.length,
      totalRequirements: requirements.length,
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
      satisfiedRequirements: requirements.length,
      totalRequirements: requirements.length,
      blockingIssues,
      warningIssues,
    };
  }

  return {
    overallStatus: 'complete',
    title: t('admin.instances.configuration.summary.complete.title'),
    body: t('admin.instances.configuration.summary.complete.body'),
    statusLabel: translateConfigurationStatus('complete'),
    satisfiedRequirements: requirements.length,
    totalRequirements: requirements.length,
    blockingIssues,
    warningIssues,
  };
};
