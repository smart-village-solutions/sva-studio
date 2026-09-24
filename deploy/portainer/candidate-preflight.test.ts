import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/auth-runtime/server', () => ({
  revealField: (value: string | null | undefined) => (value === 'readable' ? 'secret' : undefined),
}));

const {
  candidateTenantQuery,
  isCandidatePreflightEntrypoint,
  verifyTenantRows,
} = await import('./candidate-preflight.mjs');

describe('candidate preflight', () => {
  it('recognizes relative and absolute CLI entrypoint paths', () => {
    const absolutePath = new URL('./candidate-preflight.mjs', import.meta.url).pathname;
    expect(
      isCandidatePreflightEntrypoint(
        new URL('./candidate-preflight.mjs', import.meta.url).href,
        absolutePath
      )
    ).toBe(true);
    expect(
      isCandidatePreflightEntrypoint(
        new URL('./candidate-preflight.mjs', import.meta.url).href,
        'deploy/portainer/candidate-preflight.mjs'
      )
    ).toBe(true);
    expect(
      isCandidatePreflightEntrypoint(
        new URL('./candidate-preflight.mjs', import.meta.url).href,
        undefined
      )
    ).toBe(false);
  });

  it('selects every active tenant from the registry', () => {
    expect(candidateTenantQuery).toContain("WHERE status = 'active'");
    expect(candidateTenantQuery).not.toContain('id = ANY');
  });

  it('accepts active tenants with readable configured secrets', () => {
    expect(() =>
      verifyTenantRows(
        [
          {
            id: 'tenant-a',
            auth_client_secret_ciphertext: 'readable',
            tenant_admin_client_id: 'admin',
            tenant_admin_client_secret_ciphertext: 'readable',
          },
        ]
      )
    ).not.toThrow();
  });

  it('does not treat an empty active registry as an environment mismatch', () => {
    expect(() => verifyTenantRows([])).not.toThrow();
  });

  it('fails closed for unreadable secrets', () => {
    expect(() =>
      verifyTenantRows(
        [
          {
            id: 'tenant-a',
            auth_client_secret_ciphertext: 'unreadable',
            tenant_admin_client_id: '',
            tenant_admin_client_secret_ciphertext: null,
          },
        ]
      )
    ).toThrow('candidate_tenant_auth_secret_unreadable');
  });
});
