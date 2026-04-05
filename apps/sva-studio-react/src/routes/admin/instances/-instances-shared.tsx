import { Badge } from '../../../components/ui/badge';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import type { useInstances } from '../../../hooks/use-instances';

export const INSTANCE_STATUS_LABELS = {
  requested: 'admin.instances.status.requested',
  validated: 'admin.instances.status.validated',
  provisioning: 'admin.instances.status.provisioning',
  active: 'admin.instances.status.active',
  failed: 'admin.instances.status.failed',
  suspended: 'admin.instances.status.suspended',
  archived: 'admin.instances.status.archived',
} as const;

export const readSuggestedParentDomain = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return new URL(window.location.href).hostname;
  } catch {
    return '';
  }
};

export const getErrorMessage = (error: IamHttpError | null) => {
  if (!error) {
    return t('admin.instances.messages.error');
  }

  switch (error.code) {
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
    case 'keycloak_unavailable':
      return t('admin.instances.errors.keycloakUnavailable');
    case 'encryption_not_configured':
      return t('admin.instances.errors.encryptionNotConfigured');
    default:
      return t('admin.instances.messages.error');
  }
};

export const createEmptyTenantAdminBootstrap = () => ({
  username: '',
  email: '',
  firstName: '',
  lastName: '',
});

export const createEmptyCreateForm = (parentDomain = '') => ({
  instanceId: '',
  displayName: '',
  parentDomain,
  authRealm: '',
  authClientId: 'sva-studio',
  authIssuerUrl: '',
  authClientSecret: '',
  tenantAdminBootstrap: createEmptyTenantAdminBootstrap(),
});

export const createDetailForm = (instance: NonNullable<ReturnType<typeof useInstances>['selectedInstance']>) => ({
  displayName: instance.displayName,
  parentDomain: instance.parentDomain,
  authRealm: instance.authRealm,
  authClientId: instance.authClientId,
  authIssuerUrl: instance.authIssuerUrl ?? '',
  authClientSecret: '',
  tenantAdminBootstrap: {
    username: instance.tenantAdminBootstrap?.username ?? '',
    email: instance.tenantAdminBootstrap?.email ?? '',
    firstName: instance.tenantAdminBootstrap?.firstName ?? '',
    lastName: instance.tenantAdminBootstrap?.lastName ?? '',
  },
  tenantAdminTemporaryPassword: '',
  rotateClientSecret: false,
});

export const getKeycloakStatusEntries = (selectedInstance: NonNullable<ReturnType<typeof useInstances>['selectedInstance']>) => {
  const status = selectedInstance.keycloakStatus;
  if (!status) {
    return [];
  }

  return [
    ['admin.instances.keycloakStatus.realmExists', status.realmExists],
    ['admin.instances.keycloakStatus.clientExists', status.clientExists],
    ['admin.instances.keycloakStatus.instanceIdMapperExists', status.instanceIdMapperExists],
    ['admin.instances.keycloakStatus.tenantAdminExists', status.tenantAdminExists],
    ['admin.instances.keycloakStatus.tenantAdminHasSystemAdmin', status.tenantAdminHasSystemAdmin],
    ['admin.instances.keycloakStatus.tenantAdminHasInstanceRegistryAdmin', !status.tenantAdminHasInstanceRegistryAdmin],
    ['admin.instances.keycloakStatus.redirectUrisMatch', status.redirectUrisMatch],
    ['admin.instances.keycloakStatus.logoutUrisMatch', status.logoutUrisMatch],
    ['admin.instances.keycloakStatus.webOriginsMatch', status.webOriginsMatch],
    ['admin.instances.keycloakStatus.clientSecretConfigured', status.clientSecretConfigured],
    ['admin.instances.keycloakStatus.tenantClientSecretReadable', status.tenantClientSecretReadable],
    ['admin.instances.keycloakStatus.clientSecretAligned', status.clientSecretAligned],
    ['admin.instances.keycloakStatus.runtimeSecretSourceTenant', status.runtimeSecretSource === 'tenant'],
  ] as const;
};

export const KeycloakStatusBadge = ({ ready }: { ready: boolean }) => (
  <Badge variant={ready ? 'secondary' : 'outline'}>
    {ready ? t('admin.instances.keycloakStatus.ok') : t('admin.instances.keycloakStatus.missing')}
  </Badge>
);
