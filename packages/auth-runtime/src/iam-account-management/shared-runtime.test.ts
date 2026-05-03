import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    warn: vi.fn(),
  },
  loadInstanceById: vi.fn(),
  getKeycloakAdminClientConfigFromEnv: vi.fn(),
  resolveTenantAdminClientSecret: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadInstanceById: state.loadInstanceById,
}));

vi.mock('../keycloak-admin-client.js', () => ({
  KeycloakAdminClient: class {
    getCircuitBreakerState() {
      return 0;
    }
  },
  getKeycloakAdminClientConfigFromEnv: state.getKeycloakAdminClientConfigFromEnv,
}));

vi.mock('../config-tenant-secret.js', () => ({
  resolveTenantAdminClientSecret: state.resolveTenantAdminClientSecret,
}));

describe('iam account management shared runtime logging', () => {
  beforeEach(() => {
    vi.resetModules();
    state.logger.warn.mockReset();
    state.loadInstanceById.mockReset();
    state.getKeycloakAdminClientConfigFromEnv.mockReset();
    state.resolveTenantAdminClientSecret.mockReset();
  });

  it('logs when the global identity provider configuration cannot be resolved', async () => {
    state.getKeycloakAdminClientConfigFromEnv.mockImplementation(() => {
      throw new Error('missing realm');
    });

    const { resolveIdentityProvider } = await import('./shared-runtime.js');

    expect(resolveIdentityProvider()).toBeNull();
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Global identity provider resolution failed',
      expect.objectContaining({
        reason_code: 'identity_provider_resolution_failed',
        error_type: 'Error',
      })
    );
  });

  it('logs when the instance lookup fails during tenant identity provider resolution', async () => {
    state.loadInstanceById.mockRejectedValueOnce(new Error('db down'));

    const { resolveIdentityProviderForInstance } = await import('./shared-runtime.js');

    await expect(resolveIdentityProviderForInstance('instance-1')).resolves.toBeNull();
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Instance identity provider resolution failed while loading instance metadata',
      expect.objectContaining({
        instance_id: 'instance-1',
        reason_code: 'instance_lookup_failed',
        error_type: 'Error',
      })
    );
  });

  it('logs when tenant admin client resolution fails after instance lookup', async () => {
    state.loadInstanceById.mockResolvedValueOnce({
      authRealm: 'tenant-realm',
      tenantAdminClient: { clientId: 'tenant-admin' },
    });
    state.resolveTenantAdminClientSecret.mockRejectedValueOnce(new Error('secret unavailable'));

    const { resolveIdentityProviderForInstance } = await import('./shared-runtime.js');

    await expect(resolveIdentityProviderForInstance('instance-1')).resolves.toBeNull();
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Instance identity provider resolution failed while loading tenant admin credentials',
      expect.objectContaining({
        instance_id: 'instance-1',
        reason_code: 'tenant_admin_resolution_failed',
        error_type: 'Error',
      })
    );
  });

  it('logs when the instance metadata is missing for tenant identity provider resolution', async () => {
    state.loadInstanceById.mockResolvedValueOnce(null);

    const { resolveIdentityProviderForInstance } = await import('./shared-runtime.js');

    await expect(resolveIdentityProviderForInstance('instance-404')).resolves.toBeNull();
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Instance identity provider resolution returned no instance metadata',
      expect.objectContaining({
        instance_id: 'instance-404',
        reason_code: 'instance_not_found',
      })
    );
  });

  it('logs when tenant admin credentials are incomplete after instance lookup', async () => {
    state.loadInstanceById.mockResolvedValueOnce({
      authRealm: 'tenant-realm',
      tenantAdminClient: { clientId: 'tenant-admin' },
    });
    state.resolveTenantAdminClientSecret.mockResolvedValueOnce({ secret: '' });

    const { resolveIdentityProviderForInstance } = await import('./shared-runtime.js');

    await expect(resolveIdentityProviderForInstance('instance-1')).resolves.toBeNull();
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Instance identity provider resolution returned incomplete tenant admin credentials',
      expect.objectContaining({
        instance_id: 'instance-1',
        reason_code: 'tenant_admin_credentials_incomplete',
      })
    );
  });
});
