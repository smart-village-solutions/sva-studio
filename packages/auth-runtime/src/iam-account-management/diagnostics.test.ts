import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  activeSpan: {
    addEvent: vi.fn(),
    setAttributes: vi.fn(),
  },
  IamSchemaDriftError: class IamSchemaDriftError extends Error {
    readonly cause?: unknown;
    readonly expectedMigration?: string;
    readonly operation: string;
    readonly schemaObject: string;

    constructor(input: {
      message: string;
      operation: string;
      schemaObject: string;
      expectedMigration?: string;
      cause?: unknown;
    }) {
      super(input.message);
      this.name = 'IamSchemaDriftError';
      this.operation = input.operation;
      this.schemaObject = input.schemaObject;
      this.expectedMigration = input.expectedMigration;
      if (input.cause !== undefined) {
        this.cause = input.cause;
      }
    }
  },
}));

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: () => state.activeSpan,
  },
}));

vi.mock('@sva/iam-admin', () => ({
  IamSchemaDriftError: state.IamSchemaDriftError,
}));

describe('IAM diagnostics helpers', () => {
  beforeEach(() => {
    state.activeSpan.addEvent.mockReset();
    state.activeSpan.setAttributes.mockReset();
  });

  it('annotates active spans with sanitized attributes and events', async () => {
    const { annotateActiveSpan, addActiveSpanEvent } = await import('./diagnostics.js');

    annotateActiveSpan({
      shortText: 'ok',
      longText: 'x'.repeat(400),
      boolValue: true,
      numericValue: 42,
      objectValue: { ignored: true },
    });
    addActiveSpanEvent('iam.test', {
      stringValue: 'event',
      invalid: ['ignored'],
    });

    expect(state.activeSpan.setAttributes).toHaveBeenCalledWith({
      shortText: 'ok',
      longText: 'x'.repeat(256),
      boolValue: true,
      numericValue: 42,
    });
    expect(state.activeSpan.addEvent).toHaveBeenCalledWith('iam.test', {
      stringValue: 'event',
    });
  });

  it('classifies schema drift and postgres migration errors', async () => {
    const { classifyIamDiagnosticError } = await import('./diagnostics.js');

    const drift = classifyIamDiagnosticError(
      new state.IamSchemaDriftError({
        message: 'missing schema',
        operation: 'load_users',
        schemaObject: 'iam.accounts.username_ciphertext',
        expectedMigration: '0011_iam_account_username.sql',
      }),
      'Fallback',
      'req-1'
    );
    const missingTable = classifyIamDiagnosticError(
      {
        code: '42P01',
        message: 'relation "iam.group_roles" does not exist',
      },
      'Fallback',
      'req-2'
    );
    const missingColumn = classifyIamDiagnosticError(
      {
        code: '42703',
        table: 'iam.accounts',
        column: 'preferred_language',
        message: 'column missing',
      },
      'Fallback'
    );

    expect(drift).toMatchObject({
      status: 503,
      code: 'database_unavailable',
      details: expect.objectContaining({
        request_id: 'req-1',
        reason_code: 'schema_drift',
        schema_object: 'iam.accounts.username_ciphertext',
        expected_migration: '0011_iam_account_username.sql',
      }),
    });
    expect(missingTable).toMatchObject({
      status: 503,
      code: 'database_unavailable',
      details: expect.objectContaining({
        request_id: 'req-2',
        reason_code: 'missing_table',
        schema_object: 'iam.group_roles',
        expected_migration: '0014_iam_groups.sql',
      }),
    });
    expect(missingColumn).toMatchObject({
      status: 500,
      code: 'internal_error',
      details: expect.objectContaining({
        reason_code: 'missing_column',
        schema_object: 'iam.accounts.preferred_language',
        expected_migration: '0004_iam_account_profile.sql',
      }),
    });
  });

  it('classifies constraint, RLS and encryption failures', async () => {
    const { classifyIamDiagnosticError } = await import('./diagnostics.js');

    const foreignKey = classifyIamDiagnosticError(
      {
        code: '23503',
        constraint: 'fk_account_group',
        message: 'fk violation',
      },
      'Fallback'
    );
    const rlsDenied = classifyIamDiagnosticError(
      {
        code: '42501',
        message: 'permission denied by row-level security policy',
      },
      'Fallback'
    );
    const encryptionRequired = classifyIamDiagnosticError(
      {
        message: 'pii_encryption_required: missing key',
      },
      'Fallback'
    );

    expect(foreignKey).toMatchObject({
      status: 500,
      code: 'internal_error',
      dependency: 'database',
      details: expect.objectContaining({
        reason_code: 'foreign_key_violation',
        constraint: 'fk_account_group',
      }),
    });
    expect(rlsDenied).toMatchObject({
      status: 500,
      code: 'internal_error',
      dependency: 'database',
      details: expect.objectContaining({
        reason_code: 'rls_denied',
      }),
    });
    expect(encryptionRequired).toMatchObject({
      status: 503,
      code: 'internal_error',
      details: expect.objectContaining({
        reason_code: 'pii_encryption_missing',
      }),
    });
  });

  it('classifies JIT provisioning, DB config and unexpected failures', async () => {
    const { classifyIamDiagnosticError, annotateApiErrorSpan, createActorResolutionDetails } = await import('./diagnostics.js');

    const jitError = classifyIamDiagnosticError({ message: 'jit_provision_failed' }, 'Fallback');
    const dbConfigError = classifyIamDiagnosticError({ message: 'IAM database not configured' }, 'Fallback', 'req-9');
    const fallbackError = classifyIamDiagnosticError(new Error('boom'), 'Fallback');

    annotateApiErrorSpan({
      status: 503,
      code: 'database_unavailable',
      details: {
        reason_code: 'database_not_configured',
        dependency: 'database',
        schema_object: 'iam.accounts',
      },
    });

    expect(jitError).toMatchObject({
      status: 500,
      code: 'internal_error',
      details: expect.objectContaining({
        reason_code: 'jit_provision_failed',
      }),
    });
    expect(dbConfigError).toMatchObject({
      status: 503,
      code: 'database_unavailable',
      details: expect.objectContaining({
        request_id: 'req-9',
        reason_code: 'database_not_configured',
      }),
    });
    expect(fallbackError).toMatchObject({
      status: 500,
      code: 'internal_error',
      details: expect.objectContaining({
        reason_code: 'unexpected_internal_error',
      }),
    });
    expect(createActorResolutionDetails({
      actorResolution: 'missing_actor_account',
      instanceId: 'tenant-a',
    })).toEqual({
      actor_resolution: 'missing_actor_account',
      instance_id: 'tenant-a',
      reason_code: 'missing_actor_account',
    });
    expect(state.activeSpan.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'iam.error_code': 'database_unavailable',
        'iam.reason_code': 'database_not_configured',
        'http.response.status_code': 503,
        'dependency.name': 'database',
        'db.schema_object': 'iam.accounts',
      })
    );
  });
});
