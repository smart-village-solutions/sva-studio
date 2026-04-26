import { describe, expect, it } from 'vitest';

import { deriveIamRuntimeDiagnostics } from './runtime-diagnostics.js';

describe('deriveIamRuntimeDiagnostics', () => {
  it('classifies auth, OIDC, frontend staleness and legacy workaround diagnostics', () => {
    expect(
      deriveIamRuntimeDiagnostics({
        code: 'internal_error',
        status: 500,
        details: {
          reason_code: 'auth_config_missing',
        },
      })
    ).toEqual({
      classification: 'auth_resolution',
      recommendedAction: 'erneut_anmelden',
      safeDetails: {
        reason_code: 'auth_config_missing',
      },
      status: 'degradiert',
    });

    expect(
      deriveIamRuntimeDiagnostics({
        code: 'unauthorized',
        status: 401,
        details: {
          reason_code: 'oidc_exchange_failed',
        },
      })
    ).toEqual({
      classification: 'oidc_discovery_or_exchange',
      recommendedAction: 'erneut_anmelden',
      safeDetails: {
        reason_code: 'oidc_exchange_failed',
      },
      status: 'recovery_laeuft',
    });

    expect(
      deriveIamRuntimeDiagnostics({
        code: 'conflict',
        status: 409,
        details: {
          reason_code: 'permission_snapshot_stale',
        },
      })
    ).toEqual({
      classification: 'frontend_state_or_permission_staleness',
      recommendedAction: 'erneut_versuchen',
      safeDetails: {
        reason_code: 'permission_snapshot_stale',
      },
      status: 'manuelle_pruefung_erforderlich',
    });

    expect(
      deriveIamRuntimeDiagnostics({
        code: 'internal_error',
        status: 500,
        details: {
          reason_code: 'tenant_host_resolution_primary_hostname_fallback',
        },
      })
    ).toEqual({
      classification: 'legacy_workaround_or_regression',
      recommendedAction: 'manuell_pruefen',
      safeDetails: {
        reason_code: 'tenant_host_resolution_primary_hostname_fallback',
      },
      status: 'degradiert',
    });
  });

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

    expect(
      deriveIamRuntimeDiagnostics({
        code: 'forbidden',
        status: 403,
        details: {
          reason_code: 'tenant_inactive',
          instance_id: 'hb-demo',
        },
      })
    ).toEqual({
      classification: 'registry_or_provisioning_drift',
      recommendedAction: 'provisioning_pruefen',
      safeDetails: {
        instance_id: 'hb-demo',
        reason_code: 'tenant_inactive',
      },
      status: 'manuelle_pruefung_erforderlich',
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

  it('prioritizes provisioning drift blockers over reconcile sync metadata', () => {
    expect(
      deriveIamRuntimeDiagnostics({
        code: 'tenant_admin_client_not_configured',
        status: 409,
        details: {
          reason_code: 'registry_or_provisioning_drift_blocked',
          syncError: {
            code: 'DRIFT_BLOCKED',
          },
          syncState: 'failed',
        },
      })
    ).toEqual({
      classification: 'registry_or_provisioning_drift',
      recommendedAction: 'provisioning_pruefen',
      safeDetails: {
        reason_code: 'registry_or_provisioning_drift_blocked',
        sync_error_code: 'DRIFT_BLOCKED',
        sync_state: 'failed',
      },
      status: 'degradiert',
    });
  });

  it('accepts snake_case reconcile details and keeps DB write failures out of reconcile classification', () => {
    expect(
      deriveIamRuntimeDiagnostics({
        code: 'keycloak_unavailable',
        status: 503,
        details: {
          sync_error_code: 'IDP_FORBIDDEN',
          sync_state: 'failed',
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

    expect(
      deriveIamRuntimeDiagnostics({
        code: 'keycloak_unavailable',
        status: 503,
        details: {
          syncErrorCode: 'DB_WRITE_FAILED',
          syncState: 'failed',
        },
      })
    ).toEqual({
      classification: 'database_mapping_or_membership_inconsistency',
      recommendedAction: 'manuell_pruefen',
      safeDetails: {
        sync_error_code: 'DB_WRITE_FAILED',
        sync_state: 'failed',
      },
      status: 'degradiert',
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
        code: 'unauthorized',
        status: 401,
        details: {
          reason_code: 'missing_session_instance_id',
        },
      })
    ).toEqual({
      classification: 'session_store_or_session_hydration',
      recommendedAction: 'erneut_anmelden',
      safeDetails: {
        reason_code: 'missing_session_instance_id',
      },
      status: 'recovery_laeuft',
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
