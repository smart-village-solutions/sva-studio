import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadAuthSecretMock, loadAdminSecretMock, logger, revealFieldMock } = vi.hoisted(() => ({
  loadAuthSecretMock: vi.fn(),
  loadAdminSecretMock: vi.fn(),
  logger: {
    warn: vi.fn(),
  },
  revealFieldMock: vi.fn(),
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadInstanceAuthClientSecretCiphertext: loadAuthSecretMock,
  loadTenantAdminClientSecretCiphertext: loadAdminSecretMock,
}));

vi.mock('@sva/iam-admin', () => ({
  revealField: revealFieldMock,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => logger,
}));

vi.mock('./runtime-secrets.js', () => ({
  getAuthClientSecret: () => 'global-secret',
}));

const { resolveTenantAdminClientSecret, resolveTenantAuthClientSecret } = await import('./config-tenant-secret.js');

describe('tenant auth secret resolution', () => {
  beforeEach(() => {
    loadAuthSecretMock.mockReset();
    loadAdminSecretMock.mockReset();
    logger.warn.mockReset();
    revealFieldMock.mockReset();
  });

  it('resolves readable tenant auth secrets and admin secrets', async () => {
    loadAuthSecretMock.mockResolvedValueOnce('auth-ciphertext');
    loadAdminSecretMock.mockResolvedValueOnce('admin-ciphertext');
    revealFieldMock.mockReturnValueOnce('tenant-auth-secret').mockReturnValueOnce('tenant-admin-secret');

    await expect(resolveTenantAuthClientSecret('instance-1')).resolves.toEqual({
      configured: true,
      readable: true,
      secret: 'tenant-auth-secret',
      source: 'tenant',
    });
    await expect(resolveTenantAdminClientSecret('instance-1')).resolves.toEqual({
      configured: true,
      readable: true,
      secret: 'tenant-admin-secret',
      source: 'tenant',
    });
  });

  it('falls back to the global auth secret for missing, failed and unreadable tenant auth secrets', async () => {
    loadAuthSecretMock
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce('ciphertext');
    revealFieldMock.mockReturnValueOnce(null);

    await expect(resolveTenantAuthClientSecret('instance-1')).resolves.toMatchObject({
      configured: false,
      readable: false,
      secret: 'global-secret',
      source: 'global',
      reason: 'tenant_auth_client_secret_missing',
    });
    await expect(resolveTenantAuthClientSecret('instance-1')).resolves.toMatchObject({
      reason: 'tenant_auth_client_secret_lookup_failed',
      source: 'global',
    });
    await expect(resolveTenantAuthClientSecret('instance-1')).resolves.toMatchObject({
      reason: 'tenant_auth_client_secret_unreadable',
      source: 'global',
    });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns tenant-scoped failures when global fallback is disabled', async () => {
    loadAuthSecretMock.mockResolvedValueOnce(null).mockResolvedValueOnce('ciphertext');
    revealFieldMock.mockReturnValueOnce(null);

    await expect(resolveTenantAuthClientSecret('instance-1', { allowGlobalFallback: false })).resolves.toEqual({
      configured: false,
      readable: false,
      source: 'tenant',
      reason: 'tenant_auth_client_secret_missing',
    });
    await expect(resolveTenantAuthClientSecret('instance-1', { allowGlobalFallback: false })).resolves.toEqual({
      configured: true,
      readable: false,
      source: 'tenant',
      reason: 'tenant_auth_client_secret_unreadable',
    });
  });

  it('reports tenant admin secret lookup, missing and unreadable states', async () => {
    loadAdminSecretMock
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce('ciphertext');
    revealFieldMock.mockReturnValueOnce(null);

    await expect(resolveTenantAdminClientSecret('instance-1')).resolves.toEqual({
      configured: false,
      readable: false,
      source: 'tenant',
      reason: 'tenant_admin_client_secret_missing',
    });
    await expect(resolveTenantAdminClientSecret('instance-1')).resolves.toEqual({
      configured: false,
      readable: false,
      source: 'tenant',
      reason: 'tenant_admin_client_secret_lookup_failed',
    });
    await expect(resolveTenantAdminClientSecret('instance-1')).resolves.toEqual({
      configured: true,
      readable: false,
      source: 'tenant',
      reason: 'tenant_admin_client_secret_unreadable',
    });
  });
});
