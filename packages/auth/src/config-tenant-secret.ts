import { loadInstanceAuthClientSecretCiphertext, loadTenantAdminClientSecretCiphertext } from '@sva/data/server';
import { createSdkLogger } from '@sva/sdk/server';
import { revealField } from './iam-account-management/encryption.js';
import { getAuthClientSecret } from './runtime-secrets.server.js';

const logger = createSdkLogger({ component: 'iam-auth-config', level: 'info' });

export type ResolvedTenantClientSecret = {
  readonly configured: boolean;
  readonly readable: boolean;
  readonly secret?: string;
  readonly source: 'tenant' | 'global';
  readonly reason?:
    | 'tenant_auth_client_secret_lookup_failed'
    | 'tenant_auth_client_secret_missing'
    | 'tenant_auth_client_secret_unreadable'
    | 'tenant_admin_client_secret_lookup_failed'
    | 'tenant_admin_client_secret_missing'
    | 'tenant_admin_client_secret_unreadable'
    | 'global_auth_client_secret';
};

const buildAuthClientSecretAad = (instanceId: string): string => `iam.instances.auth_client_secret:${instanceId}`;
const buildTenantAdminClientSecretAad = (instanceId: string): string => `iam.instances.tenant_admin_client_secret:${instanceId}`;

const buildGlobalFallback = (
  globalSecret: string | null | undefined,
  reason: ResolvedTenantClientSecret['reason']
): ResolvedTenantClientSecret => ({
  configured: false,
  readable: false,
  secret: globalSecret ?? undefined,
  source: 'global',
  reason,
});

export const resolveTenantAuthClientSecret = async (
  instanceId: string,
  options: { allowGlobalFallback?: boolean } = {}
): Promise<ResolvedTenantClientSecret> => {
  const allowGlobalFallback = options.allowGlobalFallback ?? true;
  const globalSecret = getAuthClientSecret();
  let fallbackReason: ResolvedTenantClientSecret['reason'] = 'tenant_auth_client_secret_missing';
  const ciphertext = await loadInstanceAuthClientSecretCiphertext(instanceId).catch((error) => {
    fallbackReason = 'tenant_auth_client_secret_lookup_failed';
    logger.warn('Tenant auth client secret lookup failed', {
      operation: 'tenant_auth_secret_lookup',
      auth_scope_kind: allowGlobalFallback ? 'platform' : 'instance',
      resolution_result: allowGlobalFallback ? 'platform' : 'tenant_secret_unavailable',
      instance_id: instanceId,
      reason_code: 'tenant_auth_client_secret_lookup_failed',
      dependency: 'database',
      error_type: error instanceof Error ? error.name : typeof error,
    });
    return null;
  });

  if (!ciphertext) {
    if (!allowGlobalFallback) {
      return {
        configured: false,
        readable: false,
        source: 'tenant',
        reason: fallbackReason,
      };
    }
    return buildGlobalFallback(globalSecret, fallbackReason);
  }

  const tenantSecret = revealField(ciphertext, buildAuthClientSecretAad(instanceId));
  if (!tenantSecret) {
    logger.warn('Tenant auth client secret could not be decrypted', {
      operation: 'tenant_auth_secret_lookup',
      auth_scope_kind: allowGlobalFallback ? 'platform' : 'instance',
      resolution_result: allowGlobalFallback ? 'platform' : 'tenant_secret_unavailable',
      instance_id: instanceId,
      reason_code: 'tenant_auth_client_secret_unreadable',
    });
    if (!allowGlobalFallback) {
      return {
        configured: true,
        readable: false,
        source: 'tenant',
        reason: 'tenant_auth_client_secret_unreadable',
      };
    }
    return buildGlobalFallback(globalSecret, 'tenant_auth_client_secret_unreadable');
  }

  return {
    configured: true,
    readable: true,
    secret: tenantSecret,
    source: 'tenant',
  };
};

export const resolveTenantAdminClientSecret = async (
  instanceId: string
): Promise<ResolvedTenantClientSecret> => {
  let missingReason: ResolvedTenantClientSecret['reason'] = 'tenant_admin_client_secret_missing';
  const ciphertext = await loadTenantAdminClientSecretCiphertext(instanceId).catch((error: unknown) => {
    missingReason = 'tenant_admin_client_secret_lookup_failed';
    logger.warn('Tenant admin client secret lookup failed', {
      operation: 'tenant_admin_client_secret_lookup',
      auth_scope_kind: 'instance',
      resolution_result: 'tenant_secret_unavailable',
      instance_id: instanceId,
      reason_code: 'tenant_admin_client_secret_lookup_failed',
      dependency: 'database',
      error_type: error instanceof Error ? error.name : typeof error,
    });
    return null;
  });

  if (!ciphertext) {
    return {
      configured: false,
      readable: false,
      source: 'tenant',
      reason: missingReason,
    };
  }

  const tenantSecret = revealField(ciphertext, buildTenantAdminClientSecretAad(instanceId));
  if (!tenantSecret) {
    logger.warn('Tenant admin client secret could not be decrypted', {
      operation: 'tenant_admin_client_secret_lookup',
      auth_scope_kind: 'instance',
      resolution_result: 'tenant_secret_unavailable',
      instance_id: instanceId,
      reason_code: 'tenant_admin_client_secret_unreadable',
    });
    return {
      configured: true,
      readable: false,
      source: 'tenant',
      reason: 'tenant_admin_client_secret_unreadable',
    };
  }

  return {
    configured: true,
    readable: true,
    secret: tenantSecret,
    source: 'tenant',
  };
};
