import type { IamTenantIamAxisStatus } from '@sva/core';
import type { PluginTenantReadinessReadModel } from '@sva/plugin-sdk';

import { t } from '../../../i18n';
import type {
  InstanceConfigurationAssessment,
  InstanceConfigurationIssue,
} from './-instances-shared-types';
import { translateConfigurationStatus } from './-instance-detail-shared';

export type RequiredPluginReadinessAssessment = {
  readonly status: IamTenantIamAxisStatus;
  readonly summary: string;
  readonly pluginIds: readonly string[];
};

export const evaluateRequiredPluginReadiness = (
  plugins: readonly PluginTenantReadinessReadModel[]
): RequiredPluginReadinessAssessment | null => {
  const requiredPlugins = plugins.filter(({ activationPolicy }) => activationPolicy === 'required');
  if (requiredPlugins.length === 0) return null;

  const pluginIds = requiredPlugins.map(({ pluginId }) => pluginId).sort((left, right) =>
    left.localeCompare(right, 'de')
  );
  const status: IamTenantIamAxisStatus = requiredPlugins.some(
    (plugin) =>
      plugin.accessState === 'suspended' ||
      plugin.evidenceState !== 'valid' ||
      plugin.status === 'pending' ||
      plugin.status === 'blocked'
  )
    ? 'blocked'
    : requiredPlugins.some(({ status: pluginStatus }) => pluginStatus === 'degraded')
      ? 'degraded'
      : 'ready';

  return {
    status,
    summary: t(`admin.instances.pluginReadiness.aggregate.${status}`, {
      plugins: pluginIds.join(', '),
    }),
    pluginIds,
  };
};

const toConfigurationIssue = (
  readiness: RequiredPluginReadinessAssessment,
  severity: InstanceConfigurationIssue['severity']
): InstanceConfigurationIssue => ({
  key: 'required_plugin_readiness',
  label: readiness.summary,
  severity,
});

export const includeRequiredPluginReadiness = (
  assessment: InstanceConfigurationAssessment,
  readiness: RequiredPluginReadinessAssessment | null
): InstanceConfigurationAssessment => {
  if (!readiness) return assessment;

  const totalRequirements = assessment.totalRequirements + 1;
  if (readiness.status === 'ready') {
    return {
      ...assessment,
      satisfiedRequirements: assessment.satisfiedRequirements + 1,
      totalRequirements,
    };
  }
  if (readiness.status === 'degraded') {
    return {
      ...assessment,
      overallStatus:
        assessment.overallStatus === 'complete' ? 'degraded' : assessment.overallStatus,
      statusLabel:
        assessment.overallStatus === 'complete'
          ? translateConfigurationStatus('degraded')
          : assessment.statusLabel,
      totalRequirements,
      warningIssues: [...assessment.warningIssues, toConfigurationIssue(readiness, 'warning')],
    };
  }

  const blockingIssues = [
    ...assessment.blockingIssues,
    toConfigurationIssue(readiness, 'blocking'),
  ];
  return {
    ...assessment,
    overallStatus: 'incomplete',
    title: t('admin.instances.configuration.summary.incomplete.title'),
    body: t('admin.instances.configuration.summary.incomplete.body', {
      count: blockingIssues.length,
    }),
    statusLabel: translateConfigurationStatus('incomplete'),
    totalRequirements,
    blockingIssues,
  };
};
