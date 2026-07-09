import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

type UserErrorContext = 'load' | 'mutation';

const readHttpStatusFromMessage = (message: string): string | null => {
  const match = /^http_(\d{3})$/.exec(message.trim());
  return match?.[1] ?? null;
};

const getDefaultContextualMessage = (context: UserErrorContext): string =>
  context === 'mutation' ? t('admin.users.messages.mutationError') : t('admin.users.messages.error');

const staticErrorCodeMap: Record<string, () => string> = {
  forbidden: () => t('admin.users.errors.forbidden'),
  csrf_validation_failed: () => t('admin.users.errors.csrfValidationFailed'),
  rate_limited: () => t('admin.users.errors.rateLimited'),
  conflict: () => t('admin.users.errors.conflict'),
  tenant_admin_client_not_configured: () => t('admin.users.errors.tenantAdminClientNotConfigured'),
  tenant_admin_client_secret_missing: () => t('admin.users.errors.tenantAdminClientSecretMissing'),
  keycloak_unavailable: () => t('admin.users.errors.keycloakUnavailable'),
  database_unavailable: () => t('admin.users.errors.databaseUnavailable'),
  mainserver_configuration_incomplete: () => t('admin.users.errors.mainserverConfigurationIncomplete'),
  mainserver_credentials_missing: () => t('admin.users.errors.mainserverCredentialsMissing'),
  mainserver_credentials_unavailable: () => t('admin.users.errors.mainserverCredentialsUnavailable'),
  mainserver_credentials_invalid: () => t('admin.users.errors.mainserverCredentialsInvalid'),
  mainserver_user_conflict: () => t('admin.users.errors.mainserverUserConflict'),
  mainserver_provisioning_failed: () => t('admin.users.errors.mainserverProvisioningFailed'),
  last_admin_protection: () => t('admin.users.errors.lastAdminProtection'),
  self_protection: () => t('admin.users.errors.selfProtection'),
  system_admin_delete_protection: () => t('admin.users.errors.systemAdminDeleteProtection'),
  feature_disabled: () => t('admin.users.errors.featureDisabled'),
  unauthorized: () => t('admin.users.errors.unauthorized'),
};

export const userErrorMessage = (
  error: IamHttpError | null,
  context: UserErrorContext = 'load'
): string => {
  if (!error) {
    return getDefaultContextualMessage(context);
  }

  if (error.diagnosticStatus === 'recovery_laeuft') {
    return t('admin.users.errors.recoveryRunning');
  }

  if (error.classification === 'keycloak_reconcile') {
    return t('admin.users.errors.keycloakReconcile');
  }

  const staticMessage = staticErrorCodeMap[error.code];
  if (staticMessage) {
    return staticMessage();
  }

  if (error.code === 'invalid_request') {
    return getDefaultContextualMessage(context);
  }

  if (error.code === 'non_json_response') {
    if (error.status >= 400) {
      return t('admin.users.errors.unexpectedHttp', { status: String(error.status) });
    }
    return context === 'mutation'
      ? t('admin.users.errors.unexpectedMutationClient', { message: error.message })
      : t('admin.users.errors.unexpectedClient', { message: error.message });
  }

  if (error.code === 'internal_error') {
    const httpStatus = readHttpStatusFromMessage(error.message);
    if (httpStatus) {
      return t('admin.users.errors.unexpectedHttp', { status: httpStatus });
    }
    if (error.message.trim().length > 0) {
      return context === 'mutation'
        ? t('admin.users.errors.unexpectedMutationClient', { message: error.message })
        : t('admin.users.errors.unexpectedClient', { message: error.message });
    }
    return getDefaultContextualMessage(context);
  }

  return getDefaultContextualMessage(context);
};
