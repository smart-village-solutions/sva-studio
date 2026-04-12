import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadCiphertext: vi.fn(),
  revealField: vi.fn(),
  loggerWarn: vi.fn(),
  globalSecret: 'global-auth-secret',
}));

vi.mock('@sva/data/server', () => ({
  loadInstanceAuthClientSecretCiphertext: (instanceId: string) => state.loadCiphertext(instanceId),
}));

vi.mock('./iam-account-management/encryption.js', () => ({
  revealField: (ciphertext: string | null | undefined, aad: string) => state.revealField(ciphertext, aad),
}));

vi.mock('./runtime-secrets.server.js', () => ({
  getAuthClientSecret: () => state.globalSecret,
}));

vi.mock('@sva/sdk/server', () => ({
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
    state.loadCiphertext.mockReset();
    state.revealField.mockReset();
  });

  it('returns a tenant-scoped secret when ciphertext can be decrypted', async () => {
    state.loadCiphertext.mockResolvedValue('enc:test-client-secret');
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
    state.loadCiphertext.mockResolvedValue(null);

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
    state.loadCiphertext.mockRejectedValue(new Error('db unavailable'));

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
    state.loadCiphertext.mockResolvedValue('enc:test-client-secret');
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
