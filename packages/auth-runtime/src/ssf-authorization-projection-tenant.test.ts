import { beforeEach, describe, expect, it, vi } from 'vitest';

const { provider, resolveIdentityProviderForInstance, isKeycloakIdentityProvider } = vi.hoisted(
  () => ({
    provider: {},
    resolveIdentityProviderForInstance: vi.fn(),
    isKeycloakIdentityProvider: vi.fn(),
  })
);

vi.mock('./iam-account-management/shared-runtime.js', () => ({
  resolveIdentityProviderForInstance,
  isKeycloakIdentityProvider,
}));

import { resolveInstanceKeycloakProjectionTenant } from './ssf-authorization-projection-tenant.js';

describe('SSF Keycloak projection tenant resolver', () => {
  beforeEach(() => {
    resolveIdentityProviderForInstance.mockReset();
    isKeycloakIdentityProvider.mockReset();
  });

  it('binds the configured SSF client to the canonical instance provider', async () => {
    resolveIdentityProviderForInstance.mockResolvedValue({ provider });
    isKeycloakIdentityProvider.mockReturnValue(true);

    await expect(resolveInstanceKeycloakProjectionTenant('tenant-a', 'ssf')).resolves.toEqual({
      instanceId: 'tenant-a',
      clientId: 'ssf',
      client: provider,
    });
    expect(resolveIdentityProviderForInstance).toHaveBeenCalledWith('tenant-a');
  });

  it('fails closed when the tenant provider is unavailable or not Keycloak', async () => {
    resolveIdentityProviderForInstance.mockResolvedValueOnce(null);
    await expect(resolveInstanceKeycloakProjectionTenant('tenant-a', 'ssf')).resolves.toBeNull();

    resolveIdentityProviderForInstance.mockResolvedValueOnce({ provider });
    isKeycloakIdentityProvider.mockReturnValue(false);
    await expect(resolveInstanceKeycloakProjectionTenant('tenant-a', 'ssf')).resolves.toBeNull();
  });
});
