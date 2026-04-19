import { describe, expect, it } from 'vitest';

import {
  iamRuntimeDiagnosticClassifications,
  iamRuntimeDiagnosticStatuses,
  iamRuntimeRecommendedActions,
} from './account-management-contract.js';

describe('account-management-contract runtime diagnostics exports', () => {
  it('exports the supported runtime diagnostic classifications in a stable order', () => {
    expect(iamRuntimeDiagnosticClassifications).toEqual([
      'tenant_host_validation',
      'session_store_or_session_hydration',
      'actor_resolution_or_membership',
      'keycloak_dependency',
      'database_or_schema_drift',
      'database_mapping_or_membership_inconsistency',
      'registry_or_provisioning_drift',
      'keycloak_reconcile',
      'unknown',
    ]);
  });

  it('exports the supported runtime diagnostic statuses and recommended actions', () => {
    expect(iamRuntimeDiagnosticStatuses).toEqual([
      'gesund',
      'degradiert',
      'recovery_laeuft',
      'manuelle_pruefung_erforderlich',
    ]);

    expect(iamRuntimeRecommendedActions).toEqual([
      'erneut_anmelden',
      'erneut_versuchen',
      'keycloak_pruefen',
      'migration_pruefen',
      'provisioning_pruefen',
      'rollenabgleich_pruefen',
      'manuell_pruefen',
      'support_kontaktieren',
    ]);
  });
});
