import type { IamRuntimeDiagnosticClassification, IamRuntimeRecommendedAction } from '@sva/core';

import { t } from '../../i18n';
import type { IamHttpError } from '../../lib/iam-api';

const CLASSIFICATION_LABEL_KEYS: Record<IamRuntimeDiagnosticClassification, string> = {
  tenant_host_validation: 'admin.shared.diagnostics.classifications.tenantHostValidation',
  session_store_or_session_hydration: 'admin.shared.diagnostics.classifications.sessionStoreOrSessionHydration',
  actor_resolution_or_membership: 'admin.shared.diagnostics.classifications.actorResolutionOrMembership',
  keycloak_dependency: 'admin.shared.diagnostics.classifications.keycloakDependency',
  database_or_schema_drift: 'admin.shared.diagnostics.classifications.databaseOrSchemaDrift',
  database_mapping_or_membership_inconsistency:
    'admin.shared.diagnostics.classifications.databaseMappingOrMembershipInconsistency',
  registry_or_provisioning_drift: 'admin.shared.diagnostics.classifications.registryOrProvisioningDrift',
  keycloak_reconcile: 'admin.shared.diagnostics.classifications.keycloakReconcile',
  unknown: 'admin.shared.diagnostics.classifications.unknown',
};

const ACTION_LABEL_KEYS: Record<IamRuntimeRecommendedAction, string> = {
  erneut_anmelden: 'admin.shared.diagnostics.actions.erneutAnmelden',
  erneut_versuchen: 'admin.shared.diagnostics.actions.erneutVersuchen',
  keycloak_pruefen: 'admin.shared.diagnostics.actions.keycloakPruefen',
  migration_pruefen: 'admin.shared.diagnostics.actions.migrationPruefen',
  provisioning_pruefen: 'admin.shared.diagnostics.actions.provisioningPruefen',
  rollenabgleich_pruefen: 'admin.shared.diagnostics.actions.rollenabgleichPruefen',
  manuell_pruefen: 'admin.shared.diagnostics.actions.manuellPruefen',
  support_kontaktieren: 'admin.shared.diagnostics.actions.supportKontaktieren',
};

const readLabelKey = <TKey extends string>(mapping: Readonly<Record<TKey, string>>, value?: string): string | undefined =>
  value && Object.hasOwn(mapping, value) ? mapping[value as TKey] : undefined;

type IamRuntimeDiagnosticDetailsProps = Readonly<{
  error: IamHttpError;
}>;

export const IamRuntimeDiagnosticDetails = ({ error }: IamRuntimeDiagnosticDetailsProps) => {
  if (!error.classification && !error.recommendedAction && !error.requestId && !error.safeDetails?.sync_error_code) {
    return null;
  }

  const classificationLabelKey = readLabelKey(CLASSIFICATION_LABEL_KEYS, error.classification);
  const actionLabelKey = readLabelKey(ACTION_LABEL_KEYS, error.recommendedAction);

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {classificationLabelKey ? (
        <p>
          {t('admin.shared.diagnostics.classification', {
            value: t(classificationLabelKey),
          })}
        </p>
      ) : null}
      {actionLabelKey ? (
        <p>
          {t('admin.shared.diagnostics.recommendedAction', {
            value: t(actionLabelKey),
          })}
        </p>
      ) : null}
      {error.safeDetails?.sync_error_code ? (
        <p>{t('admin.shared.diagnostics.syncErrorCode', { code: error.safeDetails.sync_error_code })}</p>
      ) : null}
      {error.requestId ? <p>{t('admin.shared.diagnostics.requestId', { requestId: error.requestId })}</p> : null}
    </div>
  );
};
