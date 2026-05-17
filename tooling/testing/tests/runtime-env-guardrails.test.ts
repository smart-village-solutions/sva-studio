import { describe, expect, it } from 'vitest';

import { buildGuardrailDoctorChecks } from '../../../scripts/ops/runtime-env.ts';
import type { GuardrailReport } from '../../../scripts/ci/guardrail-report.ts';

describe('runtime-env guardrails', () => {
  it('maps report-only guardrail findings to warn/ok/skipped doctor checks', async () => {
    const report: GuardrailReport = {
      generatedAt: '2026-05-16T09:00:00.000Z',
      runtimeProfile: 'studio',
      checks: [
        {
          id: 'guardrail-plugin-contract',
          status: 'warn',
          code: 'plugin_contract_collision_visible',
          summary: 'Plugin-Kollisionen sind sichtbar.',
          details: ['news -> /plugins/news'],
          evidence: {
            collisions: ['news'],
          },
          enforcementReady: false,
          wouldFailInEnforcement: true,
          affectedTargets: ['packages/plugin-news'],
          suggestedNextStep: 'Preflight-Validierung scharf schalten.',
        },
        {
          id: 'guardrail-runtime-boot',
          status: 'ok',
          code: 'runtime_boot_visible',
          summary: 'Runtime-Boot-Signale sind sichtbar.',
          details: [],
          evidence: {},
          enforcementReady: false,
          wouldFailInEnforcement: false,
          affectedTargets: [],
          suggestedNextStep: null,
        },
        {
          id: 'guardrail-cache-contract',
          status: 'skipped',
          code: 'cache_contract_not_applicable',
          summary: 'Cache-Vertrag ist fuer dieses Profil nicht relevant.',
          details: [],
          evidence: {},
          enforcementReady: false,
          wouldFailInEnforcement: false,
          affectedTargets: [],
          suggestedNextStep: null,
        },
      ],
    };

    const checks = await buildGuardrailDoctorChecks('studio', {
      runGuardrailReport: async () => report,
    });

    expect(checks).toEqual([
      expect.objectContaining({
        name: 'guardrail-plugin-contract',
        status: 'warn',
        code: 'plugin_contract_collision_visible',
      }),
      expect.objectContaining({
        name: 'guardrail-runtime-boot',
        status: 'ok',
        code: 'runtime_boot_visible',
      }),
      expect.objectContaining({
        name: 'guardrail-cache-contract',
        status: 'skipped',
        code: 'cache_contract_not_applicable',
      }),
    ]);
    expect(checks[0]?.details).toMatchObject({
      affectedTargets: ['packages/plugin-news'],
      wouldFailInEnforcement: true,
    });
  });

  it('returns warnings instead of throwing when the runner fails technically', async () => {
    const checks = await buildGuardrailDoctorChecks('studio', {
      runGuardrailReport: async () => {
        throw new Error('runner exploded');
      },
    });

    expect(checks).toHaveLength(5);
    expect(checks.every((check) => check.status === 'warn')).toBe(true);
    expect(checks.map((check) => check.name)).toEqual([
      'guardrail-plugin-contract',
      'guardrail-architecture-drift',
      'guardrail-runtime-boot',
      'guardrail-auth-session',
      'guardrail-cache-contract',
    ]);
  });
});
