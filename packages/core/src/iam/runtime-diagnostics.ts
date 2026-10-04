import type {
  IamRuntimeDiagnosticClassification,
  IamRuntimeDiagnostics,
  IamRuntimeRecommendedAction,
  IamRuntimeDiagnosticStatus,
} from './account-management-contract.js';
import { classify, type RuntimeDiagnosticInput } from './runtime-diagnostics-classification.js';
import { readSafeDetails } from './runtime-diagnostics-safe-details.js';

const resolveStatus = (
  input: RuntimeDiagnosticInput,
  classification: IamRuntimeDiagnosticClassification
): IamRuntimeDiagnosticStatus => {
  if (input.code === 'unauthorized' || input.code === 'reauth_required') {
    return 'recovery_laeuft';
  }

  if (
    input.code === 'forbidden' ||
    input.code === 'csrf_validation_failed' ||
    input.code === 'invalid_request' ||
    input.code === 'conflict' ||
    input.code === 'feature_disabled' ||
    classification === 'keycloak_reconcile'
  ) {
    return 'manuelle_pruefung_erforderlich';
  }

  return 'degradiert';
};

const CLASSIFICATION_RECOMMENDED_ACTIONS = {
  auth_resolution: 'erneut_anmelden',
  oidc_discovery_or_exchange: 'erneut_anmelden',
  tenant_host_validation: 'erneut_versuchen',
  session_store_or_session_hydration: 'erneut_versuchen',
  actor_resolution_or_membership: 'manuell_pruefen',
  keycloak_dependency: 'keycloak_pruefen',
  database_or_schema_drift: 'migration_pruefen',
  database_mapping_or_membership_inconsistency: 'manuell_pruefen',
  registry_or_provisioning_drift: 'provisioning_pruefen',
  keycloak_reconcile: 'rollenabgleich_pruefen',
  frontend_state_or_permission_staleness: 'erneut_versuchen',
  legacy_workaround_or_regression: 'manuell_pruefen',
  unknown: 'erneut_versuchen',
} as const satisfies Readonly<
  Record<IamRuntimeDiagnosticClassification, IamRuntimeRecommendedAction>
>;

const resolveRecommendedAction = (
  input: RuntimeDiagnosticInput,
  classification: IamRuntimeDiagnosticClassification
): IamRuntimeRecommendedAction => {
  if (input.code === 'unauthorized' || input.code === 'reauth_required') {
    return 'erneut_anmelden';
  }

  if (classification === 'unknown' && input.status >= 500) {
    return 'support_kontaktieren';
  }

  return CLASSIFICATION_RECOMMENDED_ACTIONS[classification];
};

export const deriveIamRuntimeDiagnostics = (
  input: RuntimeDiagnosticInput
): IamRuntimeDiagnostics => {
  const safeDetails = readSafeDetails(input.details);
  const classification = classify({ input, safeDetails });

  return {
    classification,
    status: resolveStatus(input, classification),
    recommendedAction: resolveRecommendedAction(input, classification),
    ...(safeDetails ? { safeDetails } : {}),
  };
};
