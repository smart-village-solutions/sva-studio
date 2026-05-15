import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

export const getInstanceErrorMessage = (error: IamHttpError | null) => {
  if (!error) {
    return t('admin.instances.messages.error');
  }

  if (error.diagnosticStatus === 'recovery_laeuft') {
    return t('admin.instances.errors.recoveryRunning');
  }

  switch (error.classification) {
    case 'registry_or_provisioning_drift':
      return t('admin.instances.errors.registryOrProvisioningDrift');
    case 'keycloak_reconcile':
      return t('admin.instances.errors.keycloakReconcile');
    case 'database_or_schema_drift':
      return t('admin.instances.errors.databaseOrSchemaDrift');
    default:
      break;
  }

  switch (error.code) {
    case 'unauthorized':
      return t('admin.instances.errors.unauthorized');
    case 'forbidden':
      return t('admin.instances.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.instances.errors.csrfValidationFailed');
    case 'reauth_required':
      return t('admin.instances.errors.reauthRequired');
    case 'conflict':
      return t('admin.instances.errors.conflict');
    case 'database_unavailable':
      return t('admin.instances.errors.databaseUnavailable');
    case 'tenant_auth_client_secret_missing':
      return t('admin.instances.errors.tenantAuthClientSecretMissing');
    case 'tenant_admin_client_not_configured':
      return t('admin.instances.errors.tenantAdminClientNotConfigured');
    case 'tenant_admin_client_secret_missing':
      return t('admin.instances.errors.tenantAdminClientSecretMissing');
    case 'keycloak_unavailable':
      return t('admin.instances.errors.keycloakUnavailable');
    case 'encryption_not_configured':
      return t('admin.instances.errors.encryptionNotConfigured');
    default:
      return t('admin.instances.messages.error');
  }
};
