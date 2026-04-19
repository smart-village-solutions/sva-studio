import { describe, expect, it } from 'vitest';

import { deriveIamRuntimeDiagnostics } from './runtime-diagnostics.js';

describe('deriveIamRuntimeDiagnostics', () => {
  it('classifies tenant host and session diagnostics with safe details fallbacks', () => {
    expect(
      deriveIamRuntimeDiagnostics({
        code: 'invalid_request',
        status: 400,
        details: {
          reason_code: 'tenant_host_resolution_missing_registry_entry',
          instance_id: 'hb-test',
          return_to: '/account',
        },
      })
    ).toEqual({
      classification: 'tenant_host_validation',
      recommendedAction: 'erneut_versuchen',
      safeDetails: {
        instance_id: 'hb-test',
        reason_code: 'tenant_host_resolution_missing_registry_entry',
        return_to: '/account',
      },
      status: 'manuelle_pruefung_erforderlich',
    });

    expect(
      deriveIamRuntimeDiagnostics({
        code: 'reauth_required',
        status: 401,
        details: {
          reason_code: 'token_refresh_failed',
          return_to: '/admin/users',
        },
      })
    ).toEqual({
      classification: 'session_store_or_session_hydration',
      recommendedAction: 'erneut_anmelden',
      safeDetails: {
        reason_code: 'token_refresh_failed',
        return_to: '/admin/users',
      },
      status: 'recovery_laeuft',
    });
  });

  it('classifies actor resolution, keycloak dependency and provisioning drift errors', () => {
    expect(
      deriveIamRuntimeDiagnostics({
        code: 'forbidden',
        status: 403,
        details: {
          actor_resolution: 'missing_instance_membership',
        },
      })
    ).toEqual({
      classification: 'actor_resolution_or_membership',
      recommendedAction: 'manuell_pruefen',
      safeDetails: {
        actor_resolution: 'missing_instance_membership',
      },
      status: 'manuelle_pruefung_erforderlich',
    });

    expect(
      deriveIamRuntimeDiagnostics({
        code: 'keycloak_unavailable',
        status: 503,
        details: {
          dependency: 'keycloak',
          reason_code: 'keycloak_dependency_failed',
        },
      })
    ).toEqual({
      classification: 'keycloak_dependency',
      recommendedAction: 'keycloak_pruefen',
      safeDetails: {
        dependency: 'keycloak',
        reason_code: 'keycloak_dependency_failed',
      },
      status: 'degradiert',
    });

    expect(
      deriveIamRuntimeDiagnostics({
        code: 'tenant_admin_client_not_configured',
        status: 503,
        details: {
          instance_id: 'hb-demo',
        },
      })
    ).toEqual({
      classification: 'registry_or_provisioning_drift',
      recommendedAction: 'provisioning_pruefen',
      safeDetails: {
        instance_id: 'hb-demo',
      },
      status: 'degradiert',
    });
  });

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

  it('classifies database mapping inconsistencies and unknown failures', () => {
    expect(
      deriveIamRuntimeDiagnostics({
        code: 'internal_error',
        status: 500,
        details: {
          reason_code: 'jit_provision_failed',
          dependency: 'database',
        },
      })
    ).toEqual({
      classification: 'database_mapping_or_membership_inconsistency',
      recommendedAction: 'manuell_pruefen',
      safeDetails: {
        dependency: 'database',
        reason_code: 'jit_provision_failed',
      },
      status: 'degradiert',
    });

    expect(
      deriveIamRuntimeDiagnostics({
        code: 'internal_error',
        status: 500,
        details: {},
      })
    ).toEqual({
      classification: 'unknown',
      recommendedAction: 'support_kontaktieren',
      status: 'degradiert',
    });

    expect(
      deriveIamRuntimeDiagnostics({
        code: 'not_found',
        status: 404,
      })
    ).toEqual({
      classification: 'unknown',
      recommendedAction: 'erneut_versuchen',
      status: 'degradiert',
    });
  });
});
