import { describe, expect, it } from 'vitest';

import type {
  IamRuntimeDiagnosticClassification,
  IamRuntimeDiagnostics,
  IamRuntimeRecommendedAction,
} from './account-management-contract.js';
import { deriveIamRuntimeDiagnostics } from './runtime-diagnostics.js';

type DiagnosticInput = Parameters<typeof deriveIamRuntimeDiagnostics>[0];

type DiagnosticCase = Readonly<{
  name: string;
  input: DiagnosticInput;
  expected: IamRuntimeDiagnostics;
}>;

const classificationCases: readonly DiagnosticCase[] = [
  {
    name: 'auth resolution',
    input: {
      code: 'internal_error',
      status: 500,
      details: { reason_code: 'auth_resolution_failed' },
    },
    expected: {
      classification: 'auth_resolution',
      recommendedAction: 'erneut_anmelden',
      safeDetails: { reason_code: 'auth_resolution_failed' },
      status: 'degradiert',
    },
  },
  {
    name: 'OIDC discovery or exchange',
    input: {
      code: 'internal_error',
      status: 502,
      details: { reason_code: 'oidc_discovery_failed' },
    },
    expected: {
      classification: 'oidc_discovery_or_exchange',
      recommendedAction: 'erneut_anmelden',
      safeDetails: { reason_code: 'oidc_discovery_failed' },
      status: 'degradiert',
    },
  },
  {
    name: 'tenant host validation',
    input: {
      code: 'invalid_request',
      status: 400,
      details: { reason_code: 'tenant_host_invalid' },
    },
    expected: {
      classification: 'tenant_host_validation',
      recommendedAction: 'erneut_versuchen',
      safeDetails: { reason_code: 'tenant_host_invalid' },
      status: 'manuelle_pruefung_erforderlich',
    },
  },
  {
    name: 'session store or hydration',
    input: {
      code: 'reauth_required',
      status: 401,
      details: { reason_code: 'session_store_unavailable' },
    },
    expected: {
      classification: 'session_store_or_session_hydration',
      recommendedAction: 'erneut_anmelden',
      safeDetails: { reason_code: 'session_store_unavailable' },
      status: 'recovery_laeuft',
    },
  },
  {
    name: 'actor resolution or membership',
    input: {
      code: 'forbidden',
      status: 403,
      details: { actor_resolution: 'missing_actor_account' },
    },
    expected: {
      classification: 'actor_resolution_or_membership',
      recommendedAction: 'manuell_pruefen',
      safeDetails: { actor_resolution: 'missing_actor_account' },
      status: 'manuelle_pruefung_erforderlich',
    },
  },
  {
    name: 'Keycloak dependency',
    input: { code: 'keycloak_unavailable', status: 503 },
    expected: {
      classification: 'keycloak_dependency',
      recommendedAction: 'keycloak_pruefen',
      status: 'degradiert',
    },
  },
  {
    name: 'database or schema drift',
    input: {
      code: 'database_unavailable',
      status: 503,
      details: { reason_code: 'schema_drift' },
    },
    expected: {
      classification: 'database_or_schema_drift',
      recommendedAction: 'migration_pruefen',
      safeDetails: { reason_code: 'schema_drift' },
      status: 'degradiert',
    },
  },
  {
    name: 'database mapping or membership inconsistency',
    input: {
      code: 'internal_error',
      status: 500,
      details: { reason_code: 'foreign_key_violation' },
    },
    expected: {
      classification: 'database_mapping_or_membership_inconsistency',
      recommendedAction: 'manuell_pruefen',
      safeDetails: { reason_code: 'foreign_key_violation' },
      status: 'degradiert',
    },
  },
  {
    name: 'registry or provisioning drift',
    input: { code: 'mainserver_credentials_missing', status: 503 },
    expected: {
      classification: 'registry_or_provisioning_drift',
      recommendedAction: 'provisioning_pruefen',
      status: 'degradiert',
    },
  },
  {
    name: 'Keycloak reconcile',
    input: {
      code: 'internal_error',
      status: 500,
      details: { sync_state: 'failed' },
    },
    expected: {
      classification: 'keycloak_reconcile',
      recommendedAction: 'rollenabgleich_pruefen',
      safeDetails: { sync_state: 'failed' },
      status: 'manuelle_pruefung_erforderlich',
    },
  },
  {
    name: 'frontend state or permission staleness',
    input: {
      code: 'conflict',
      status: 409,
      details: { reason_code: 'frontend_state_stale' },
    },
    expected: {
      classification: 'frontend_state_or_permission_staleness',
      recommendedAction: 'erneut_versuchen',
      safeDetails: { reason_code: 'frontend_state_stale' },
      status: 'manuelle_pruefung_erforderlich',
    },
  },
  {
    name: 'legacy workaround or regression',
    input: {
      code: 'internal_error',
      status: 500,
      details: { reason_code: 'legacy_workaround' },
    },
    expected: {
      classification: 'legacy_workaround_or_regression',
      recommendedAction: 'manuell_pruefen',
      safeDetails: { reason_code: 'legacy_workaround' },
      status: 'degradiert',
    },
  },
  {
    name: 'unknown client error',
    input: { code: 'not_found', status: 404 },
    expected: {
      classification: 'unknown',
      recommendedAction: 'erneut_versuchen',
      status: 'degradiert',
    },
  },
  {
    name: 'unknown server error',
    input: { code: 'internal_error', status: 500 },
    expected: {
      classification: 'unknown',
      recommendedAction: 'support_kontaktieren',
      status: 'degradiert',
    },
  },
];

