import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

const readHttpStatusFromMessage = (message: string): string | null => {
  const match = /^http_(\d{3})$/.exec(message.trim());
  return match?.[1] ?? null;
};

export const userErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('admin.users.messages.error');
  }

  switch (error.code) {
    case 'invalid_request':
      return t('admin.users.messages.error');
    case 'forbidden':
      return t('admin.users.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.users.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.users.errors.rateLimited');
    case 'conflict':
      return t('admin.users.errors.conflict');
    case 'tenant_admin_client_not_configured':
      return t('admin.users.errors.tenantAdminClientNotConfigured');
    case 'tenant_admin_client_secret_missing':
      return t('admin.users.errors.tenantAdminClientSecretMissing');
    case 'keycloak_unavailable':
      return t('admin.users.errors.keycloakUnavailable');
    case 'database_unavailable':
      return t('admin.users.errors.databaseUnavailable');
    case 'last_admin_protection':
      return t('admin.users.errors.lastAdminProtection');
    case 'self_protection':
      return t('admin.users.errors.selfProtection');
    case 'feature_disabled':
      return t('admin.users.errors.featureDisabled');
    case 'unauthorized':
      return t('admin.users.errors.unauthorized');
    case 'non_json_response':
      if (error.status >= 400) {
        return t('admin.users.errors.unexpectedHttp', { status: String(error.status) });
      }
      return t('admin.users.errors.unexpectedClient', { message: error.message });
    case 'internal_error': {
      const httpStatus = readHttpStatusFromMessage(error.message);
      if (httpStatus) {
        return t('admin.users.errors.unexpectedHttp', { status: httpStatus });
      }
      if (error.message.trim().length > 0) {
        return t('admin.users.errors.unexpectedClient', { message: error.message });
      }
      return t('admin.users.messages.error');
    }
    default:
      return t('admin.users.messages.error');
  }
};
