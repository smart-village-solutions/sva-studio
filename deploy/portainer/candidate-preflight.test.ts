import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/auth-runtime/server', () => ({
  revealField: (value: string | null | undefined) => value === 'readable' ? 'secret' : undefined,
}));

const { parseAllowedInstanceIds, verifyTenantRows } = await import('./candidate-preflight.mjs');

describe('candidate preflight', () => {
  it('normalizes the explicit release tenant scope', () => {
    expect(parseAllowedInstanceIds('tenant-b, tenant-a,tenant-b')).toEqual(['tenant-a', 'tenant-b']);
  });

  it('accepts only scoped active tenants with readable configured secrets', () => {
    expect(() => verifyTenantRows([{
      id: 'tenant-a',
      auth_client_secret_ciphertext: 'readable',
      tenant_admin_client_id: 'admin',
      tenant_admin_client_secret_ciphertext: 'readable',
    }], ['tenant-a'])).not.toThrow();
  });

  it('fails closed for scope drift and unreadable secrets', () => {
    expect(() => verifyTenantRows([{
      id: 'tenant-b',
      auth_client_secret_ciphertext: 'readable',
      tenant_admin_client_id: '',
      tenant_admin_client_secret_ciphertext: null,
    }], ['tenant-a'])).toThrow('candidate_release_tenant_scope_mismatch');
    expect(() => verifyTenantRows([{
      id: 'tenant-a',
      auth_client_secret_ciphertext: 'unreadable',
      tenant_admin_client_id: '',
      tenant_admin_client_secret_ciphertext: null,
    }], ['tenant-a'])).toThrow('candidate_tenant_auth_secret_unreadable');
  });
});
