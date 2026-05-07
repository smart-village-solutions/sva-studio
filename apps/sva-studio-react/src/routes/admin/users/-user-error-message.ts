import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

type UserErrorContext = 'load' | 'mutation';

const readHttpStatusFromMessage = (message: string): string | null => {
  const match = /^http_(\d{3})$/.exec(message.trim());
  return match?.[1] ?? null;
};

const getContextualMessage = (key: string, context: UserErrorContext): string => {
  if (key === 'error') {
    return context === 'mutation' ? t('admin.users.messages.mutationError') : t('admin.users.messages.error');
  }
  return t(`admin.users.errors.${key}`);
};

const staticErrorCodeMap: Record<string, string> = {
  forbidden: 'forbidden',
  csrf_validation_failed: 'csrfValidationFailed',
  rate_limited: 'rateLimited',
  conflict: 'conflict',
  tenant_admin_client_not_configured: 'tenantAdminClientNotConfigured',
  tenant_admin_client_secret_missing: 'tenantAdminClientSecretMissing',
  keycloak_unavailable: 'keycloakUnavailable',
  database_unavailable: 'databaseUnavailable',
  last_admin_protection: 'lastAdminProtection',
  self_protection: 'selfProtection',
  feature_disabled: 'featureDisabled',
  unauthorized: 'unauthorized',
};

export const userErrorMessage = (
  error: IamHttpError | null,
  context: UserErrorContext = 'load'
): string => {
  if (!error) {
    return getContextualMessage('error', context);
  }

  if (error.diagnosticStatus === 'recovery_laeuft') {
    return t('admin.users.errors.recoveryRunning');
  }

  if (error.classification === 'keycloak_reconcile') {
    return t('admin.users.errors.keycloakReconcile');
  }

  const staticKey = staticErrorCodeMap[error.code];
  if (staticKey) {
    return t(`admin.users.errors.${staticKey}`);
  }

  if (error.code === 'invalid_request') {
    return getContextualMessage('error', context);
  }

  if (error.code === 'non_json_response') {
    if (error.status >= 400) {
      return t('admin.users.errors.unexpectedHttp', { status: String(error.status) });
    }
    const msg = context === 'mutation' ? 'unexpectedMutationClient' : 'unexpectedClient';
    return t(`admin.users.errors.${msg}`, { message: error.message });
  }

  if (error.code === 'internal_error') {
    const httpStatus = readHttpStatusFromMessage(error.message);
    if (httpStatus) {
      return t('admin.users.errors.unexpectedHttp', { status: httpStatus });
    }
    if (error.message.trim().length > 0) {
      const msg = context === 'mutation' ? 'unexpectedMutationClient' : 'unexpectedClient';
      return t(`admin.users.errors.${msg}`, { message: error.message });
    }
    return getContextualMessage('error', context);
  }

  return t('admin.users.messages.error');
};