const priorityCases: readonly Readonly<{
  name: string;
  input: DiagnosticInput;
  classification: IamRuntimeDiagnosticClassification;
  recommendedAction: IamRuntimeRecommendedAction;
}>[] = [
  {
    name: 'pre-sync reason before DB-write sync signal',
    input: {
      code: 'internal_error',
      status: 500,
      details: {
        reason_code: 'auth_config_missing',
        sync_error_code: 'DB_WRITE_FAILED',
        sync_state: 'failed',
      },
    },
    classification: 'auth_resolution',
    recommendedAction: 'erneut_anmelden',
  },
  {
    name: 'sync signal before post-sync reason',
    input: {
      code: 'internal_error',
      status: 500,
      details: {
        reason_code: 'tenant_inactive',
        sync_error_code: 'IDP_FORBIDDEN',
      },
    },
    classification: 'keycloak_reconcile',
    recommendedAction: 'rollenabgleich_pruefen',
  },
  {
    name: 'session input before Keycloak reason',
    input: {
      code: 'unauthorized',
      status: 401,
      details: { reason_code: 'keycloak_dependency_failed' },
    },
    classification: 'session_store_or_session_hydration',
    recommendedAction: 'erneut_anmelden',
  },
  {
    name: 'session reason before database input',
    input: {
      code: 'database_unavailable',
      status: 503,
      details: { reason_code: 'session_expired' },
    },
    classification: 'session_store_or_session_hydration',
    recommendedAction: 'erneut_versuchen',
  },
  {
    name: 'actor detail before Keycloak reason',
    input: {
      code: 'internal_error',
      status: 500,
      details: {
        actor_resolution: 'missing_instance_membership',
        reason_code: 'keycloak_unavailable',
      },
    },
    classification: 'actor_resolution_or_membership',
    recommendedAction: 'manuell_pruefen',
  },
  {
    name: 'actor reason before database input',
    input: {
      code: 'database_unavailable',
      status: 503,
      details: { reason_code: 'missing_actor_account' },
    },
    classification: 'actor_resolution_or_membership',
    recommendedAction: 'manuell_pruefen',
  },
  {
    name: 'database input before mapping reason',
    input: {
      code: 'database_unavailable',
      status: 503,
      details: { reason_code: 'jit_provision_failed' },
    },
    classification: 'database_or_schema_drift',
    recommendedAction: 'migration_pruefen',
  },
  {
    name: 'database reason before registry input fallback',
    input: {
      code: 'mainserver_provisioning_failed',
      status: 503,
      details: { reason_code: 'missing_table' },
    },
    classification: 'database_or_schema_drift',
    recommendedAction: 'migration_pruefen',
  },
];

describe('deriveIamRuntimeDiagnostics', () => {
  it.each(classificationCases)('preserves $name classification and action', ({ input, expected }) => {
    expect(deriveIamRuntimeDiagnostics(input)).toEqual(expected);
  });

  it.each(priorityCases)(
    'preserves $name priority',
    ({ input, classification, recommendedAction }) => {
      expect(deriveIamRuntimeDiagnostics(input)).toMatchObject({
        classification,
        recommendedAction,
      });
    }
  );

  it.each([
    {
      name: 'snake_case fields',
      details: { sync_error_code: 'IDP_FORBIDDEN', sync_state: 'failed' },
    },
    {
      name: 'camelCase fields',
      details: { syncErrorCode: 'IDP_FORBIDDEN', syncState: 'failed' },
    },
    {
      name: 'nested camelCase sync error',
      details: { syncError: { code: 'IDP_FORBIDDEN' }, syncState: 'failed' },
    },
  ])('normalizes $name sync details', ({ details }) => {
    expect(
      deriveIamRuntimeDiagnostics({ code: 'internal_error', status: 500, details })
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

  it('keeps unsafe and non-string detail values outside the public contract', () => {
    expect(
      deriveIamRuntimeDiagnostics({
        code: 'internal_error',
        status: 500,
        details: {
          reason_code: 'schema_drift',
          dependency: 'database',
          token: 'secret-token',
          client_secret: 'secret-value',
          session_id: 'private-session',
          stacktrace: 'private-stacktrace',
          instance_id: 42,
          syncError: {
            raw: 'private-provider-error',
          },
        },
      })
    ).toEqual({
      classification: 'database_or_schema_drift',
      recommendedAction: 'migration_pruefen',
      safeDetails: {
        dependency: 'database',
        reason_code: 'schema_drift',
      },
      status: 'degradiert',
    });
  });

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

    expect(
      deriveIamRuntimeDiagnostics({
        code: 'unauthorized',
        status: 401,
        details: {
          reason_code: 'silent_recovery_timeout',
          auth_flow_id: 'flow-1',
          recovery_step: 'iframe_timeout',
        },
      })
    ).toEqual({
      classification: 'oidc_discovery_or_exchange',
      recommendedAction: 'erneut_anmelden',
      safeDetails: {
        auth_flow_id: 'flow-1',
        reason_code: 'silent_recovery_timeout',
        recovery_step: 'iframe_timeout',
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
        code: 'mainserver_provisioning_failed',
        status: 502,
        details: {
          dependency: 'sva_mainserver',
          reason_code: 'mainserver_upstream_failure',
        },
      })
    ).toEqual({
      classification: 'registry_or_provisioning_drift',
      recommendedAction: 'provisioning_pruefen',
      safeDetails: {
        dependency: 'sva_mainserver',
        reason_code: 'mainserver_upstream_failure',
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
        code: 'unauthorized',
        status: 401,
        details: {
          reason_code: 'session_expired',
        },
      })
    ).toEqual({
      classification: 'session_store_or_session_hydration',
      recommendedAction: 'erneut_anmelden',
      safeDetails: {
        reason_code: 'session_expired',
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
