import { describe, expect, it } from 'vitest';

import {
  evaluateRequiredPluginReadiness,
  includeRequiredPluginReadiness,
} from './-instance-required-plugin-readiness';
import type { InstanceConfigurationAssessment } from './-instances-shared-types';
import type { PluginTenantReadinessReadModel } from '@sva/plugin-sdk';

const createPlugin = (
  overrides: Partial<PluginTenantReadinessReadModel> = {}
): PluginTenantReadinessReadModel => ({
  pluginId: 'speech-flow',
  activationPolicy: 'required',
  effectiveActive: true,
  accessState: 'active',
  status: 'ready',
  evidenceState: 'valid',
  desiredGeneration: 1,
  completedGeneration: 1,
  checks: [],
  updatedAt: '2026-08-30T00:00:00.000Z',
  ...overrides,
});

const completeConfiguration: InstanceConfigurationAssessment = {
  overallStatus: 'complete',
  title: 'Vollständig',
  body: 'Konfiguration vollständig.',
  statusLabel: 'Vollständig',
  satisfiedRequirements: 4,
  totalRequirements: 4,
  blockingIssues: [],
  warningIssues: [],
};

describe('required plugin readiness aggregation', () => {
  it('blocks aggregate readiness while a required plugin has no valid evidence', () => {
    const readiness = evaluateRequiredPluginReadiness([
      createPlugin({ status: 'pending', evidenceState: 'missing' }),
      createPlugin({
        pluginId: 'optional-plugin',
        activationPolicy: 'optional',
        status: 'blocked',
      }),
    ]);

    expect(readiness).toMatchObject({ status: 'blocked', pluginIds: ['speech-flow'] });
    expect(includeRequiredPluginReadiness(completeConfiguration, readiness)).toMatchObject({
      overallStatus: 'incomplete',
      satisfiedRequirements: 4,
      totalRequirements: 5,
      blockingIssues: [{ key: 'required_plugin_readiness', severity: 'blocking' }],
    });
  });

  it('counts ready required plugins without letting optional plugins affect the aggregate', () => {
    const readiness = evaluateRequiredPluginReadiness([
      createPlugin(),
      createPlugin({
        pluginId: 'optional-plugin',
        activationPolicy: 'optional',
        status: 'blocked',
      }),
    ]);

    expect(readiness?.status).toBe('ready');
    expect(includeRequiredPluginReadiness(completeConfiguration, readiness)).toMatchObject({
      overallStatus: 'complete',
      satisfiedRequirements: 5,
      totalRequirements: 5,
    });
  });
});
