import { describe, expect, it } from 'vitest';

import {
  createGuardrailCheckResult,
  runGuardrailReport,
  type GuardrailCheckDefinition,
} from '../../../scripts/ci/guardrail-report.ts';

describe('guardrail-report', () => {
  it('returns a stable JSON-friendly report shape', async () => {
    const report = await runGuardrailReport({
      runtimeProfile: 'studio',
      checks: [
        {
          id: 'guardrail-plugin-contract',
          run: async () =>
            createGuardrailCheckResult({
              id: 'guardrail-plugin-contract',
              status: 'ok',
              code: 'plugin_contract_ok',
              summary: 'Plugin-Vertrag ist sichtbar.',
            }),
        },
      ],
    });

    expect(report).toEqual({
      generatedAt: expect.any(String),
      runtimeProfile: 'studio',
      checks: [
        {
          id: 'guardrail-plugin-contract',
          status: 'ok',
          code: 'plugin_contract_ok',
          summary: 'Plugin-Vertrag ist sichtbar.',
          details: [],
          evidence: {},
          enforcementReady: false,
          wouldFailInEnforcement: false,
          affectedTargets: [],
          suggestedNextStep: null,
        },
      ],
    });
  });

  it('degrades subcheck failures to warn instead of throwing', async () => {
    const report = await runGuardrailReport({
      runtimeProfile: 'studio',
      checks: [
        {
          id: 'guardrail-architecture-drift',
          run: async () => {
            throw new Error('boom');
          },
        },
      ],
    });

    expect(report.checks).toEqual([
      {
        id: 'guardrail-architecture-drift',
        status: 'warn',
        code: 'guardrail_subcheck_failed',
        summary: 'Der report-only Guardrail-Check konnte nicht vollständig ausgewertet werden.',
        details: ['boom'],
        evidence: {
          error: 'boom',
        },
        enforcementReady: false,
        wouldFailInEnforcement: false,
        affectedTargets: ['guardrail-architecture-drift'],
        suggestedNextStep: 'Subcheck reparieren oder seine Vorbedingungen dokumentieren.',
      },
    ]);
  });

  it('preserves report-only warnings from individual checks', async () => {
    const checks: GuardrailCheckDefinition[] = [
      {
        id: 'guardrail-runtime-boot',
        run: async () =>
          createGuardrailCheckResult({
            id: 'guardrail-runtime-boot',
            status: 'warn',
            code: 'migration_head_visible_only',
            summary: 'Der erwartete Migrationsstand ist sichtbar, aber noch nicht erzwungen.',
            details: ['packages/data/migrations/0033_iam_instance_keycloak_provisioning_idempotency.sql'],
            evidence: {
              latestMigration: '0033_iam_instance_keycloak_provisioning_idempotency.sql',
            },
            wouldFailInEnforcement: true,
            affectedTargets: ['packages/data/migrations'],
            suggestedNextStep: 'Expliziten Drift-Vergleich vor Request-Annahme ergänzen.',
          }),
      },
    ];

    const report = await runGuardrailReport({
      runtimeProfile: 'studio',
      checks,
    });

    expect(report.checks[0]).toMatchObject({
      id: 'guardrail-runtime-boot',
      status: 'warn',
      wouldFailInEnforcement: true,
      affectedTargets: ['packages/data/migrations'],
    });
  });
});
