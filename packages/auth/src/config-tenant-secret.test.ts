import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadAuthCiphertext: vi.fn(),
  loadAdminCiphertext: vi.fn(),
  revealField: vi.fn(),
  loggerWarn: vi.fn(),
  globalSecret: 'global-auth-secret',
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadInstanceAuthClientSecretCiphertext: (instanceId: string) => state.loadAuthCiphertext(instanceId),
  loadTenantAdminClientSecretCiphertext: (instanceId: string) => state.loadAdminCiphertext(instanceId),
}));

vi.mock('./iam-account-management/encryption.js', () => ({
  revealField: (ciphertext: string | null | undefined, aad: string) => state.revealField(ciphertext, aad),
}));

vi.mock('./runtime-secrets.server.js', () => ({
  getAuthClientSecret: () => state.globalSecret,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: state.loggerWarn,
    error: vi.fn(),
  }),
}));

describe('resolveTenantAuthClientSecret', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.globalSecret = 'global-auth-secret';
    state.loadAuthCiphertext.mockReset();
    state.loadAdminCiphertext.mockReset();
    state.revealField.mockReset();
  });

  it('returns a tenant-scoped secret when ciphertext can be decrypted', async () => {
    state.loadAuthCiphertext.mockResolvedValue('enc:test-client-secret');
    state.revealField.mockReturnValue('tenant-secret-value');

    const { resolveTenantAuthClientSecret } = await import('./config-tenant-secret.js');
    const result = await resolveTenantAuthClientSecret('bb-guben');

    expect(result).toEqual({
      configured: true,
      readable: true,
      secret: 'tenant-secret-value',
      source: 'tenant',
    });
    expect(state.revealField).toHaveBeenCalledWith(
      'enc:test-client-secret',
      'iam.instances.auth_client_secret:bb-guben'
    );
  });

  it('falls back to the global secret when no tenant ciphertext is configured', async () => {
    state.loadAuthCiphertext.mockResolvedValue(null);

    const { resolveTenantAuthClientSecret } = await import('./config-tenant-secret.js');
    const result = await resolveTenantAuthClientSecret('bb-guben');

    expect(result).toEqual({
      configured: false,
      readable: false,
      secret: 'global-auth-secret',
      source: 'global',
      reason: 'tenant_auth_client_secret_missing',
    });
    expect(state.loggerWarn).not.toHaveBeenCalled();
  });

  it('logs and falls back when tenant ciphertext lookup fails', async () => {
    state.loadAuthCiphertext.mockRejectedValue(new Error('db unavailable'));

    const { resolveTenantAuthClientSecret } = await import('./config-tenant-secret.js');
    const result = await resolveTenantAuthClientSecret('bb-guben');

    expect(result).toEqual({
      configured: false,
      readable: false,
      secret: 'global-auth-secret',
      source: 'global',
      reason: 'tenant_auth_client_secret_lookup_failed',
    });
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Tenant auth client secret lookup failed',
      expect.objectContaining({
        auth_scope_kind: 'platform',
        dependency: 'database',
        error_type: 'Error',
        operation: 'tenant_auth_secret_lookup',
        instance_id: 'bb-guben',
        reason_code: 'tenant_auth_client_secret_lookup_failed',
        resolution_result: 'platform',
      })
    );
  });

  it('logs and falls back when tenant ciphertext cannot be decrypted', async () => {
    state.loadAuthCiphertext.mockResolvedValue('enc:test-client-secret');
    state.revealField.mockReturnValue(undefined);

    const { resolveTenantAuthClientSecret } = await import('./config-tenant-secret.js');
    const result = await resolveTenantAuthClientSecret('bb-guben');

    expect(result).toEqual({
      configured: false,
      readable: false,
      secret: 'global-auth-secret',
      source: 'global',
      reason: 'tenant_auth_client_secret_unreadable',
    });
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Tenant auth client secret could not be decrypted',
      expect.objectContaining({
        auth_scope_kind: 'platform',
        operation: 'tenant_auth_secret_lookup',
        instance_id: 'bb-guben',
        reason_code: 'tenant_auth_client_secret_unreadable',
        resolution_result: 'platform',
      })
    );
  });
});

describe('resolveTenantAdminClientSecret', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.globalSecret = 'global-auth-secret';
    state.loadAuthCiphertext.mockReset();
    state.loadAdminCiphertext.mockReset();
    state.revealField.mockReset();
  });

  it('returns a tenant-scoped admin secret when ciphertext can be decrypted', async () => {
    state.loadAdminCiphertext.mockResolvedValue('enc:test-admin-client-secret');
    state.revealField.mockReturnValue('tenant-admin-secret-value');

    const { resolveTenantAdminClientSecret } = await import('./config-tenant-secret.js');
    const result = await resolveTenantAdminClientSecret('bb-guben');

    expect(result).toEqual({
      configured: true,
      readable: true,
      secret: 'tenant-admin-secret-value',
      source: 'tenant',
    });
    expect(state.revealField).toHaveBeenCalledWith(
      'enc:test-admin-client-secret',
      'iam.instances.tenant_admin_client_secret:bb-guben'
    );
  });

  it('returns a fail-closed result when no tenant admin ciphertext is configured', async () => {
    state.loadAdminCiphertext.mockResolvedValue(null);

    const { resolveTenantAdminClientSecret } = await import('./config-tenant-secret.js');
    const result = await resolveTenantAdminClientSecret('bb-guben');

    expect(result).toEqual({
      configured: false,
      readable: false,
      source: 'tenant',
      reason: 'tenant_admin_client_secret_missing',
    });
    expect(state.loggerWarn).not.toHaveBeenCalled();
  });

  it('logs and stays fail-closed when tenant admin ciphertext lookup fails', async () => {
    state.loadAdminCiphertext.mockRejectedValue(new Error('db unavailable'));

    const { resolveTenantAdminClientSecret } = await import('./config-tenant-secret.js');
    const result = await resolveTenantAdminClientSecret('bb-guben');

    expect(result).toEqual({
      configured: false,
      readable: false,
      source: 'tenant',
      reason: 'tenant_admin_client_secret_lookup_failed',
    });
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Tenant admin client secret lookup failed',
      expect.objectContaining({
        auth_scope_kind: 'instance',
        dependency: 'database',
        error_type: 'Error',
        operation: 'tenant_admin_client_secret_lookup',
        instance_id: 'bb-guben',
        reason_code: 'tenant_admin_client_secret_lookup_failed',
        resolution_result: 'tenant_secret_unavailable',
      })
    );
  });

  it('logs and stays fail-closed when tenant admin ciphertext cannot be decrypted', async () => {
    state.loadAdminCiphertext.mockResolvedValue('enc:test-admin-client-secret');
    state.revealField.mockReturnValue(undefined);

    const { resolveTenantAdminClientSecret } = await import('./config-tenant-secret.js');
    const result = await resolveTenantAdminClientSecret('bb-guben');

    expect(result).toEqual({
      configured: true,
      readable: false,
      source: 'tenant',
      reason: 'tenant_admin_client_secret_unreadable',
    });
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Tenant admin client secret could not be decrypted',
      expect.objectContaining({
        auth_scope_kind: 'instance',
        operation: 'tenant_admin_client_secret_lookup',
        instance_id: 'bb-guben',
        reason_code: 'tenant_admin_client_secret_unreadable',
        resolution_result: 'tenant_secret_unavailable',
      })
    );
  });
});
