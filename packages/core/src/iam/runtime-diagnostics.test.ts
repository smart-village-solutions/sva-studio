import { describe, expect, it } from 'vitest';

import { deriveIamRuntimeDiagnostics } from './runtime-diagnostics.js';

describe('deriveIamRuntimeDiagnostics', () => {
  it('classifies schema drift diagnostics from safe details', () => {
    expect(
      deriveIamRuntimeDiagnostics({
        code: 'database_unavailable',
        status: 503,
        details: {
          dependency: 'database',
          expected_migration: '0019_iam_account_groups_origin_compat.sql',
          reason_code: 'missing_column',
          schema_object: 'iam.account_groups.origin',
        },
      })
    ).toEqual({
      classification: 'database_or_schema_drift',
      recommendedAction: 'migration_pruefen',
      safeDetails: {
        dependency: 'database',
        expected_migration: '0019_iam_account_groups_origin_compat.sql',
        reason_code: 'missing_column',
        schema_object: 'iam.account_groups.origin',
      },
      status: 'degradiert',
    });
  });

  it('maps reconcile failures with sync codes into the dedicated classification', () => {
    expect(
      deriveIamRuntimeDiagnostics({
        code: 'keycloak_unavailable',
        status: 503,
        details: {
          syncError: {
            code: 'IDP_FORBIDDEN',
          },
          syncState: 'failed',
        },
      })
    ).toEqual({
      classification: 'keycloak_reconcile',
      recommendedAction: 'rollenabgleich_pruefen',
      safeDetails: {
        sync_error_code: 'IDP_FORBIDDEN',
        sync_state: 'failed',
      },
      status: 'manuelle_pruefung_erforderlich',
    });
  });
});
