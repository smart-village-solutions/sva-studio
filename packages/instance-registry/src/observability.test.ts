import { describe, expect, it } from 'vitest';

import { classifyInstanceMutationError } from './mutation-errors.js';
import {
  annotateInstanceRegistryError,
  buildInstanceRegistryFailureLog,
  buildKeycloakPlanComparisonDiagnostics,
  buildKeycloakPlanLogFields,
  readInstanceRegistryStepKey,
  runInstanceRegistryStep,
} from './observability.js';

describe('instance registry observability', () => {
  it('allowlists PostgreSQL diagnostics and correlation fields', () => {
    const error = Object.assign(new Error('secret@example.test password=hunter2'), {
      code: '23505',
      table: 'instances',
      column: 'id',
      constraint: 'instances_pkey',
      detail: 'Key (email)=(secret@example.test) already exists',
      query: 'INSERT INTO iam.instances ...',
    });

    const log = buildInstanceRegistryFailureLog(
      error,
      {
        operation: 'create_instance',
        requestId: 'req-1',
        instanceId: 'demo',
        stepKey: 'registry_insert',
      },
      classifyInstanceMutationError(error)
    );

    expect(log).toMatchObject({
      operation: 'create_instance',
      result: 'failed',
      request_id: 'req-1',
      instance_id: 'demo',
      step_key: 'registry_insert',
      error_type: 'Error',
      error_code: '23505',
      database_table: 'instances',
      database_column: 'id',
      database_constraint: 'instances_pkey',
    });
    expect(JSON.stringify(log)).not.toContain('secret@example.test');
    expect(log).not.toHaveProperty('detail');
    expect(log).not.toHaveProperty('query');
  });

  it('never serializes raw provider diagnostics or secrets', () => {
    const fragments = [
      'admin@smart-village.app',
      'password=top-secret',
      'Bearer token-value',
      'postgres://user:password@database/internal',
      "VALUES ('private-value')",
    ];
    const error = Object.assign(new Error(fragments.join(' ')), {
      detail: fragments[0],
      hint: fragments[1],
      query: fragments[4],
      parameters: fragments,
      stack: fragments.join('\n'),
      code: '08006',
    });
    const serialized = JSON.stringify(
      buildInstanceRegistryFailureLog(
        error,
        {
          operation: 'create_instance',
          requestId: 'req-safe',
        },
        classifyInstanceMutationError(error)
      )
    );

    for (const fragment of fragments) expect(serialized).not.toContain(fragment);
  });

  it('keeps the concrete failure step without exposing it as an enumerable error field', async () => {
    const error = new Error('provider secret');
    await expect(
      runInstanceRegistryStep('audit_event_insert', async () => {
        throw error;
      })
    ).rejects.toBe(error);
    expect(readInstanceRegistryStepKey(error)).toBe('audit_event_insert');
    expect(JSON.stringify(error)).not.toContain('audit_event_insert');
  });

  it('uses the stable classification when no provider code exists', () => {
    expect(
      buildInstanceRegistryFailureLog(
        'boom',
        { operation: 'create_instance' },
        {
          status: 500,
          code: 'internal_unclassified',
        }
      )
    ).toMatchObject({
      operation: 'create_instance',
      result: 'failed',
      error: 'internal_unclassified',
      error_type: 'string',
      error_code: 'internal_unclassified',
      classification: 'internal_unclassified',
      http_status: 500,
    });
  });

  it('summarizes plans without exposing plan contents as log fields', () => {
    const fields = buildKeycloakPlanLogFields({
      contractVersion: '1.0',
      fingerprint: 'a'.repeat(64),
      mode: 'existing',
      overallStatus: 'ready',
      generatedAt: '2026-09-22T08:00:00.000Z',
      driftSummary: 'provider detail must stay out of logs',
      steps: [
        {
          stepKey: 'realm_baseline',
          title: 'Baseline',
          action: 'verify',
          status: 'ready',
          summary: 'internal summary',
          details: { applicable: true, providerPayload: 'private' },
        },
        {
          stepKey: 'client',
          title: 'Client',
          action: 'update',
          status: 'ready',
          summary: 'internal summary',
          details: { redirectUris: ['https://tenant.example.test/callback'] },
        },
      ],
    });

    expect(fields).toEqual({
      plan_status: 'ready',
      realm_mode: 'existing',
      plan_contract_version: '1.0',
      plan_fingerprint_prefix: 'aaaaaaaaaaaa',
      plan_action_create_count: 0,
      plan_action_update_count: 1,
      plan_action_verify_count: 1,
      plan_action_skip_count: 0,
      realm_baseline_applicable: true,
    });
    expect(JSON.stringify(fields)).not.toContain('provider detail');
    expect(JSON.stringify(fields)).not.toContain('tenant.example.test');
  });

  it('adds allowlisted plan comparison diagnostics to the canonical failure event only', () => {
    const plan = {
      contractVersion: '1.0' as const,
      fingerprint: 'b'.repeat(64),
      mode: 'new' as const,
      overallStatus: 'ready' as const,
      generatedAt: '2026-09-22T08:00:00.000Z',
      driftSummary: 'secret provider response',
      steps: [],
    };
    const error = annotateInstanceRegistryError(
      new Error('keycloak_plan_fingerprint_stale'),
      'worker_plan',
      buildKeycloakPlanComparisonDiagnostics({
        comparisonStage: 'worker_plan',
        expectedFingerprint: 'a'.repeat(64),
        actualPlan: plan,
      })
    );

    const log = buildInstanceRegistryFailureLog(
      error,
      { operation: 'process_keycloak_provisioning_run', instanceId: 'demo', runId: 'run-1' },
      { status: 500, code: 'KEYCLOAK_PLAN_STALE' }
    );

    expect(log).toMatchObject({
      step_key: 'worker_plan',
      comparison_stage: 'worker_plan',
      expected_plan_fingerprint_prefix: 'aaaaaaaaaaaa',
      actual_plan_fingerprint_prefix: 'bbbbbbbbbbbb',
      plan_status: 'ready',
      realm_mode: 'new',
      plan_action_create_count: 0,
      plan_action_update_count: 0,
    });
    expect(JSON.stringify(error)).not.toContain('comparison_stage');
    expect(JSON.stringify(log)).not.toContain('secret provider response');
  });
});
