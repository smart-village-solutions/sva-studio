import { beforeEach, describe, expect, it, vi } from 'vitest';

const { client, loadInstanceById, getKeycloakProvisionerClientConfigFromEnv, KeycloakAdminClient } =
  vi.hoisted(() => ({
    client: {},
    loadInstanceById: vi.fn(),
    getKeycloakProvisionerClientConfigFromEnv: vi.fn(),
    KeycloakAdminClient: vi.fn(),
  }));

vi.mock('@sva/data-repositories/server', () => ({ loadInstanceById }));
vi.mock('./keycloak-admin-client.js', () => ({
  getKeycloakProvisionerClientConfigFromEnv,
  KeycloakAdminClient,
}));

import { resolveInstanceKeycloakProjectionTenant } from './ssf-authorization-projection-tenant.js';

describe('SSF Keycloak projection tenant resolver', () => {
  beforeEach(() => {
    loadInstanceById.mockReset();
    getKeycloakProvisionerClientConfigFromEnv.mockReset();
    KeycloakAdminClient.mockReset();
    getKeycloakProvisionerClientConfigFromEnv.mockReturnValue({ realm: 'tenant-realm' });
    KeycloakAdminClient.mockImplementation(
      class {
        constructor() {
          return client;
        }
      }
    );
  });

  it('binds the configured SSF client to the canonical instance provider', async () => {
    loadInstanceById.mockResolvedValue({ authRealm: 'tenant-realm' });

    await expect(resolveInstanceKeycloakProjectionTenant('tenant-a', 'ssf')).resolves.toEqual({
      instanceId: 'tenant-a',
      clientId: 'ssf',
      client,
    });
    expect(getKeycloakProvisionerClientConfigFromEnv).toHaveBeenCalledWith('tenant-realm');
  });

  it('fails closed when the tenant is unavailable', async () => {
    loadInstanceById.mockResolvedValue(null);
    await expect(resolveInstanceKeycloakProjectionTenant('tenant-a', 'ssf')).resolves.toBeNull();
  });
});
