import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';
import type { IamHttpError } from '../../../lib/iam-api';

type RoleSyncState = 'synced' | 'pending' | 'failed';
type RoleManagedBy = 'studio' | 'external' | 'keycloak_builtin';

type RoleSummary = Readonly<{
  isSystemRole: boolean;
  managedBy: RoleManagedBy;
}>;

type RoleErrorMessageOptions = Readonly<{
  codeLabelKeys?: Partial<Record<string, TranslationKey>>;
  includeKeycloakReconcileError?: boolean;
  includeRecoveryRunningError?: boolean;
}>;

const STATUS_LABEL_KEYS = {
  synced: 'admin.roles.sync.synced',
  pending: 'admin.roles.sync.pending',
  failed: 'admin.roles.sync.failed',
} as const satisfies Record<RoleSyncState, TranslationKey>;

const DEFAULT_ROLE_ERROR_LABEL_KEYS = {
  forbidden: 'admin.roles.errors.forbidden',
  csrf_validation_failed: 'admin.roles.errors.csrfValidationFailed',
  rate_limited: 'admin.roles.errors.rateLimited',
  conflict: 'admin.roles.errors.conflict',
  keycloak_unavailable: 'admin.roles.errors.keycloakUnavailable',
  database_unavailable: 'admin.roles.errors.databaseUnavailable',
} as const satisfies Partial<Record<string, TranslationKey>>;

const defaultRoleErrorLabelKeys: Partial<Record<string, TranslationKey>> = DEFAULT_ROLE_ERROR_LABEL_KEYS;

export const roleStatusTone = (syncState: RoleSyncState): string => {
  if (syncState === 'synced') {
    return 'border-primary/40 bg-primary/10 text-primary';
  }
  if (syncState === 'failed') {
    return 'border-destructive/40 bg-destructive/10 text-destructive';
  }
  return 'border-secondary/40 bg-secondary/10 text-secondary';
};

export const roleStatusLabel = (syncState: RoleSyncState): string => t(STATUS_LABEL_KEYS[syncState]);

export const roleTypeLabel = (role: RoleSummary): string => {
  if (role.isSystemRole) {
    return t('admin.roles.labels.systemRole');
  }
  if (role.managedBy === 'keycloak_builtin') {
    return t('admin.roles.labels.builtInRole');
  }
  if (role.managedBy === 'external') {
    return t('admin.roles.labels.externalRole');
  }
  return t('admin.roles.labels.customRole');
};

export const roleErrorMessage = (
  error: IamHttpError | null,
  fallbackKey: TranslationKey,
  options?: RoleErrorMessageOptions
): string => {
  if (!error) {
    return t(fallbackKey);
  }

  if (options?.includeRecoveryRunningError && error.diagnosticStatus === 'recovery_laeuft') {
    return t('admin.roles.errors.recoveryRunning');
  }

  if (options?.includeKeycloakReconcileError && error.classification === 'keycloak_reconcile') {
    return t('admin.roles.errors.keycloakReconcile');
  }

  const codeLabelKey = options?.codeLabelKeys?.[error.code] ?? defaultRoleErrorLabelKeys[error.code];
  return codeLabelKey ? t(codeLabelKey) : t(fallbackKey);
};
