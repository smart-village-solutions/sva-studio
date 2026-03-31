import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  activeSpan: null as
    | null
    | {
        setAttributes: ReturnType<typeof vi.fn>;
        addEvent: ReturnType<typeof vi.fn>;
      },
}));

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: () => state.activeSpan,
  },
}));

import {
  addActiveSpanEvent,
  annotateActiveSpan,
  annotateApiErrorSpan,
  classifyIamDiagnosticError,
  createActorResolutionDetails,
} from './diagnostics';

describe('iam-account-management diagnostics helpers', () => {
  beforeEach(() => {
    state.activeSpan = {
      setAttributes: vi.fn(),
      addEvent: vi.fn(),
    };
  });

  it('sanitizes span attributes and drops unsupported values', () => {
    annotateActiveSpan({
      ok: true,
      count: 2,
      truncated: 'x'.repeat(300),
      unsupported: undefined,
      // @ts-expect-error branch coverage for runtime sanitization
      object_value: { nested: true },
    });

    expect(state.activeSpan?.setAttributes).toHaveBeenCalledWith({
      ok: true,
      count: 2,
      truncated: 'x'.repeat(256),
    });
  });

  it('adds sanitized span events and annotates api errors', () => {
    addActiveSpanEvent('iam.test', {
      dependency: 'database',
      // @ts-expect-error runtime sanitization
      ignored: { nested: true },
    });

    annotateApiErrorSpan({
      status: 503,
      code: 'database_unavailable',
      details: {
        dependency: 'database',
        reason_code: 'missing_table',
        schema_object: 'iam.groups',
      },
    });

    expect(state.activeSpan?.addEvent).toHaveBeenNthCalledWith(1, 'iam.test', {
      dependency: 'database',
    });
    expect(state.activeSpan?.setAttributes).toHaveBeenCalledWith({
      'iam.error_code': 'database_unavailable',
      'iam.reason_code': 'missing_table',
      'http.response.status_code': 503,
      'dependency.name': 'database',
      'db.schema_object': 'iam.groups',
    });
    expect(state.activeSpan?.addEvent).toHaveBeenNthCalledWith(2, 'iam.api_error', {
      'iam.error_code': 'database_unavailable',
      'iam.reason_code': 'missing_table',
      'http.response.status_code': 503,
    });
  });

  it('classifies schema drift and database policy violations deterministically', () => {
    expect(
      classifyIamDiagnosticError(
        { code: '42P01', message: 'relation "iam.groups" does not exist' },
        'fallback',
        'req-1'
      )
    ).toEqual({
      status: 503,
      code: 'database_unavailable',
      message: 'fallback',
      dependency: 'database',
      details: {
        request_id: 'req-1',
        schema_object: 'iam.groups',
        expected_migration: '0014_iam_groups.sql',
        dependency: 'database',
        reason_code: 'missing_table',
      },
    });

    expect(
      classifyIamDiagnosticError(
        {
          code: '23503',
          message: 'insert failed',
          table: 'iam.account_groups',
          constraint: 'account_groups_group_id_fkey',
        },
        'fallback'
      )
    ).toEqual({
      status: 500,
      code: 'internal_error',
      message: 'fallback',
      dependency: 'database',
      details: {
        schema_object: 'iam.account_groups',
        expected_migration: '0014_iam_groups.sql',
        constraint: 'account_groups_group_id_fkey',
        dependency: 'database',
        reason_code: 'foreign_key_violation',
      },
    });

    expect(
      classifyIamDiagnosticError(
        {
          code: '42501',
          message: 'permission denied for relation iam.accounts due to row-level security policy',
        },
        'fallback'
      ).details.reason_code
    ).toBe('rls_denied');
  });

  it('classifies encryption, bootstrap and fallback runtime errors', () => {
    expect(
      classifyIamDiagnosticError(new Error('pii_encryption_required: missing key'), 'fallback', 'req-2')
    ).toEqual({
      status: 503,
      code: 'internal_error',
      message: 'fallback',
      details: {
        request_id: 'req-2',
        reason_code: 'pii_encryption_missing',
      },
    });

    expect(classifyIamDiagnosticError(new Error('jit_provision_failed'), 'fallback').details.reason_code).toBe(
      'jit_provision_failed'
    );
    expect(
      classifyIamDiagnosticError(new Error('IAM database not configured'), 'fallback').details.reason_code
    ).toBe('database_not_configured');
    expect(classifyIamDiagnosticError(new Error('boom'), 'fallback', 'req-3').details.reason_code).toBe(
      'unexpected_internal_error'
    );
  });

  it('creates stable actor resolution details', () => {
    expect(
      createActorResolutionDetails({
        actorResolution: 'missing_actor_account',
        instanceId: 'de-musterhausen',
      })
    ).toEqual({
      actor_resolution: 'missing_actor_account',
      instance_id: 'de-musterhausen',
      reason_code: 'missing_actor_account',
    });
  });
});
